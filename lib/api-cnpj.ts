import type { Empresa } from "@/types/cnpj";

/**
 * Camada de serviço pra consulta de CNPJ — mesmo padrão de lib/api.ts:
 * o componente nunca chama fetch diretamente, sempre passa por aqui.
 */

const TIMEOUT_MS = 10000;

export type ResultadoBuscaCnpj =
  | { status: "sucesso"; empresa: Empresa }
  | { status: "invalido"; mensagem: string }
  | { status: "nao_encontrado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarEmpresa(
  cnpj: string,
  options?: { signal?: AbortSignal },
): Promise<ResultadoBuscaCnpj> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/cnpj?cnpj=${encodeURIComponent(cnpj)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (options?.signal?.aborted) return { status: "cancelado" };

    if (resposta.status === 400) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "invalido", mensagem: corpo.erro ?? "CNPJ inválido." };
    }
    if (resposta.status === 404) {
      return { status: "nao_encontrado" };
    }
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "erro_servidor", mensagem: corpo.erro };
    }

    const corpo = (await resposta.json()) as { empresa: Empresa };
    return { status: "sucesso", empresa: corpo.empresa };
  } catch {
    if (options?.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbortExterno);
  }
}
