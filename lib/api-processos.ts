import type { ProcessoJudicial } from "@/types/processo-judicial";

/** Camada de serviço da consulta de processos judiciais — mesmo padrão de lib/api-tcu.ts. */

// A latência do DataJud varia bastante (~3 s a mais de 30 s pra mesma consulta, ver lib/server/datajud-client.ts).
const TIMEOUT_MS = 40000;

export type ResultadoBuscaProcesso =
  | { status: "sucesso"; processo: ProcessoJudicial }
  | { status: "nao_encontrado" }
  | { status: "invalido"; mensagem: string }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarProcessoJudicial(
  tribunal: string,
  numero: string,
  options?: { signal?: AbortSignal },
): Promise<ResultadoBuscaProcesso> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(
      `/api/processos?tribunal=${encodeURIComponent(tribunal)}&numero=${encodeURIComponent(numero)}`,
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );
    if (options?.signal?.aborted) return { status: "cancelado" };

    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string; processo?: ProcessoJudicial | null };
    if (resposta.status === 400) return { status: "invalido", mensagem: corpo.erro ?? "Consulta inválida." };
    if (!resposta.ok) return { status: "erro_servidor", mensagem: corpo.erro };
    if (!corpo.processo) return { status: "nao_encontrado" };
    return { status: "sucesso", processo: corpo.processo };
  } catch {
    if (options?.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbortExterno);
  }
}
