import { validarCnpj } from "@/lib/cnpj";
import type { Sancao } from "@/lib/server/transparencia-client";

/**
 * Camada de serviço pra consulta de sanções (CEIS/CNEP) — mesmo padrão de
 * lib/api.ts e lib/api-cnpj.ts.
 */

const TIMEOUT_MS = 10000;

export type ResultadoBuscaSancoes =
  | { status: "sucesso"; ceis: Sancao[]; cnep: Sancao[] }
  | { status: "invalido"; mensagem: string }
  | { status: "nao_configurado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarSancoes(
  cnpj: string,
  options?: { signal?: AbortSignal },
): Promise<ResultadoBuscaSancoes> {
  // Mesma validação da rota — responde na hora, sem ida ao servidor.
  const validacao = validarCnpj(cnpj);
  if (!validacao.valido) return { status: "invalido", mensagem: validacao.mensagem };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/sancoes?cnpj=${validacao.cnpj}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (options?.signal?.aborted) return { status: "cancelado" };

    if (resposta.status === 400) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "invalido", mensagem: corpo.erro ?? "CNPJ inválido." };
    }
    if (resposta.status === 501) {
      return { status: "nao_configurado" };
    }
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "erro_servidor", mensagem: corpo.erro };
    }

    const corpo = (await resposta.json()) as { ceis: Sancao[]; cnep: Sancao[] };
    return { status: "sucesso", ceis: corpo.ceis, cnep: corpo.cnep };
  } catch {
    if (options?.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbortExterno);
  }
}
