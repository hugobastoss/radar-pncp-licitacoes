import { formatarCnpj } from "@/lib/formatters";
import { dominioDoPortalPorNome } from "@/lib/portal";
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
  title?: string;
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

// Esta API não tem um campo próprio de portal de origem, mas alguns órgãos
// embutem o nome do portal que usaram pra submeter a licitação como um
// prefixo "[Nome do Portal] - " no início do próprio `description` (ex.:
// "[Portal de Compras Públicas] - Aquisição de..."). Extraímos esse prefixo
// pra não deixá-lo poluindo o objeto exibido e, quando o nome bate com um
// portal já cadastrado (lib/portal.ts), sintetizamos um link pra HOME do
// portal — não é o link direto da licitação (esse não existe aqui), mas já
// é o suficiente pra identificar e abrir o portal, em vez do botão ficar
// sempre desativado.
const PREFIXO_PORTAL_NO_OBJETO = /^\[([^\]]+)\]\s*-\s*/;

function extrairPortalDoObjeto(description: string | undefined): { objeto?: string; linkSistemaOrigem?: string } {
  if (!description) return { objeto: description };

  const match = description.match(PREFIXO_PORTAL_NO_OBJETO);
  if (!match) return { objeto: description };

  const objeto = description.slice(match[0].length).trim() || undefined;
  const dominio = dominioDoPortalPorNome(match[1]);
  return { objeto, linkSistemaOrigem: dominio ? `https://${dominio}` : undefined };
}

// `numero_sequencial` é só a posição interna do PNCP na fila de publicações
// desse órgão (usada pra montar a URL) — não é o número do edital de
// verdade. O número real (o que o órgão usa, ex.: "Edital nº 008/2026")
// só existe embutido em texto no `title` ("{Tipo} nº {número}/{ano}"),
// confirmado comparando com a página pública do PNCP (numero_sequencial=66
// vs. o edital nº 008/2026 de verdade). Extraído daqui em vez de confiar
// no campo `numero`, que vem sempre `null` nesta API.
const PADRAO_NUMERO_NO_TITULO = /n[ºo°]\.?\s*([^/\s]+)\/(\d{4})/i;

function extrairNumeroDoTitulo(title: string | undefined): string | undefined {
  const match = title ? PADRAO_NUMERO_NO_TITULO.exec(title) : null;
  return match ? `${match[1]}/${match[2]}` : undefined;
}

function mapearParaLicitacao(raw: ItemBuscaInterna): Licitacao | undefined {
  if (!raw.numero_controle_pncp) return undefined;

  const numeroLicitacao = extrairNumeroDoTitulo(raw.title);

  const { objeto, linkSistemaOrigem } = extrairPortalDoObjeto(raw.description);

  return {
    id: raw.numero_controle_pncp,
    numeroLicitacao,
    numeroControlePNCP: raw.numero_controle_pncp,
    orgao: raw.orgao_nome,
    cnpjOrgao: formatarCnpj(raw.orgao_cnpj),
    objeto,
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
    // Só preenchido quando o objeto trazia o prefixo "[Nome do Portal]" E o
    // nome bate com um portal cadastrado — nos demais casos fica undefined
    // (o portal aparece como "não informado" na tela, sem quebrar nada).
    linkSistemaOrigem,
  };
}

export async function buscarViaApiInterna(
  parametros: ParametrosBuscaInterna,
): Promise<ResultadoBuscaInterna> {
  const query = new URLSearchParams({
    tipos_documento: "edital",
    pagina: "1",
    tam_pagina: String(TAMANHO_PAGINA),
    ordenacao: "-data_publicacao_pncp",
  });
  if (parametros.q) {
    query.set("q", parametros.q);
  } else {
    // Sem palavra-chave, o PNCP passou a exigir um filtro de status (senão
    // devolve 400 "O filtro status é obrigatório") — verificado ao vivo em
    // 2026-09-25. "recebendo_proposta" traz só licitações em aberto, o que já
    // é o recorte predominante de uma busca sem texto.
    query.set("status", "recebendo_proposta");
  }
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
