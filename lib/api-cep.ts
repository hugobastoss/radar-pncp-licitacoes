import type { Endereco } from "@/types/cep";

/**
 * Camada de serviço pra consulta de CEP — mesmo padrão de lib/api-cnpj.ts.
 */

const TIMEOUT_MS = 10000;

export type ResultadoBuscaCep =
  | { status: "sucesso"; endereco: Endereco }
  | { status: "invalido"; mensagem: string }
  | { status: "nao_encontrado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarEndereco(
  cep: string,
  options?: { signal?: AbortSignal },
): Promise<ResultadoBuscaCep> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/cep?cep=${encodeURIComponent(cep)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (options?.signal?.aborted) return { status: "cancelado" };

    if (resposta.status === 400) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "invalido", mensagem: corpo.erro ?? "CEP inválido." };
    }
    if (resposta.status === 404) {
      return { status: "nao_encontrado" };
    }
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "erro_servidor", mensagem: corpo.erro };
    }

    const corpo = (await resposta.json()) as { endereco: Endereco };
    return { status: "sucesso", endereco: corpo.endereco };
  } catch {
    if (options?.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbortExterno);
  }
}
