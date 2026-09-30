import { COLUNAS_TRANSFERENCIA_ESPECIAL, mapearTransferenciaEspecial } from "@/lib/fontes-publicas";
import type { PlanoAcaoEspecialBruto } from "@/lib/fontes-publicas";
import type { TransferenciasEspeciais } from "@/types/fontes-publicas";

/**
 * Transferências especiais (as "emendas PIX") recebidas por um CNPJ, pela
 * API de dados abertos do TransfereGov. Gratuita, sem chave; é um PostgREST,
 * então os filtros vão na URL (`coluna=eq.valor`) e o total vem no cabeçalho
 * Content-Range quando se pede `Prefer: count=exact`.
 *
 * A fonte também devolve banco, agência e conta do beneficiário. Pedimos só
 * as colunas que a tela mostra (`select=`), então esses dados nem chegam aqui.
 */
const URL_PLANOS = "https://api.transferegov.gestao.gov.br/transferenciasespeciais/plano_acao_especial";
const TIMEOUT_MS = 8000;
const CACHE_SEGUNDOS = 60 * 60;
const MAXIMO_ITENS = 50;

export async function buscarTransferenciasEspeciais(cnpj: string, signal?: AbortSignal): Promise<TransferenciasEspeciais> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const parametros = new URLSearchParams({
    cnpj_beneficiario_plano_acao: `eq.${cnpj}`,
    select: COLUNAS_TRANSFERENCIA_ESPECIAL,
    order: "ano_plano_acao.desc,id_plano_acao.desc",
    limit: String(MAXIMO_ITENS),
  });
  const resposta = await fetch(`${URL_PLANOS}?${parametros}`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/json", Prefer: "count=exact", "User-Agent": "QBuscado/1.0" },
    next: { revalidate: CACHE_SEGUNDOS },
  });
  if (!resposta.ok) throw new Error(`TransfereGov respondeu ${resposta.status}`);

  const itens = ((await resposta.json()) as PlanoAcaoEspecialBruto[]).map(mapearTransferenciaEspecial);
  // "0-49/36" ou "*/0": o total vem depois da barra.
  const total = Number(resposta.headers.get("content-range")?.split("/")[1]);
  return { total: Number.isFinite(total) ? total : itens.length, itens };
}
