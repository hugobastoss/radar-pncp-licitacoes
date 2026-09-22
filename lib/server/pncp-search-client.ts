import type { Licitacao } from "@/types/licitacao";

/**
 * Cliente da API de BUSCA do PNCP — a mesma usada por trás do campo de
 * pesquisa em pncp.gov.br/app/editais.
 *
 * IMPORTANTE: esta API não é documentada no Manual de Integração oficial do
 * PNCP (essa é lib/server/pncp-client.ts). É usada aqui como fonte PRIMÁRIA
 * porque, ao contrário da oficial, tem busca por texto livre e responde
 * rápido — mas por não ser um contrato público, pode mudar sem aviso. Por
 * isso app/api/licitacoes/route.ts sempre trata falhas daqui como sinal
 * para cair na API oficial (fallback), nunca como "sem resultados".
 */

const BASE_URL = "https://pncp.gov.br/api/search/";
const TIMEOUT_MS = 8000;
const TAMANHO_PAGINA = 100;

export interface ParametrosBuscaInterna {
  q?: string;
  /** Siglas de UF (ex.: ["AM", "PA"]); vazio busca o Brasil todo. */
  ufs?: string[];
  signal?: AbortSignal;
}

export interface ResultadoBuscaInterna {
  itens: Licitacao[];
  /** true quando havia mais resultados do que a página buscada. */
  parcial: boolean;
}

interface ItemBuscaInterna {
  numero_controle_pncp?: string;
  numero_sequencial?: string;
  ano?: string | number;
  orgao_cnpj?: string;
  orgao_nome?: string;
  municipio_nome?: string;
  uf?: string;
  modalidade_licitacao_nome?: string;
  situacao_nome?: string;
  description?: string;
  valor_global?: number | null;
  data_inicio_vigencia?: string;
  data_fim_vigencia?: string;
  item_url?: string;
  cancelado?: boolean;
}

interface RespostaBuscaInterna {
  items: ItemBuscaInterna[];
  total: number;
}

function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

function formatarCnpj(cnpj: string | undefined): string | undefined {
  if (!cnpj) return undefined;
  const digitos = apenasDigitos(cnpj);
  if (digitos.length !== 14) return cnpj;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12, 14)}`;
}

/** Mesmo tratamento de fuso que lib/server/pncp-client.ts — ver comentário lá. */
function horarioBrasiliaParaIso(dataHoraSemFuso: string | undefined): string | undefined {
  if (!dataHoraSemFuso) return undefined;
  const instante = new Date(`${dataHoraSemFuso}-03:00`);
  if (Number.isNaN(instante.getTime())) return undefined;
  return instante.toISOString();
}

function montarLinkPncp(raw: ItemBuscaInterna): string | undefined {
  // `item_url` vem no formato "/compras/{cnpj}/{ano}/{sequencial}", mas essa
  // rota não existe mais no PNCP (dá "Página não encontrada") — a rota real
  // é "/editais/...". Em vez de confiar nesse campo, montamos o link do
  // mesmo jeito que já funciona em lib/server/pncp-client.ts.
  const cnpjDigitos = raw.orgao_cnpj ? apenasDigitos(raw.orgao_cnpj) : undefined;
  if (!cnpjDigitos || !raw.ano || !raw.numero_sequencial) return undefined;
  return `https://pncp.gov.br/app/editais/${cnpjDigitos}/${raw.ano}/${raw.numero_sequencial}`;
}

function mapearParaLicitacao(raw: ItemBuscaInterna): Licitacao | undefined {
  if (!raw.numero_controle_pncp) return undefined;

  const numeroLicitacao =
    raw.numero_sequencial && raw.ano ? `${raw.numero_sequencial}/${raw.ano}` : undefined;

  return {
    id: raw.numero_controle_pncp,
    numeroLicitacao,
    numeroControlePNCP: raw.numero_controle_pncp,
    orgao: raw.orgao_nome,
    cnpjOrgao: formatarCnpj(raw.orgao_cnpj),
    objeto: raw.description,
    modalidade: raw.modalidade_licitacao_nome,
    municipio: raw.municipio_nome,
    uf: raw.uf,
    // Esta API devolve um id interno do PNCP para o município, não o código
    // IBGE que o resto do app usa — por isso `codigoMunicipioIbge` fica de
    // fora aqui; o filtro de município é resolvido por nome em route.ts.
    valorEstimado: raw.valor_global ?? undefined,
    dataAbertura: horarioBrasiliaParaIso(raw.data_inicio_vigencia),
    dataEncerramento: horarioBrasiliaParaIso(raw.data_fim_vigencia),
    situacao: raw.cancelado ? "Cancelada" : raw.situacao_nome,
    linkPNCP: montarLinkPncp(raw),
    // `linkSistemaOrigem` não existe nesta API — fica undefined (o portal
    // aparece como "não informado" na tela, sem quebrar nada).
  };
}

export async function buscarViaApiInterna(
  parametros: ParametrosBuscaInterna,
): Promise<ResultadoBuscaInterna> {
  const query = new URLSearchParams({
    q: parametros.q ?? "",
    tipos_documento: "edital",
    pagina: "1",
    tam_pagina: String(TAMANHO_PAGINA),
    ordenacao: "-data_publicacao_pncp",
  });
  if (parametros.ufs?.length) query.set("ufs", parametros.ufs.join(","));

  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (parametros.signal) sinaisAbortar.push(parametros.signal);

  const resposta = await fetch(`${BASE_URL}?${query.toString()}`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/json" },
  });

  if (!resposta.ok) {
    throw new Error(`API de busca do PNCP respondeu ${resposta.status}`);
  }

  const corpo = (await resposta.json()) as RespostaBuscaInterna;
  const itens = (corpo.items ?? [])
    .map(mapearParaLicitacao)
    .filter((item): item is Licitacao => item !== undefined);

  return { itens, parcial: (corpo.total ?? 0) > TAMANHO_PAGINA };
}
