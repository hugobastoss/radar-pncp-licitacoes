import { normalizarCnpj } from "@/lib/cnpj";
import { MODALIDADES } from "@/lib/data/dominio";
import { formatarCnpj, montarNumeroLicitacao } from "@/lib/formatters";
import type { Licitacao } from "@/types/licitacao";

/**
 * Cliente da API PÚBLICA de consulta do PNCP.
 *
 * Baseado no Manual de Integração PNCP (consulta pública, sem autenticação):
 * https://www.gov.br/pncp/pt-br/acesso-a-informacao/manuais
 *
 * Duas limitações importantes desta API moldam este arquivo inteiro:
 *
 * 1. Não existe busca por texto livre — o endpoint só filtra por data,
 *    modalidade, UF, município e CNPJ. A busca por palavra-chave (`q`),
 *    órgão, número da licitação, situação e faixa de valor é aplicada
 *    DEPOIS, em app/api/licitacoes/route.ts, sobre o resultado agregado.
 * 2. `codigoModalidadeContratacao` é obrigatório em cada chamada — não há
 *    "buscar todas as modalidades" numa requisição só. Por isso
 *    `buscarContratacoesPncp` dispara uma chamada por modalidade em
 *    paralelo e agrega o resultado.
 */

const BASE_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";
const TIMEOUT_POR_MODALIDADE_MS = 10000;
const TAMANHO_PAGINA_POR_MODALIDADE = 50;

export interface ParametrosBuscaPncp {
  /** Data final do período de propostas em aberto — único filtro de data aceito por este endpoint. */
  dataFinal: Date;
  /** Códigos PNCP das modalidades a consultar; se vazio, consulta as 13 em paralelo. */
  codigosModalidade?: number[];
  uf?: string;
  codigoMunicipioIbge?: string;
  signal?: AbortSignal;
}

export interface ResultadoBuscaPncp {
  itens: Licitacao[];
  /** true quando alguma modalidade falhou ou tinha mais páginas do que buscamos. */
  parcial: boolean;
  /** true quando TODAS as chamadas falharam — sinal de indisponibilidade, não de busca vazia. */
  todasFalharam: boolean;
}

// --- Formato bruto devolvido pela API (campos usados; o restante é ignorado) --
interface OrgaoEntidadePncp {
  cnpj?: string;
  razaosocial?: string;
}

interface UnidadeOrgaoPncp {
  codigoIbge?: number | string;
  municipioNome?: string;
  ufSigla?: string;
}

interface ContratacaoPncp {
  numeroControlePNCP?: string;
  numeroCompra?: string;
  anoCompra?: number;
  sequencialCompra?: number;
  modalidadeNome?: string;
  modoDisputaNome?: string;
  situacaoCompraNome?: string;
  objetoCompra?: string;
  valorTotalEstimado?: number;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  orgaoEntidade?: OrgaoEntidadePncp;
  unidadeOrgao?: UnidadeOrgaoPncp;
  linkSistemaOrigem?: string;
}

interface PaginaContratacoesPncp {
  data: ContratacaoPncp[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
}

/**
 * O PNCP devolve datas/horas sem indicação de fuso (ex.: "2026-09-20T10:00:00"),
 * mas já no horário de Brasília. Fixamos o deslocamento (-03:00, sem horário
 * de verão desde 2019) para virar um instante UTC correto — o mesmo padrão
 * já usado em app/api/licitacoes/route.ts para o cálculo do período de busca.
 */
function horarioBrasiliaParaIso(dataHoraSemFuso: string | undefined): string | undefined {
  if (!dataHoraSemFuso) return undefined;
  const instante = new Date(`${dataHoraSemFuso}-03:00`);
  if (Number.isNaN(instante.getTime())) return undefined;
  return instante.toISOString();
}

function formatarDataFinalPncp(data: Date): string {
  const emBrasilia = new Date(data.getTime() - 3 * 60 * 60 * 1000);
  const ano = emBrasilia.getUTCFullYear();
  const mes = String(emBrasilia.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(emBrasilia.getUTCDate()).padStart(2, "0");
  return `${ano}${mes}${dia}`;
}

function mapearParaLicitacao(raw: ContratacaoPncp): Licitacao | undefined {
  // Sem número de controle não há como formar um id estável nem o link do PNCP.
  if (!raw.numeroControlePNCP) return undefined;

  const cnpj = raw.orgaoEntidade?.cnpj;
  const cnpjNormalizado = cnpj ? normalizarCnpj(cnpj) : undefined;
  const numeroLicitacao = montarNumeroLicitacao(raw.numeroCompra, raw.anoCompra);

  return {
    id: raw.numeroControlePNCP,
    numeroLicitacao,
    numeroControlePNCP: raw.numeroControlePNCP,
    orgao: raw.orgaoEntidade?.razaosocial,
    cnpjOrgao: formatarCnpj(cnpj),
    objeto: raw.objetoCompra,
    modalidade: raw.modalidadeNome,
    modoDisputa: raw.modoDisputaNome,
    municipio: raw.unidadeOrgao?.municipioNome,
    uf: raw.unidadeOrgao?.ufSigla,
    codigoMunicipioIbge:
      raw.unidadeOrgao?.codigoIbge !== undefined ? String(raw.unidadeOrgao.codigoIbge) : undefined,
    valorEstimado: raw.valorTotalEstimado,
    dataAbertura: horarioBrasiliaParaIso(raw.dataAberturaProposta),
    dataEncerramento: horarioBrasiliaParaIso(raw.dataEncerramentoProposta),
    situacao: raw.situacaoCompraNome,
    linkSistemaOrigem: raw.linkSistemaOrigem,
    linkPNCP:
      cnpjNormalizado && raw.anoCompra && raw.sequencialCompra
        ? `https://pncp.gov.br/app/editais/${cnpjNormalizado}/${raw.anoCompra}/${raw.sequencialCompra}`
        : undefined,
  };
}

async function buscarPorModalidade(
  codigoModalidade: number,
  parametros: ParametrosBuscaPncp,
): Promise<{ itens: Licitacao[]; parcial: boolean }> {
  const query = new URLSearchParams({
    dataFinal: formatarDataFinalPncp(parametros.dataFinal),
    codigoModalidadeContratacao: String(codigoModalidade),
    pagina: "1",
    tamanhoPagina: String(TAMANHO_PAGINA_POR_MODALIDADE),
  });
  if (parametros.uf) query.set("uf", parametros.uf);
  if (parametros.codigoMunicipioIbge) query.set("codigoMunicipioIbge", parametros.codigoMunicipioIbge);

  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_POR_MODALIDADE_MS)];
  if (parametros.signal) sinaisAbortar.push(parametros.signal);

  const resposta = await fetch(`${BASE_URL}?${query.toString()}`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/json" },
  });

  // 204 = nenhuma contratação encontrada para essa modalidade nesse período — não é erro.
  if (resposta.status === 204) return { itens: [], parcial: false };
  if (!resposta.ok) {
    throw new Error(`PNCP respondeu ${resposta.status} para modalidade ${codigoModalidade}`);
  }

  const pagina = (await resposta.json()) as PaginaContratacoesPncp;
  const itens = (pagina.data ?? [])
    .map(mapearParaLicitacao)
    .filter((item): item is Licitacao => item !== undefined);

  // Só buscamos a primeira página de cada modalidade — se havia mais, o
  // resultado agregado está incompleto (ver campo `parcial` na resposta).
  const parcial = (pagina.totalPaginas ?? 1) > 1;

  return { itens, parcial };
}

export async function buscarContratacoesPncp(parametros: ParametrosBuscaPncp): Promise<ResultadoBuscaPncp> {
  const codigos = parametros.codigosModalidade?.length
    ? parametros.codigosModalidade
    : MODALIDADES.map((m) => m.codigoPncp);

  const resultados = await Promise.allSettled(codigos.map((codigo) => buscarPorModalidade(codigo, parametros)));

  const itens: Licitacao[] = [];
  let parcial = false;

  for (const resultado of resultados) {
    if (resultado.status === "fulfilled") {
      itens.push(...resultado.value.itens);
      if (resultado.value.parcial) parcial = true;
    } else {
      // Uma modalidade falhou (timeout, 5xx, rede) — as demais seguem valendo,
      // mas o total deixa de ser exato.
      parcial = true;
    }
  }

  const todasFalharam = resultados.length > 0 && resultados.every((r) => r.status === "rejected");

  return { itens, parcial, todasFalharam };
}
