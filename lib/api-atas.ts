import type { ResultadoAtas } from "@/types/ata";

/** Camada de serviço das atas de registro de preço (PNCP) — mesmo padrão de lib/api-emendas.ts. */

export interface FiltrosBuscaAtas {
  q?: string;
  uf?: string;
  /** Incluir atas já encerradas. */
  todas?: boolean;
  pagina: number;
}

export type ResultadoApiAtas =
  | ({ status: "sucesso" } & ResultadoAtas)
  | { status: "invalido"; mensagem: string }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

// Até 4 tentativas de 10 s no servidor, quando o PNCP derruba a conexão.
const TIMEOUT_MS = 45000;

export async function buscarAtas(filtros: FiltrosBuscaAtas, options?: { signal?: AbortSignal }): Promise<ResultadoApiAtas> {
  const parametros = new URLSearchParams({ pagina: String(filtros.pagina) });
  if (filtros.q?.trim()) parametros.set("q", filtros.q.trim());
  if (filtros.uf) parametros.set("uf", filtros.uf);
  if (filtros.todas) parametros.set("todas", "1");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/atas?${parametros}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (options?.signal?.aborted) return { status: "cancelado" };

    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string } & ResultadoAtas;
    if (resposta.status === 400) return { status: "invalido", mensagem: corpo.erro ?? "Filtro inválido." };
    if (!resposta.ok) return { status: "erro_servidor", mensagem: corpo.erro };
    return { status: "sucesso", ...corpo };
  } catch {
    if (options?.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbortExterno);
  }
}
