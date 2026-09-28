import { validarCnpj } from "@/lib/cnpj";
import type { ComplementoCnpj, Empresa } from "@/types/cnpj";

/**
 * Camada de serviço pra consulta de CNPJ — mesmo padrão de lib/api.ts:
 * o componente nunca chama fetch diretamente, sempre passa por aqui.
 */

// Folga sobre o pior caso do servidor: BrasilAPI e Minha Receita esgotando
// os 5 s cada (ver lib/server/cnpj-client.ts).
const TIMEOUT_MS = 12000;

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
  // Mesma validação da rota — responde na hora, sem ida ao servidor.
  const validacao = validarCnpj(cnpj);
  if (!validacao.valido) return { status: "invalido", mensagem: validacao.mensagem };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/cnpj?cnpj=${validacao.cnpj}`, {
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

export type ResultadoComplementoCnpj =
  | { status: "sucesso"; complemento: ComplementoCnpj }
  | { status: "nao_encontrado" }
  | { status: "limite"; mensagem?: string }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

/** Inscrição SUFRAMA e e-mail corporativo (CNPJá) — complemento opcional do cadastro. */
export async function buscarComplementoCnpj(
  cnpj: string,
  options?: { signal?: AbortSignal },
): Promise<ResultadoComplementoCnpj> {
  const validacao = validarCnpj(cnpj);
  if (!validacao.valido) return { status: "erro_servidor", mensagem: validacao.mensagem };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/cnpj/complemento?cnpj=${validacao.cnpj}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (options?.signal?.aborted) return { status: "cancelado" };
    if (resposta.status === 404) return { status: "nao_encontrado" };

    const corpo = (await resposta.json().catch(() => ({}))) as { complemento?: ComplementoCnpj; erro?: string };
    if (resposta.status === 429) return { status: "limite", mensagem: corpo.erro };
    if (!resposta.ok || !corpo.complemento) return { status: "erro_servidor", mensagem: corpo.erro };
    return { status: "sucesso", complemento: corpo.complemento };
  } catch {
    if (options?.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbortExterno);
  }
}
