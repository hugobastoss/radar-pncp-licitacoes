import type { DocumentoLicitacao } from "@/types/licitacao";

/**
 * Camada de serviço pra listar os documentos (edital, anexos) de uma
 * licitação — mesmo padrão de lib/api-cnpj.ts.
 */

// Um pouco mais folgado que o timeout do servidor (20s em
// lib/server/pncp-documentos-client.ts), pra dar chance da resposta real do
// backend chegar antes do cliente desistir primeiro.
const TIMEOUT_MS = 25000;

export type ResultadoDocumentosLicitacao =
  | { status: "sucesso"; documentos: DocumentoLicitacao[] }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarDocumentosLicitacao(
  cnpj: string,
  ano: string,
  sequencial: string,
  options?: { signal?: AbortSignal },
): Promise<ResultadoDocumentosLicitacao> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const query = new URLSearchParams({ cnpj, ano, sequencial });
    const resposta = await fetch(`/api/licitacoes/documentos?${query.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (options?.signal?.aborted) return { status: "cancelado" };

    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "erro_servidor", mensagem: corpo.erro };
    }

    const corpo = (await resposta.json()) as { documentos: DocumentoLicitacao[] };
    return { status: "sucesso", documentos: corpo.documentos };
  } catch {
    if (options?.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbortExterno);
  }
}
