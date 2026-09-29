import { normalizarCnpj } from "@/lib/cnpj";
import { formatarCnpj } from "@/lib/formatters";
import type { AtaRegistroPreco, ResultadoAtas } from "@/types/ata";

/**
 * Atas de registro de preço pela API de BUSCA do PNCP (a mesma de
 * lib/server/pncp-search-client.ts, com `tipos_documento=ata`). É a única
 * fonte com busca por texto: a API oficial de consulta (`/v1/atas`) só filtra
 * por período e devolve todas as atas do país (529 mil num mês).
 *
 * Testado em 2026-09-29:
 * - `status=vigente` traz só as atas em vigência (7.070 no AM); sem texto, o
 *   filtro de status é obrigatório.
 * - A busca derruba a conexão (ECONNRESET) na maioria das chamadas — 1 de 10
 *   passou de primeira, 9 de 10 com até 3 tentativas. Não é a palavra buscada:
 *   o mesmo termo falha e passa em seguida. Por isso as retentativas abaixo.
 * - `item_url` vem "/atas/{cnpj}/{ano}/{sequencial}/{sequencialAta}", que é a
 *   rota da página da ata em pncp.gov.br/app.
 * - `valor_global` e `permite_adesao` vêm nulos nas atas vistas.
 */

const BASE_URL = "https://pncp.gov.br/api/search/";
const TIMEOUT_MS = 10000;
const TAMANHO_PAGINA = 10;
const TENTATIVAS = 4;
const USER_AGENT = "Mozilla/5.0 (compatible; RadarLicitacoes/1.0)";

interface AtaBruta {
  numero_controle_pncp?: string;
  title?: string;
  description?: string;
  item_url?: string;
  orgao_nome?: string;
  orgao_cnpj?: string;
  unidade_nome?: string;
  municipio_nome?: string;
  uf?: string;
  modalidade_licitacao_nome?: string;
  data_inicio_vigencia?: string;
  data_fim_vigencia?: string;
  data_assinatura?: string;
  cancelado?: boolean;
}

function texto(valor: string | null | undefined): string | undefined {
  return valor?.trim() || undefined;
}

/** "2026-10-06T00:00:00" ou "2026-10-06" → "2026-10-06". */
function data(valor: string | undefined): string | undefined {
  return /^\d{4}-\d{2}-\d{2}/.exec(valor ?? "")?.[0];
}

function mapearAta(raw: AtaBruta): AtaRegistroPreco {
  const url = texto(raw.item_url);
  return {
    id: raw.numero_controle_pncp ?? url ?? raw.title ?? "",
    titulo: texto(raw.title) ?? "Ata sem número",
    objeto: texto(raw.description),
    orgao: texto(raw.orgao_nome),
    orgaoCnpj: raw.orgao_cnpj ? formatarCnpj(normalizarCnpj(raw.orgao_cnpj)) : undefined,
    unidade: texto(raw.unidade_nome),
    municipio: texto(raw.municipio_nome),
    uf: texto(raw.uf),
    modalidade: texto(raw.modalidade_licitacao_nome),
    vigenciaInicio: data(raw.data_inicio_vigencia),
    vigenciaFim: data(raw.data_fim_vigencia),
    dataAssinatura: data(raw.data_assinatura),
    cancelada: raw.cancelado === true,
    link: url?.startsWith("/atas/") ? `https://pncp.gov.br/app${url}` : undefined,
  };
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Erro de rede (ECONNRESET, timeout de conexão) — vale tentar de novo. Resposta HTTP de erro, não. */
function ehFalhaDeRede(erro: unknown): boolean {
  return erro instanceof TypeError || (erro instanceof Error && erro.name === "TimeoutError");
}

async function buscarComRetentativa(url: string, signal?: AbortSignal): Promise<Response> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const sinais = [AbortSignal.timeout(TIMEOUT_MS)];
      if (signal) sinais.push(signal);
      return await fetch(url, {
        signal: AbortSignal.any(sinais),
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      });
    } catch (erro) {
      ultimoErro = erro;
      if (signal?.aborted || !ehFalhaDeRede(erro)) throw erro;
      if (tentativa < TENTATIVAS) await esperar(250 * tentativa);
    }
  }
  throw ultimoErro;
}

export interface FiltrosAtas {
  q?: string;
  uf?: string;
  /** `false` inclui atas encerradas. */
  somenteVigentes: boolean;
  pagina: number;
}

export async function buscarAtas(filtros: FiltrosAtas, signal?: AbortSignal): Promise<ResultadoAtas> {
  const query = new URLSearchParams({
    tipos_documento: "ata",
    pagina: String(filtros.pagina),
    tam_pagina: String(TAMANHO_PAGINA),
  });
  if (filtros.q) query.set("q", filtros.q);
  // Sem texto, o PNCP exige um status — e aí só faz sentido o de vigentes.
  if (filtros.somenteVigentes || !filtros.q) query.set("status", "vigente");
  if (!filtros.q) query.set("ordenacao", "-data_publicacao_pncp");
  if (filtros.uf) query.set("ufs", filtros.uf);

  const resposta = await buscarComRetentativa(`${BASE_URL}?${query}`, signal);
  if (!resposta.ok) throw new Error(`API de busca do PNCP (atas) respondeu ${resposta.status}`);
  const corpo = (await resposta.json()) as { items?: AtaBruta[]; total?: number };

  const total = corpo.total ?? 0;
  return {
    itens: (corpo.items ?? []).map(mapearAta),
    total,
    pagina: filtros.pagina,
    totalPaginas: Math.max(1, Math.ceil(total / TAMANHO_PAGINA)),
  };
}
