import { mapearOperadoraAns } from "@/lib/fontes-publicas";
import type { OperadoraAnsBruta } from "@/lib/fontes-publicas";
import type { OperadoraAns } from "@/types/fontes-publicas";

/**
 * Operadora de plano de saúde registrada na ANS, pelo CNPJ. API aberta da
 * própria ANS, gratuita e sem chave. A busca por CNPJ traz o registro e se
 * está ativa; o nome da classificação ("Medicina de Grupo") só vem no
 * detalhe da operadora, então há uma segunda chamada quando o CNPJ é de
 * operadora — o que é raro.
 */
const BASE_URL = "https://www.ans.gov.br/operadoras-entity/v1/operadoras";
const TIMEOUT_MS = 8000;
const CACHE_SEGUNDOS = 24 * 60 * 60;

async function consultar<T>(url: string, signal?: AbortSignal): Promise<T> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);
  const resposta = await fetch(url, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/json", "User-Agent": "QBuscado/1.0" },
    next: { revalidate: CACHE_SEGUNDOS },
  });
  if (!resposta.ok) throw new Error(`ANS respondeu ${resposta.status}`);
  return (await resposta.json()) as T;
}

/** Devolve `undefined` quando o CNPJ não é de operadora. */
export async function buscarOperadoraAns(cnpj: string, signal?: AbortSignal): Promise<OperadoraAns | undefined> {
  const lista = await consultar<{ content?: OperadoraAnsBruta[] }>(`${BASE_URL}?cnpj=${cnpj}`, signal);
  const resumo = lista.content?.[0];
  if (!resumo?.registro_ans) return undefined;

  // O detalhe só acrescenta o nome da classificação: se falhar, o resumo já serve.
  const detalhe = await consultar<OperadoraAnsBruta>(`${BASE_URL}/${resumo.registro_ans}`, signal).catch(() => undefined);
  return mapearOperadoraAns({ ...resumo, ...detalhe });
}
