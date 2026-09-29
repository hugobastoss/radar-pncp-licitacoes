import { validarCnpj } from "@/lib/cnpj";
import type { ResultadoEmpenhosFederais } from "@/types/transparencia";

/** Camada de serviço dos empenhos a receber do governo federal — mesmo padrão de lib/api-am.ts. */

export type ResultadoApiEmpenhosFederais =
  | ({ status: "sucesso" } & ResultadoEmpenhosFederais)
  | { status: "invalido"; mensagem: string }
  | { status: "limite"; mensagem: string }
  | { status: "nao_configurado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

// Até 120 empenhos, 5 de cada vez — a rota tem 60 s.
const TIMEOUT_MS = 60000;

export async function buscarEmpenhosFederais(
  cnpj: string,
  options?: { signal?: AbortSignal },
): Promise<ResultadoApiEmpenhosFederais> {
  const validacao = validarCnpj(cnpj);
  if (!validacao.valido) return { status: "invalido", mensagem: validacao.mensagem };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/empenhos-federais?cnpj=${validacao.cnpj}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (options?.signal?.aborted) return { status: "cancelado" };

    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string } & ResultadoEmpenhosFederais;
    if (resposta.status === 400) return { status: "invalido", mensagem: corpo.erro ?? "CNPJ inválido." };
    if (resposta.status === 429) return { status: "limite", mensagem: corpo.erro ?? "Muitas consultas seguidas." };
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
