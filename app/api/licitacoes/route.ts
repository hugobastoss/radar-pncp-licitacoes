import { NextRequest, NextResponse } from "next/server";
import { buscarContratacoesPncp } from "@/lib/server/pncp-client";
import { buscarViaApiInterna } from "@/lib/server/pncp-search-client";
import { identificarPortal } from "@/lib/portal";
import { grupoDaModalidade, modalidadesCorrespondem, MODALIDADES } from "@/lib/data/dominio";
import { MUNICIPIOS_POR_UF } from "@/lib/data/municipios";
import type { Licitacao, LicitacoesResponse, OrdenacaoOpcao } from "@/types/licitacao";

/**
 * /api/licitacoes — camada de BACKEND do Next.js. Busca real no PNCP, com
 * DUAS fontes em cascata:
 *   1. lib/server/pncp-search-client.ts — a API de busca não-documentada
 *      que sustenta pncp.gov.br/app/editais. Rápida e com texto livre, mas
 *      pode mudar sem aviso por não ser um contrato oficial.
 *   2. lib/server/pncp-client.ts — a API de consulta OFICIAL (Manual de
 *      Integração PNCP). Usada só quando a primeira falha: mais lenta (uma
 *      chamada por modalidade) e sem busca por texto.
 *
 * Nenhuma das duas fontes filtra por órgão, número da licitação, situação
 * ou faixa de valor — por isso esses filtros (e modalidade/município, como
 * rede de segurança) são sempre aplicados aqui, sobre o resultado agregado.
 */

export const dynamic = "force-dynamic";

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

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

function calcularJanelaPeriodo(
  periodo: string | null,
  dataInicial: string | null,
  dataFinal: string | null,
): { inicio?: Date; fim?: Date } {
  if (periodo === "personalizado") {
    return {
      inicio: dataInicial ? limiteDoDiaBrasilia(dataInicial, false) : undefined,
      fim: dataFinal ? limiteDoDiaBrasilia(dataFinal, true) : undefined,
    };
  }

  const dias = periodo ? Number.parseInt(periodo, 10) : NaN;
  if (!Number.isFinite(dias) || dias <= 0) return {};

  const agora = new Date();
  return { inicio: agora, fim: finalDoDiaBrasiliaMaisDias(agora, dias) };
}

// Quando nenhum período é escolhido, a API do PNCP ainda assim exige uma
// data final — usamos uma janela ampla o bastante para não perder
// oportunidades relevantes sem tornar a consulta absurdamente longa.
const DIAS_JANELA_PADRAO = 180;

function ordenar(itens: Licitacao[], ordenarPor: OrdenacaoOpcao | null): Licitacao[] {
  const copia = [...itens];
  const tempo = (data?: string) => (data ? new Date(data).getTime() : Number.POSITIVE_INFINITY);

  switch (ordenarPor) {
    case "encerramento_desc":
      return copia.sort((a, b) => tempo(b.dataEncerramento) - tempo(a.dataEncerramento));
    case "valor_desc":
      return copia.sort((a, b) => (b.valorEstimado ?? -1) - (a.valorEstimado ?? -1));
    case "valor_asc":
      return copia.sort((a, b) => (a.valorEstimado ?? Number.POSITIVE_INFINITY) - (b.valorEstimado ?? Number.POSITIVE_INFINITY));
    case "municipio_asc":
      return copia.sort((a, b) => (a.municipio ?? "").localeCompare(b.municipio ?? "", "pt-BR"));
    case "portal_asc":
      return copia.sort((a, b) => (a.portal ?? "").localeCompare(b.portal ?? "", "pt-BR"));
    case "encerramento_asc":
    default:
      return copia.sort((a, b) => tempo(a.dataEncerramento) - tempo(b.dataEncerramento));
  }
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
  const periodo = params.get("periodo");
  const dataInicial = params.get("dataInicial");
  const dataFinal = params.get("dataFinal");
  const modalidades = params.getAll("modalidade").filter(Boolean);
  const portais = params.getAll("portal").filter(Boolean);
  const valorMinimo = params.has("valorMinimo") ? Number(params.get("valorMinimo")) : undefined;
  const valorMaximo = params.has("valorMaximo") ? Number(params.get("valorMaximo")) : undefined;
  const orgao = params.get("orgao") ?? "";
  const numeroLicitacao = params.get("numeroLicitacao") ?? "";
  const situacao = params.get("situacao") ?? "";
  const ordenarPor = params.get("ordenarPor") as OrdenacaoOpcao | null;
  const pagina = Math.max(1, Number.parseInt(params.get("pagina") ?? "1", 10) || 1);
  const tamanhoPagina = Math.min(100, Math.max(5, Number.parseInt(params.get("tamanhoPagina") ?? "25", 10) || 25));

  // Refinamentos rápidos da tabela (seção 11): aplicados DEPOIS do cálculo
  // das facetas, para que os três dropdowns da tabela continuem oferecendo
  // todas as opções presentes na pesquisa aplicada, mesmo quando um deles
  // já está em uso.
  const modalidadeRapida = params.get("modalidadeRapida") ?? "";
  const localRapido = params.get("localRapido") ?? "";
  const portalRapido = params.get("portalRapido") ?? "";

  const { inicio, fim } = calcularJanelaPeriodo(periodo, dataInicial, dataFinal);

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
    // API de busca interna indisponível — cai para a API oficial, que
    // exige modalidade e data final explícitos (ver pncp-client.ts).
    usouFallbackOficial = true;

    const codigosModalidade = modalidades.length
      ? modalidades
          .map((nome) => MODALIDADES.find((m) => modalidadesCorrespondem(m.nome, nome))?.codigoPncp)
          .filter((codigo): codigo is number => codigo !== undefined)
      : undefined;

    let resultadoPncp;
    try {
      resultadoPncp = await buscarContratacoesPncp({
        dataFinal: fim ?? finalDoDiaBrasiliaMaisDias(new Date(), DIAS_JANELA_PADRAO),
        codigosModalidade,
        uf: ufFiltro,
        codigoMunicipioIbge: municipio && municipio !== "TODOS" ? municipio : undefined,
        signal: request.signal,
      });
    } catch {
      return respostaErroServidor();
    }

    if (resultadoPncp.todasFalharam) {
      return respostaErroServidor();
    }

    itensBrutos = resultadoPncp.itens;
    parcial = resultadoPncp.parcial;
  }

  resultadoPrincipal = itensBrutos.map((item) => ({
    ...item,
    portal: identificarPortal(item.linkSistemaOrigem).nome,
  }));

  // A API oficial já filtra pela data final na própria chamada; a de busca
  // interna não tem filtro de data nenhum — em ambos os casos o limite
  // inferior do período, quando informado, é aplicado aqui.
  if (inicio) {
    resultadoPrincipal = resultadoPrincipal.filter((item) => {
      if (!item.dataEncerramento) return false;
      return new Date(item.dataEncerramento) >= inicio;
    });
  }
  // Data final: só precisa ser reforçada aqui para a API de busca interna
  // (a oficial já recebeu esse limite na própria requisição).
  if (fim && !usouFallbackOficial) {
    resultadoPrincipal = resultadoPrincipal.filter((item) => {
      if (!item.dataEncerramento) return false;
      return new Date(item.dataEncerramento) <= fim;
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

  if (q.trim()) {
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
  if (portais.length > 0) {
    const normalizados = portais.map(normalizarTexto);
    resultadoPrincipal = resultadoPrincipal.filter(
      (item) => item.portal && normalizados.includes(normalizarTexto(item.portal)),
    );
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
          .filter((i) => i.codigoMunicipioIbge && i.municipio)
          .map((i) => [
            i.codigoMunicipioIbge as string,
            { codigoIbge: i.codigoMunicipioIbge as string, nome: i.municipio as string },
          ]),
      ).values(),
    ).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };

  // Refinamentos rápidos aplicados por cima do resultado principal.
  let resultadoFinal = resultadoPrincipal;
  if (modalidadeRapida) {
    resultadoFinal = resultadoFinal.filter(
      (item) => normalizarTexto(item.modalidade ?? "") === normalizarTexto(modalidadeRapida),
    );
  }
  if (localRapido) {
    resultadoFinal = resultadoFinal.filter((item) => item.codigoMunicipioIbge === localRapido);
  }
  if (portalRapido) {
    resultadoFinal = resultadoFinal.filter(
      (item) => normalizarTexto(item.portal ?? "") === normalizarTexto(portalRapido),
    );
  }

  const totalFiltrado = resultadoFinal.length;
  const ordenados = ordenar(resultadoFinal, ordenarPor);

  const totalPages = Math.max(1, Math.ceil(totalFiltrado / tamanhoPagina));
  const paginaValida = Math.min(pagina, totalPages);
  const inicioPagina = (paginaValida - 1) * tamanhoPagina;
  const itensPagina = ordenados.slice(inicioPagina, inicioPagina + tamanhoPagina);

  const summary = {
    total: totalFiltrado,
    pregoes: resultadoFinal.filter((i) => grupoDaModalidade(i.modalidade) === "pregao").length,
    dispensas: resultadoFinal.filter((i) => grupoDaModalidade(i.modalidade) === "dispensa").length,
    outras: resultadoFinal.filter((i) => grupoDaModalidade(i.modalidade) === "outra").length,
  };

  const resposta: LicitacoesResponse = {
    items: itensPagina,
    page: paginaValida,
    pageSize: tamanhoPagina,
    total: totalFiltrado,
    totalPages,
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
