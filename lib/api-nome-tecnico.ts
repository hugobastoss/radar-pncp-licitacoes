import type { CategoriaNomeTecnico, FiltroClasseRisco } from "@/lib/nome-tecnico";
import type { ResultadoNomesTecnicos } from "@/types/nome-tecnico";

/**
 * Camada de serviço pra consulta de nomenclatura técnica (ANVISA) — mesmo
 * padrão de lib/api-produtos-saude.ts.
 */

// A primeira busca de uma instância carrega a base inteira da ANVISA (~1 s); as seguintes são locais.
const TIMEOUT_MS = 15000;

export type ResultadoBuscaNomeTecnico =
  | ({ status: "sucesso" } & ResultadoNomesTecnicos)
  | { status: "invalido"; mensagem: string }
  | { status: "nao_configurado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarNomesTecnicos(
  termo: string,
  options: {
    categoria?: CategoriaNomeTecnico;
    classeRisco?: FiltroClasseRisco;
    pagina: number;
    tamanhoPagina: number;
    signal?: AbortSignal;
  },
): Promise<ResultadoBuscaNomeTecnico> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onAbortExterno);

  const query = new URLSearchParams({
    q: termo,
    pagina: String(options.pagina),
    tamanho: String(options.tamanhoPagina),
  });
  if (options.categoria) query.set("categoria", options.categoria);
  if (options.classeRisco) query.set("classe", options.classeRisco);

  try {
    const resposta = await fetch(`/api/nome-tecnico?${query}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (options.signal?.aborted) return { status: "cancelado" };

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

    const corpo = (await resposta.json()) as ResultadoNomesTecnicos;
    return { status: "sucesso", ...corpo };
  } catch {
    if (options.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbortExterno);
  }
}
