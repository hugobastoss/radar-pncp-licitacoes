import { validarCpf } from "@/lib/cpf";
import type { DadosPessoaFisica } from "@/types/transparencia";

/** Camada de serviço da consulta de CPF — mesmo padrão de lib/api-sancoes.ts. */

// De 5 a 16 chamadas à CGU: resumo, CEIS, CNEP, CEAF e PEP sempre; servidor e até 10 páginas de contratos, se houver.
const TIMEOUT_MS = 25000;

export type ResultadoConsultaCpf =
  | { status: "sucesso"; pessoa: DadosPessoaFisica }
  | { status: "invalido"; mensagem: string }
  | { status: "limite"; mensagem: string }
  | { status: "nao_configurado" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };

export async function consultarCpf(cpf: string, options?: { signal?: AbortSignal }): Promise<ResultadoConsultaCpf> {
  // Mesma validação da rota — responde na hora, sem ida ao servidor.
  const validacao = validarCpf(cpf);
  if (!validacao.valido) return { status: "invalido", mensagem: validacao.mensagem };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), TIMEOUT_MS);
  const onAbortExterno = () => controller.abort(options?.signal?.reason);
  options?.signal?.addEventListener("abort", onAbortExterno);

  try {
    // POST com o CPF no corpo: na URL ele ficaria no histórico do navegador e nos logs.
    const resposta = await fetch("/api/cpf", {
      method: "POST",
      signal: controller.signal,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ cpf: validacao.cpf }),
    });

    if (options?.signal?.aborted) return { status: "cancelado" };

    const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string; pessoa?: DadosPessoaFisica };
    if (resposta.status === 400) return { status: "invalido", mensagem: corpo.erro ?? "CPF inválido." };
    if (resposta.status === 429) {
      return { status: "limite", mensagem: corpo.erro ?? "Muitas consultas seguidas. Tente de novo em instantes." };
    }
    if (resposta.status === 501) return { status: "nao_configurado" };
    if (!resposta.ok || !corpo.pessoa) return { status: "erro_servidor", mensagem: corpo.erro };

    return { status: "sucesso", pessoa: corpo.pessoa };
  } catch {
    if (options?.signal?.aborted) return { status: "cancelado" };
    return { status: "erro_servidor" };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbortExterno);
  }
}
