import { NextRequest, NextResponse } from "next/server";
import { obterLicitacoesDemo } from "@/lib/server/mock-licitacoes";
import { identificarPortal } from "@/lib/portal";
import { grupoDaModalidade } from "@/lib/data/dominio";
import type {
  Licitacao,
  LicitacoesResponse,
  OrdenacaoOpcao,
  CenarioDemo,
} from "@/types/licitacao";

/**
 * /api/licitacoes — camada de BACKEND do Next.js.
 *
 * Hoje esta rota responde com dados fictícios gerados em memória
 * (lib/server/mock-licitacoes.ts). Quando a integração real com o PNCP for
 * implementada, apenas o CORPO desta função muda — a assinatura do
 * endpoint, os parâmetros aceitos e o formato da resposta (LicitacoesResponse)
 * já são o contrato definitivo consumido pelo frontend, então nenhum
 * componente de tela precisa mudar.
 *
 * Nenhum resultado é armazenado: os dados são recalculados a cada requisição
 * a partir do conjunto em memória, sem banco de dados.
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

function aguardar(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

export async function GET(request: NextRequest) {
  const inicioRequisicao = Date.now();
  const params = request.nextUrl.searchParams;

  const cenario = (params.get("cenario") as CenarioDemo | null) ?? "auto";

  // --- Cenários de demonstração (apenas para QA visual do frontend) -------
  // "erro_conexao" é tratado inteiramente no cliente (lib/api.ts), simulando
  // uma falha de rede antes mesmo de chamar esta rota.
  if (cenario === "erro_servidor") {
    await aguardar(500);
    return NextResponse.json(
      { erro: "Não foi possível concluir a consulta neste momento." },
      { status: 502 },
    );
  }

  if (cenario === "timeout") {
    // Atraso deliberadamente maior que o timeout do cliente (ver lib/api.ts),
    // para exercitar o estado de "O PNCP demorou para responder".
    try {
      await aguardar(20000, request.signal);
    } catch {
      // requisição abortada pelo cliente — nada a fazer.
    }
    return NextResponse.json({ erro: "Tempo de resposta excedido." }, { status: 504 });
  }

  const latenciaSimulada = cenario === "lento" ? inteiroDe(3200, 4200) : inteiroDe(500, 1300);
  try {
    await aguardar(latenciaSimulada, request.signal);
  } catch {
    return new NextResponse(null, { status: 499 });
  }

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

  const base = obterLicitacoesDemo().map((item) => ({
    ...item,
    portal: identificarPortal(item.linkSistemaOrigem).nome,
  }));

  let resultadoPrincipal = base;

  if (cenario === "vazio") {
    resultadoPrincipal = [];
  } else if (cenario === "sucesso") {
    // Ignora deliberadamente os filtros recebidos: serve para visualizar o
    // estado de sucesso (tabela populada) a qualquer momento durante o
    // desenvolvimento, independentemente do que esteja preenchido no formulário.
    resultadoPrincipal = base;
  } else {
    if (q.trim()) {
      resultadoPrincipal = resultadoPrincipal.filter(
        (item) => contemTexto(item.objeto, q) || contemTexto(item.orgao, q),
      );
    }
    if (uf && uf !== "TODOS") {
      resultadoPrincipal = resultadoPrincipal.filter((item) => item.uf === uf);
    }
    if (municipio && municipio !== "TODOS") {
      resultadoPrincipal = resultadoPrincipal.filter((item) => item.codigoMunicipioIbge === municipio);
    }
    if (inicio || fim) {
      resultadoPrincipal = resultadoPrincipal.filter((item) => {
        if (!item.dataEncerramento) return false;
        const dataItem = new Date(item.dataEncerramento);
        if (inicio && dataItem < inicio) return false;
        if (fim && dataItem > fim) return false;
        return true;
      });
    }
    if (modalidades.length > 0) {
      const normalizadas = modalidades.map(normalizarTexto);
      resultadoPrincipal = resultadoPrincipal.filter(
        (item) => item.modalidade && normalizadas.includes(normalizarTexto(item.modalidade)),
      );
    }
    if (portais.length > 0) {
      const normalizados = portais.map(normalizarTexto);
      resultadoPrincipal = resultadoPrincipal.filter(
        (item) => item.portal && normalizados.includes(normalizarTexto(item.portal)),
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
      fonte: "demonstracao",
      consultadoEm: new Date().toISOString(),
      tempoRespostaMs: Date.now() - inicioRequisicao,
      parcial: false,
    },
  };

  return NextResponse.json(resposta);
}

function inteiroDe(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
