import { validarCnpj } from "@/lib/cnpj";
import type { ResultadoContratosAm, ResultadoEmpenhosAm } from "@/types/am";

/**
 * Camada de serviço pros contratos e empenhos do Governo do Amazonas —
 * mesmo padrão de lib/api-cnpj.ts.
 */

// A primeira consulta de uma instância varre todas as UGs (~15 s); a de
// empenhos ainda lê uma página da SEFAZ por UG. Com cache, as seguintes
// levam ~1 s.
const TIMEOUT_CONTRATOS_MS = 45000;
const TIMEOUT_EMPENHOS_MS = 60000;

export type ResultadoApiAm<T> =
  | ({ status: "sucesso" } & T)
  | { status: "invalido"; mensagem: string }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

async function consultar<T>(
  caminho: string,
  cnpj: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<ResultadoApiAm<T>> {
  const validacao = validarCnpj(cnpj);
  if (!validacao.valido) return { status: "invalido", mensagem: validacao.mensagem };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);
  const onAbortExterno = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`${caminho}?cnpj=${validacao.cnpj}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (signal?.aborted) return { status: "cancelado" };

    const corpo = (await resposta.json().catch(() => ({}))) as T & { erro?: string };
    if (resposta.status === 400) return { status: "invalido", mensagem: corpo.erro ?? "CNPJ inválido." };
    if (!resposta.ok) return { status: "erro_servidor", mensagem: corpo.erro };
    return { status: "sucesso", ...corpo };
  } catch {
    if (signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbortExterno);
  }
}

export function buscarContratosAm(cnpj: string, options?: { signal?: AbortSignal }) {
  return consultar<ResultadoContratosAm>("/api/am/contratos", cnpj, TIMEOUT_CONTRATOS_MS, options?.signal);
}

export function buscarEmpenhosAm(cnpj: string, options?: { signal?: AbortSignal }) {
  return consultar<ResultadoEmpenhosAm>("/api/am/empenhos", cnpj, TIMEOUT_EMPENHOS_MS, options?.signal);
}
