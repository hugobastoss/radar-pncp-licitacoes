import type { ResultadoDocumentosEmenda, ResultadoEmendas } from "@/types/transparencia";

/** Camada de serviço das emendas parlamentares — mesmo padrão de lib/api-sancoes.ts. */

export interface FiltrosBuscaEmendas {
  autor?: string;
  ano?: string;
  tipo?: string;
  numero?: string;
  codigo?: string;
  pagina: number;
}

export type ResultadoApiEmendas<T> =
  | ({ status: "sucesso" } & T)
  | { status: "invalido"; mensagem: string }
  | { status: "nao_configurado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

async function consultar<T>(caminho: string, timeoutMs: number, signal?: AbortSignal): Promise<ResultadoApiEmendas<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs);
  const onAbortExterno = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(caminho, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (signal?.aborted) return { status: "cancelado" };

    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string } & T;
    if (resposta.status === 400) return { status: "invalido", mensagem: corpo.erro ?? "Filtro inválido." };
    if (resposta.status === 501) return { status: "nao_configurado" };
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

export function buscarEmendas(filtros: FiltrosBuscaEmendas, options?: { signal?: AbortSignal }) {
  const parametros = new URLSearchParams();
  for (const [nome, valor] of Object.entries(filtros)) {
    if (valor !== undefined && String(valor).trim()) parametros.set(nome, String(valor).trim());
  }
  return consultar<ResultadoEmendas>(`/api/emendas?${parametros}`, 20000, options?.signal);
}

/** Até 10 páginas de documentos + até 40 detalhes, 5 de cada vez — pode passar de 10 s numa emenda grande. */
export function buscarDocumentosEmenda(codigo: string, options?: { signal?: AbortSignal }) {
  return consultar<ResultadoDocumentosEmenda>(
    `/api/emendas/documentos?codigo=${encodeURIComponent(codigo)}`,
    45000,
    options?.signal,
  );
}
