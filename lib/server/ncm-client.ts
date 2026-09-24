import type { ItemNcm } from "@/types/ncm";

/**
 * Cliente da BrasilAPI para consulta de NCM (Nomenclatura Comum do
 * Mercosul) — classificação de mercadorias usada em licitações pra
 * especificar o item comprado. Sem autenticação.
 *
 * A API tem dois modos que não se sobrepõem: busca por código exato
 * (`/v1/{codigo}`) e busca por texto na descrição (`/v1?search=`) — o
 * parâmetro `search` NÃO casa com o código, só com a descrição. Por isso
 * `buscarNcm` tenta os dois em paralelo e combina o resultado.
 */

const BASE_URL = "https://brasilapi.com.br/api/ncm/v1";
const TIMEOUT_MS = 8000;
const USER_AGENT = "RadarLicitacoes/1.0";

interface ItemNcmBrasilApi {
  codigo?: string;
  descricao?: string;
  data_inicio?: string;
  data_fim?: string;
}

function mapearParaItemNcm(raw: ItemNcmBrasilApi): ItemNcm | undefined {
  if (!raw.codigo || !raw.descricao) return undefined;
  return {
    codigo: raw.codigo,
    descricao: raw.descricao,
    dataInicio: raw.data_inicio,
    dataFim: raw.data_fim,
  };
}

function cabecalhos() {
  return { Accept: "application/json", "User-Agent": USER_AGENT };
}

async function buscarPorCodigo(codigo: string, signal?: AbortSignal): Promise<ItemNcm | undefined> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(`${BASE_URL}/${encodeURIComponent(codigo)}`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: cabecalhos(),
  });

  if (resposta.status === 404) return undefined;
  if (!resposta.ok) throw new Error(`BrasilAPI (NCM/código) respondeu ${resposta.status}`);

  const corpo = (await resposta.json()) as ItemNcmBrasilApi;
  return mapearParaItemNcm(corpo);
}

async function buscarPorTexto(termo: string, signal?: AbortSignal): Promise<ItemNcm[]> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(`${BASE_URL}?search=${encodeURIComponent(termo)}`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: cabecalhos(),
  });

  if (!resposta.ok) throw new Error(`BrasilAPI (NCM/busca) respondeu ${resposta.status}`);

  const corpo = (await resposta.json()) as ItemNcmBrasilApi[];
  return corpo.map(mapearParaItemNcm).filter((item): item is ItemNcm => item !== undefined);
}

/** Parece um código NCM (dígitos e pontos, sem letras) — vale tentar a busca exata também. */
function pareceCodigo(termo: string): boolean {
  return /^[\d.]+$/.test(termo) && /\d/.test(termo);
}

export async function buscarNcm(termo: string, signal?: AbortSignal): Promise<ItemNcm[]> {
  // `search` só casa com a descrição (nunca com o código, testado
  // diretamente na API) — pra um termo que parece código, a busca por
  // texto sempre voltaria vazia, então nem vale a pena chamar.
  if (pareceCodigo(termo)) {
    const porCodigo = await buscarPorCodigo(termo, signal).catch(() => undefined);
    return porCodigo ? [porCodigo] : [];
  }
  return buscarPorTexto(termo, signal);
}
