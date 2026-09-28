import { validarCnpj } from "@/lib/cnpj";
import type { DadosGovernoFederal } from "@/types/transparencia";

/**
 * Camada de serviço pra relação da empresa com o governo federal (Portal da
 * Transparência) — mesmo padrão de lib/api-sancoes.ts.
 */

// Fornecedor grande pode precisar de até 20 páginas da CGU (contratos + pagamentos).
const TIMEOUT_MS = 20000;

export type ResultadoGovernoFederal =
  | ({ status: "sucesso" } & DadosGovernoFederal)
  | { status: "invalido"; mensagem: string }
  | { status: "nao_configurado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function buscarDadosGovernoFederal(
  cnpj: string,
  options?: { signal?: AbortSignal },
): Promise<ResultadoGovernoFederal> {
  const validacao = validarCnpj(cnpj);
  if (!validacao.valido) return { status: "invalido", mensagem: validacao.mensagem };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/governo-federal?cnpj=${validacao.cnpj}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (options?.signal?.aborted) return { status: "cancelado" };

    if (resposta.status === 400) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "invalido", mensagem: corpo.erro ?? "CNPJ inválido." };
    }
    if (resposta.status === 501) return { status: "nao_configurado" };
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      return { status: "erro_servidor", mensagem: corpo.erro };
    }

    const corpo = (await resposta.json()) as DadosGovernoFederal;
    return { status: "sucesso", ...corpo };
  } catch {
    if (options?.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbortExterno);
  }
}
