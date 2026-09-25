import type {
  CaracteristicasUdi,
  DetalheCompletoProdutoSaude,
  ResultadoProdutosSaude,
} from "@/types/produto-saude";

/**
 * Camada de serviço pra consulta de produtos para saúde (ANVISA) — mesmo
 * padrão de lib/api-cnpj.ts.
 */

const TIMEOUT_MS = 15000;

type Resposta<T> =
  | { status: "ok"; corpo: T }
  | { status: "http"; codigo: number; mensagem?: string }
  | { status: "falha" }
  | { status: "cancelado" };

/** GET com timeout e cancelamento — o que muda entre as três consultas é só a interpretação da resposta. */
async function obterJson<T>(url: string, signal?: AbortSignal): Promise<Resposta<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });

    if (signal?.aborted) return { status: "cancelado" };

    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "http", codigo: resposta.status, mensagem: corpo.erro };
    }
    return { status: "ok", corpo: (await resposta.json()) as T };
  } catch {
    if (signal?.aborted) return { status: "cancelado" };
    return { status: "falha" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbortExterno);
  }
}

export type ResultadoBuscaProdutosSaude =
  | ({ status: "sucesso" } & ResultadoProdutosSaude)
  | { status: "invalido"; mensagem: string }
  | { status: "nao_configurado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarProdutosSaude(
  termo: string,
  options: { pagina: number; tamanhoPagina: number; apenasValidos: boolean; signal?: AbortSignal },
): Promise<ResultadoBuscaProdutosSaude> {
  const query = new URLSearchParams({
    q: termo,
    pagina: String(options.pagina),
    tamanho: String(options.tamanhoPagina),
    validos: options.apenasValidos ? "1" : "0",
  });
  const resposta = await obterJson<ResultadoProdutosSaude>(`/api/produtos-saude?${query}`, options.signal);

  if (resposta.status === "ok") return { status: "sucesso", ...resposta.corpo };
  if (resposta.status === "cancelado") return { status: "cancelado" };
  if (resposta.status === "http" && resposta.codigo === 400) {
    return { status: "invalido", mensagem: resposta.mensagem ?? "Termo inválido." };
  }
  if (resposta.status === "http" && resposta.codigo === 501) return { status: "nao_configurado" };
  return { status: "erro_servidor", mensagem: resposta.status === "http" ? resposta.mensagem : undefined };
}

export type ResultadoDetalheProdutoSaude =
  | ({ status: "sucesso" } & DetalheCompletoProdutoSaude)
  | { status: "nao_encontrado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarDetalheProdutoSaude(
  processo: string,
  options?: { signal?: AbortSignal },
): Promise<ResultadoDetalheProdutoSaude> {
  const resposta = await obterJson<DetalheCompletoProdutoSaude>(
    `/api/produtos-saude/detalhe?processo=${encodeURIComponent(processo)}`,
    options?.signal,
  );

  if (resposta.status === "ok") return { status: "sucesso", ...resposta.corpo };
  if (resposta.status === "cancelado") return { status: "cancelado" };
  if (resposta.status === "http" && resposta.codigo === 404) return { status: "nao_encontrado" };
  return { status: "erro_servidor", mensagem: resposta.status === "http" ? resposta.mensagem : undefined };
}

export type ResultadoCaracteristicasUdi =
  | { status: "sucesso"; caracteristicas: CaracteristicasUdi }
  | { status: "nao_encontrado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarCaracteristicasUdi(
  id: number,
  options?: { signal?: AbortSignal },
): Promise<ResultadoCaracteristicasUdi> {
  const resposta = await obterJson<{ caracteristicas: CaracteristicasUdi }>(
    `/api/produtos-saude/udi?id=${id}`,
    options?.signal,
  );

  if (resposta.status === "ok") return { status: "sucesso", caracteristicas: resposta.corpo.caracteristicas };
  if (resposta.status === "cancelado") return { status: "cancelado" };
  if (resposta.status === "http" && resposta.codigo === 404) return { status: "nao_encontrado" };
  return { status: "erro_servidor", mensagem: resposta.status === "http" ? resposta.mensagem : undefined };
}
