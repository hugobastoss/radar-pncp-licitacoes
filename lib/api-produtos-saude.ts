import type { ProdutoSaude } from "@/types/produto-saude";

/**
 * Camada de serviço pra consulta de produtos para saúde (ANVISA) — mesmo
 * padrão de lib/api-cnpj.ts.
 */

const TIMEOUT_MS = 15000;

export type ResultadoBuscaProdutosSaude =
  | { status: "sucesso"; itens: ProdutoSaude[]; total: number }
  | { status: "invalido"; mensagem: string }
  | { status: "nao_configurado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarProdutosSaude(
  termo: string,
  options?: { signal?: AbortSignal },
): Promise<ResultadoBuscaProdutosSaude> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/produtos-saude?q=${encodeURIComponent(termo)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (options?.signal?.aborted) return { status: "cancelado" };

    if (resposta.status === 400) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "invalido", mensagem: corpo.erro ?? "Termo inválido." };
    }
    if (resposta.status === 501) {
      return { status: "nao_configurado" };
    }
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "erro_servidor", mensagem: corpo.erro };
    }

    const corpo = (await resposta.json()) as { itens: ProdutoSaude[]; total: number };
    return { status: "sucesso", itens: corpo.itens, total: corpo.total };
  } catch {
    if (options?.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbortExterno);
  }
}
