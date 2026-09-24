import type { ItemNcm } from "@/types/ncm";

/**
 * Camada de serviço pra consulta de NCM — mesmo padrão de lib/api-cnpj.ts.
 */

const TIMEOUT_MS = 10000;

export type ResultadoBuscaNcm =
  | { status: "sucesso"; itens: ItemNcm[] }
  | { status: "invalido"; mensagem: string }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarNcm(termo: string, options?: { signal?: AbortSignal }): Promise<ResultadoBuscaNcm> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/ncm?q=${encodeURIComponent(termo)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (options?.signal?.aborted) return { status: "cancelado" };

    if (resposta.status === 400) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "invalido", mensagem: corpo.erro ?? "Termo inválido." };
    }
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "erro_servidor", mensagem: corpo.erro };
    }

    const corpo = (await resposta.json()) as { itens: ItemNcm[] };
    return { status: "sucesso", itens: corpo.itens };
  } catch {
    if (options?.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbortExterno);
  }
}
