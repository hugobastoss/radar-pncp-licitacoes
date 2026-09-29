import { validarCnpj } from "@/lib/cnpj";
import type { CertidaoTcu } from "@/types/tcu";

/** Camada de serviço da certidão consolidada do TCU — mesmo padrão de lib/api-sancoes.ts. */

// A primeira consulta de um CNPJ leva ~6 s no TCU.
const TIMEOUT_MS = 25000;

export type ResultadoCertidaoTcu =
  | ({ status: "sucesso" } & CertidaoTcu)
  | { status: "invalido"; mensagem: string }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export function linkPdfCertidaoTcu(cnpj: string): string {
  return `/api/tcu/certidao?cnpj=${encodeURIComponent(cnpj)}&pdf=1`;
}

export async function buscarCertidaoTcu(cnpj: string, options?: { signal?: AbortSignal }): Promise<ResultadoCertidaoTcu> {
  const validacao = validarCnpj(cnpj);
  if (!validacao.valido) return { status: "invalido", mensagem: validacao.mensagem };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    const resposta = await fetch(`/api/tcu/certidao?cnpj=${validacao.cnpj}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (options?.signal?.aborted) return { status: "cancelado" };

    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string } & CertidaoTcu;
    if (resposta.status === 400) return { status: "invalido", mensagem: corpo.erro ?? "CNPJ inválido." };
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
