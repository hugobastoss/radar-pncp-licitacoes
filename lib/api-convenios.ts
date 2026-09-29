import type { ResultadoConvenios } from "@/types/transparencia";

/** Camada de serviço dos convênios federais — mesmo padrão de lib/api-emendas.ts. */

export interface FiltrosBuscaConvenios {
  uf?: string;
  /** Código IBGE do município. */
  municipio?: string;
  convenente?: string;
  /** "1" = só convênios em vigência. */
  vigentes?: "1";
  pagina: number;
}

export type ResultadoApiConvenios =
  | ({ status: "sucesso" } & ResultadoConvenios)
  | { status: "invalido"; mensagem: string }
  | { status: "nao_configurado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

// Busca por nome do convenente chegou a 12 s nos testes.
const TIMEOUT_MS = 30000;

export async function buscarConvenios(
  filtros: FiltrosBuscaConvenios,
  options?: { signal?: AbortSignal },
): Promise<ResultadoApiConvenios> {
  const parametros = new URLSearchParams();
  for (const [nome, valor] of Object.entries(filtros)) {
    if (valor !== undefined && String(valor).trim()) parametros.set(nome, String(valor).trim());
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/convenios?${parametros}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (options?.signal?.aborted) return { status: "cancelado" };

    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string } & ResultadoConvenios;
    if (resposta.status === 400) return { status: "invalido", mensagem: corpo.erro ?? "Filtro inválido." };
    if (resposta.status === 501) return { status: "nao_configurado" };
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
