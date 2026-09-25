import { NextRequest, NextResponse } from "next/server";
import { buscarContratacoesPncp } from "@/lib/server/pncp-client";
import { buscarViaApiInterna } from "@/lib/server/pncp-search-client";
import { buscarContratacoesCompras } from "@/lib/server/compras-client";
import { identificarPortal } from "@/lib/portal";
import {
  chaveMunicipio,
  grupoDaModalidade,
  modalidadesCorrespondem,
  normalizarTexto,
  ordenar,
  MODALIDADES,
} from "@/lib/data/dominio";
import { MUNICIPIOS_POR_UF } from "@/lib/data/municipios";
import type { Licitacao, LicitacoesResponse } from "@/types/licitacao";

/**
 * /api/licitacoes — camada de BACKEND do Next.js. Busca real no PNCP, com
 * TRÊS fontes em cascata:
 *   1. lib/server/pncp-search-client.ts — a API de busca não-documentada
 *      que sustenta pncp.gov.br/app/editais. Rápida e com texto livre, mas
 *      pode mudar sem aviso por não ser um contrato oficial.
 *   2. lib/server/pncp-client.ts — a API de consulta OFICIAL do PNCP
 *      (Manual de Integração). Usada quando a primeira falha: mais lenta
 *      (uma chamada por modalidade) e sem busca por texto.
 *   3. lib/server/compras-client.ts — Dados Abertos do Compras.gov.br,
 *      infraestrutura independente do pncp.gov.br, com os mesmos dados.
 *      Último recurso, só quando as duas fontes do PNCP falham juntas.
 *
 * Nenhuma das três fontes filtra por órgão, número da licitação, situação
 * ou faixa de valor — por isso esses filtros (e modalidade/município, como
 * rede de segurança) são sempre aplicados aqui, sobre o resultado agregado.
 */

export const dynamic = "force-dynamic";

function contemTexto(alvo: string | undefined, termo: string): boolean {
  if (!alvo) return false;
  return normalizarTexto(alvo).includes(normalizarTexto(termo));
}

// O PNCP publica datas no horário de Brasília (UTC-3, sem horário de verão
// desde 2019). Os cálculos abaixo fixam esse deslocamento explicitamente em
// vez de depender do fuso horário do processo Node — assim o comportamento
// não muda dependendo de onde o backend for hospedado.
const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000;

/** Meia-noite (00:00:00) ou fim do dia (23:59:59.999) de uma data yyyy-mm-dd, em Brasília, como instante UTC. */
function limiteDoDiaBrasilia(dataYYYYMMDD: string, fimDoDia: boolean): Date | undefined {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataYYYYMMDD);
  if (!partes) return undefined;
  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const [horas, minutos, segundos, ms] = fimDoDia ? [23, 59, 59, 999] : [0, 0, 0, 0];
  const instanteComoSeFosseUtc = Date.UTC(ano, mes - 1, dia, horas, minutos, segundos, ms);
  return new Date(instanteComoSeFosseUtc + OFFSET_BRASILIA_MS);
}

/** `dias` dias após `referencia`, às 23:59:59.999 em Brasília, como instante UTC. */
function finalDoDiaBrasiliaMaisDias(referencia: Date, dias: number): Date {
  const emBrasilia = new Date(referencia.getTime() - OFFSET_BRASILIA_MS);
  emBrasilia.setUTCDate(emBrasilia.getUTCDate() + dias);
  emBrasilia.setUTCHours(23, 59, 59, 999);
  return new Date(emBrasilia.getTime() + OFFSET_BRASILIA_MS);
}

// Sem "Data final" explícita, a API oficial do PNCP ainda assim exige o
// parâmetro — usamos uma janela ampla o bastante pra não ser, na prática,
// nenhuma limitação real (bem maior que o horizonte comum de uma proposta).
const DIAS_JANELA_MAXIMA = 730;

/**
 * Monta a janela de busca a partir de "Data inicial"/"Data final" — sem
 * nenhum preset de período: sem "Data inicial", busca sempre a partir de
 * agora (nunca pra trás); sem "Data final", usa a janela máxima acima.
 */
function calcularJanelaBusca(dataInicial: string | null, dataFinal: string | null): { inicio: Date; fim: Date } {
  const agora = new Date();
  return {
    inicio: (dataInicial ? limiteDoDiaBrasilia(dataInicial, false) : undefined) ?? agora,
    fim: (dataFinal ? limiteDoDiaBrasilia(dataFinal, true) : undefined) ?? finalDoDiaBrasiliaMaisDias(agora, DIAS_JANELA_MAXIMA),
  };
}


function respostaErroServidor() {
  return NextResponse.json(
    { erro: "Não foi possível concluir a consulta neste momento." },
    { status: 502 },
  );
}

export async function GET(request: NextRequest) {
  const inicioRequisicao = Date.now();
  const params = request.nextUrl.searchParams;

  const q = params.get("q") ?? "";
  const uf = params.get("uf") ?? "";
  const municipio = params.get("municipio") ?? "";
  const dataInicial = params.get("dataInicial");
  const dataFinal = params.get("dataFinal");
  const modalidades = params.getAll("modalidade").filter(Boolean);
  const valorMinimo = params.has("valorMinimo") ? Number(params.get("valorMinimo")) : undefined;
  const valorMaximo = params.has("valorMaximo") ? Number(params.get("valorMaximo")) : undefined;
  const orgao = params.get("orgao") ?? "";
  const numeroLicitacao = params.get("numeroLicitacao") ?? "";
  const situacao = params.get("situacao") ?? "";

  const { inicio, fim } = calcularJanelaBusca(dataInicial, dataFinal);

  // Sem "Data inicial", a busca é sempre a partir de agora, pra frente —
  // nunca pra trás — e sem "Data final", usa a janela máxima (acima), que
  // na prática não limita nada. Sem isso, a fonte primária (que não filtra
  // data nenhuma) podia devolver licitações encerradas há meses misturadas
  // com as abertas. Exceção: se o usuário filtrou por "Situação" (ex.:
  // "Encerrada"), nunca forçamos o limite inferior — mesmo a "Data inicial"
  // sendo sempre pra frente por padrão, o que tornaria esse filtro
  // impossível de satisfazer.
  const fimEfetivo = fim;
  const inicioEfetivo = situacao.trim() ? undefined : inicio;

  let resultadoPrincipal: Licitacao[];
  let parcial = false;

  const ufFiltro = uf && uf !== "TODOS" ? uf : undefined;
  let usouFallbackOficial = false;

  let itensBrutos: Licitacao[];
  try {
    const resultadoBusca = await buscarViaApiInterna({
      q: q.trim() || undefined,
      ufs: ufFiltro ? [ufFiltro] : undefined,
      signal: request.signal,
    });
    itensBrutos = resultadoBusca.itens;
    parcial = resultadoBusca.parcial;
  } catch {
    // API de busca interna indisponível — cai para a API oficial, que exige
    // modalidade e data final explícitos (ver pncp-client.ts).
    usouFallbackOficial = true;

    const codigosModalidade = modalidades.length
      ? modalidades
          .map((nome) => MODALIDADES.find((m) => modalidadesCorrespondem(m.nome, nome))?.codigoPncp)
          .filter((codigo): codigo is number => codigo !== undefined)
      : undefined;
    const codigoMunicipioFiltro = municipio && municipio !== "TODOS" ? municipio : undefined;

    let resultadoOficial: { itens: Licitacao[]; parcial: boolean } | undefined;
    try {
      const resposta = await buscarContratacoesPncp({
        dataFinal: fimEfetivo,
        codigosModalidade,
        uf: ufFiltro,
        codigoMunicipioIbge: codigoMunicipioFiltro,
        signal: request.signal,
      });
      if (!resposta.todasFalharam) resultadoOficial = resposta;
    } catch {
      // segue para a terceira fonte, abaixo
    }

    if (resultadoOficial) {
      itensBrutos = resultadoOficial.itens;
      parcial = resultadoOficial.parcial;
    } else {
      // Terceira fonte: Compras.gov.br, infraestrutura independente do
      // pncp.gov.br — as duas fontes acima falharam juntas. Ela não aplica
      // limite de encerramento no servidor (só filtra por publicação), por
      // isso NÃO conta como "usouFallbackOficial" — o filtro local de
      // fimEfetivo abaixo precisa reforçar o corte, como já faz pra fonte
      // primária.
      usouFallbackOficial = false;

      let resultadoCompras;
      try {
        resultadoCompras = await buscarContratacoesCompras({
          codigosModalidade,
          uf: ufFiltro,
          codigoMunicipioIbge: codigoMunicipioFiltro,
          signal: request.signal,
        });
      } catch {
        return respostaErroServidor();
      }

      if (resultadoCompras.todasFalharam) {
        return respostaErroServidor();
      }

      itensBrutos = resultadoCompras.itens;
      parcial = resultadoCompras.parcial;
    }
  }

  resultadoPrincipal = itensBrutos.map((item) => ({
    ...item,
    portal: identificarPortal(item.linkSistemaOrigem).nome,
  }));

  // Limite inferior (inicioEfetivo): reforçado para as duas fontes — nenhuma
  // das duas garante sozinha que só devolve licitações ainda em aberto.
  if (inicioEfetivo) {
    resultadoPrincipal = resultadoPrincipal.filter((item) => {
      if (!item.dataEncerramento) return false;
      return new Date(item.dataEncerramento) >= inicioEfetivo;
    });
  }
  // Limite superior (fimEfetivo): só precisa ser reforçado aqui para a fonte
  // primária (a oficial já recebeu esse limite na própria requisição).
  if (!usouFallbackOficial) {
    resultadoPrincipal = resultadoPrincipal.filter((item) => {
      if (!item.dataEncerramento) return false;
      return new Date(item.dataEncerramento) <= fimEfetivo;
    });
  }

  // Modalidade e município: a API de busca interna não filtra nenhum dos
  // dois (e a oficial usa um id de município próprio, não o IBGE) — por
  // isso os dois são sempre reforçados aqui, para as duas fontes.
  if (modalidades.length > 0) {
    resultadoPrincipal = resultadoPrincipal.filter(
      (item) => item.modalidade && modalidades.some((nome) => modalidadesCorrespondem(item.modalidade!, nome)),
    );
  }
  if (municipio && municipio !== "TODOS") {
    const nomeMunicipioFiltro = ufFiltro
      ? MUNICIPIOS_POR_UF[ufFiltro]?.find((m) => m.codigoIbge === municipio)?.nome
      : undefined;
    resultadoPrincipal = resultadoPrincipal.filter((item) => {
      if (item.codigoMunicipioIbge) return item.codigoMunicipioIbge === municipio;
      if (!nomeMunicipioFiltro || !item.municipio) return false;
      return normalizarTexto(item.municipio) === normalizarTexto(nomeMunicipioFiltro);
    });
  }

  // Só reforçado aqui para a fonte oficial, que não tem busca por texto (o
  // filtro que ela recebeu foi aplicado no lado do PNCP). Para a fonte
  // primária, o `q` já foi usado na própria busca — refiltrar aqui por um
  // match literal em objeto/órgão poderia descartar resultados que a busca
  // do PNCP considerou válidos por outros critérios (ex.: outro campo).
  if (q.trim() && usouFallbackOficial) {
    resultadoPrincipal = resultadoPrincipal.filter(
      (item) => contemTexto(item.objeto, q) || contemTexto(item.orgao, q),
    );
  }
  if (valorMinimo !== undefined && Number.isFinite(valorMinimo)) {
    resultadoPrincipal = resultadoPrincipal.filter(
      (item) => item.valorEstimado !== undefined && item.valorEstimado >= valorMinimo,
    );
  }
  if (valorMaximo !== undefined && Number.isFinite(valorMaximo)) {
    resultadoPrincipal = resultadoPrincipal.filter(
      (item) => item.valorEstimado !== undefined && item.valorEstimado <= valorMaximo,
    );
  }
  if (orgao.trim()) {
    resultadoPrincipal = resultadoPrincipal.filter((item) => contemTexto(item.orgao, orgao));
  }
  if (numeroLicitacao.trim()) {
    resultadoPrincipal = resultadoPrincipal.filter((item) => contemTexto(item.numeroLicitacao, numeroLicitacao));
  }
  if (situacao.trim()) {
    resultadoPrincipal = resultadoPrincipal.filter((item) => contemTexto(item.situacao, situacao));
  }

  // Facetas: refletem a pesquisa aplicada (acima), nunca os refinamentos
  // rápidos da tabela — assim os dropdowns de Modalidade/Local/Portal da
  // tabela nunca colapsam para uma única opção depois de usados.
  const facets = {
    modalidades: Array.from(new Set(resultadoPrincipal.map((i) => i.modalidade).filter(Boolean))).sort((a, b) =>
      (a as string).localeCompare(b as string, "pt-BR"),
    ) as string[],
    portais: Array.from(new Set(resultadoPrincipal.map((i) => i.portal).filter(Boolean))).sort((a, b) =>
      (a as string).localeCompare(b as string, "pt-BR"),
    ) as string[],
    municipios: Array.from(
      new Map(
        resultadoPrincipal
          .filter((i) => i.municipio)
          .map((i) => [chaveMunicipio(i) as string, { codigoIbge: chaveMunicipio(i) as string, nome: i.municipio as string }]),
      ).values(),
    ).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };

  const totalFiltrado = resultadoPrincipal.length;
  // Ordenação de verdade (o que o usuário escolhe em "Ordenar por") acontece
  // no cliente (ver lib/data/dominio.ts e components/DashboardClient.tsx) —
  // nenhuma das três fontes aceita esse parâmetro, então reordenar aqui a
  // cada troca só reconsultaria a cascata à toa. Aplicamos só uma ordem
  // padrão sensata pra quem consumir esta API diretamente.
  const ordenados = ordenar(resultadoPrincipal, "encerramento_asc");

  const summary = {
    total: totalFiltrado,
    pregoes: resultadoPrincipal.filter((i) => grupoDaModalidade(i.modalidade) === "pregao").length,
    dispensas: resultadoPrincipal.filter((i) => grupoDaModalidade(i.modalidade) === "dispensa").length,
    outras: resultadoPrincipal.filter((i) => grupoDaModalidade(i.modalidade) === "outra").length,
  };

  // Sem paginação nem refinamentos rápidos (Modalidade/Local/Portal da
  // tabela) aqui de propósito: o servidor devolve todos os itens que casam
  // com a pesquisa aplicada, e o cliente é quem recorta em páginas e aplica
  // os refinamentos rápidos (ver components/DashboardClient.tsx). Reconsultar
  // a cada clique de página ou de refinamento batia de novo na cascata de
  // fontes — instáveis por natureza — e podia trazer um resultado de uma
  // fonte diferente da que gerou as opções que o usuário via na tela.
  const resposta: LicitacoesResponse = {
    items: ordenados,
    total: totalFiltrado,
    summary,
    facets,
    meta: {
      consultadoEm: new Date().toISOString(),
      tempoRespostaMs: Date.now() - inicioRequisicao,
      parcial,
    },
  };

  return NextResponse.json(resposta);
}
