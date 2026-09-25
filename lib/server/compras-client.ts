import { MODALIDADES } from "@/lib/data/dominio";
import { formatarCnpj, montarNumeroLicitacao } from "@/lib/formatters";
import type { Licitacao } from "@/types/licitacao";

/**
 * Cliente da API de Dados Abertos do Compras.gov.br — infraestrutura
 * DIFERENTE do pncp.gov.br (mesmos dados de contratações da Lei 14.133,
 * hospedados separadamente). Usado como ÚLTIMO fallback, só quando as duas
 * fontes do pncp.gov.br (busca interna e consulta oficial) falham juntas —
 * o que já aconteceu várias vezes durante o desenvolvimento deste app.
 *
 * Mesma limitação da API oficial do PNCP: sem busca por texto livre, exige
 * modalidade obrigatória. Diferença importante: o período obrigatório aqui
 * é de PUBLICAÇÃO (dataPublicacaoPncpInicial/Final), não de encerramento da
 * proposta — por isso buscamos uma janela ampla de publicação e deixamos o
 * filtro de encerramento (inicioEfetivo/fimEfetivo em route.ts) fazer o
 * corte fino, do mesmo jeito que já é feito para a fonte primária.
 */

const BASE_URL = "https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133";
const TIMEOUT_POR_MODALIDADE_MS = 10000;
const TAMANHO_PAGINA_POR_MODALIDADE = 100;
const DIAS_JANELA_PUBLICACAO = 90;

export interface ParametrosBuscaCompras {
  /** Códigos PNCP das modalidades a consultar; se vazio, consulta as 13 em paralelo. */
  codigosModalidade?: number[];
  uf?: string;
  codigoMunicipioIbge?: string;
  signal?: AbortSignal;
}

export interface ResultadoBuscaCompras {
  itens: Licitacao[];
  parcial: boolean;
  todasFalharam: boolean;
}

interface ContratacaoCompras {
  numeroControlePNCP?: string;
  anoCompraPncp?: number;
  sequencialCompraPncp?: number;
  numeroCompra?: string;
  orgaoEntidadeCnpj?: string;
  orgaoEntidadeRazaoSocial?: string;
  unidadeOrgaoUfSigla?: string;
  unidadeOrgaoMunicipioNome?: string;
  unidadeOrgaoCodigoIbge?: number | string;
  modalidadeNome?: string;
  modoDisputaNomePncp?: string;
  objetoCompra?: string;
  valorTotalEstimado?: number;
  dataAberturaPropostaPncp?: string;
  dataEncerramentoPropostaPncp?: string;
  situacaoCompraNomePncp?: string;
}

interface RespostaCompras {
  resultado?: ContratacaoCompras[];
  totalPaginas?: number;
}

function formatarDataYYYYMMDD(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Mesmo tratamento de fuso que lib/server/pncp-client.ts — ver comentário lá. */
function horarioBrasiliaParaIso(dataHoraSemFuso: string | undefined): string | undefined {
  if (!dataHoraSemFuso) return undefined;
  const instante = new Date(`${dataHoraSemFuso}-03:00`);
  if (Number.isNaN(instante.getTime())) return undefined;
  return instante.toISOString();
}

function mapearParaLicitacao(raw: ContratacaoCompras): Licitacao | undefined {
  if (!raw.numeroControlePNCP) return undefined;

  const cnpjDigitos = raw.orgaoEntidadeCnpj;
  const numeroLicitacao = montarNumeroLicitacao(raw.numeroCompra, raw.anoCompraPncp);

  return {
    id: raw.numeroControlePNCP,
    numeroLicitacao,
    numeroControlePNCP: raw.numeroControlePNCP,
    orgao: raw.orgaoEntidadeRazaoSocial,
    cnpjOrgao: formatarCnpj(raw.orgaoEntidadeCnpj),
    objeto: raw.objetoCompra,
    modalidade: raw.modalidadeNome,
    modoDisputa: raw.modoDisputaNomePncp,
    municipio: raw.unidadeOrgaoMunicipioNome,
    uf: raw.unidadeOrgaoUfSigla,
    codigoMunicipioIbge: raw.unidadeOrgaoCodigoIbge !== undefined ? String(raw.unidadeOrgaoCodigoIbge) : undefined,
    valorEstimado: raw.valorTotalEstimado,
    dataAbertura: horarioBrasiliaParaIso(raw.dataAberturaPropostaPncp),
    dataEncerramento: horarioBrasiliaParaIso(raw.dataEncerramentoPropostaPncp),
    situacao: raw.situacaoCompraNomePncp,
    linkPNCP:
      cnpjDigitos && raw.anoCompraPncp && raw.sequencialCompraPncp
        ? `https://pncp.gov.br/app/editais/${cnpjDigitos}/${raw.anoCompraPncp}/${raw.sequencialCompraPncp}`
        : undefined,
    // `linkSistemaOrigem` não existe nesta API — portal aparece como "não informado".
  };
}

async function buscarPorModalidade(
  codigoModalidade: number,
  parametros: ParametrosBuscaCompras,
): Promise<{ itens: Licitacao[]; parcial: boolean }> {
  const hoje = new Date();
  const inicioPublicacao = new Date(hoje.getTime() - DIAS_JANELA_PUBLICACAO * 24 * 60 * 60 * 1000);

  const query = new URLSearchParams({
    dataPublicacaoPncpInicial: formatarDataYYYYMMDD(inicioPublicacao),
    dataPublicacaoPncpFinal: formatarDataYYYYMMDD(hoje),
    codigoModalidade: String(codigoModalidade),
    pagina: "1",
    tamanhoPagina: String(TAMANHO_PAGINA_POR_MODALIDADE),
  });
  if (parametros.uf) query.set("unidadeOrgaoUfSigla", parametros.uf);
  if (parametros.codigoMunicipioIbge) query.set("unidadeOrgaoCodigoIbge", parametros.codigoMunicipioIbge);

  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_POR_MODALIDADE_MS)];
  if (parametros.signal) sinaisAbortar.push(parametros.signal);

  const resposta = await fetch(`${BASE_URL}?${query.toString()}`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/json" },
  });

  if (resposta.status === 204) return { itens: [], parcial: false };
  if (!resposta.ok) {
    throw new Error(`Compras.gov.br respondeu ${resposta.status} para modalidade ${codigoModalidade}`);
  }

  const pagina = (await resposta.json()) as RespostaCompras;
  const itens = (pagina.resultado ?? [])
    .map(mapearParaLicitacao)
    .filter((item): item is Licitacao => item !== undefined);

  const parcial = (pagina.totalPaginas ?? 1) > 1;

  return { itens, parcial };
}

export async function buscarContratacoesCompras(parametros: ParametrosBuscaCompras): Promise<ResultadoBuscaCompras> {
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
      parcial = true;
    }
  }

  const todasFalharam = resultados.length > 0 && resultados.every((r) => r.status === "rejected");

  return { itens, parcial, todasFalharam };
}
