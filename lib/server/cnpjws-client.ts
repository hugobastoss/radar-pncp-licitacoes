import { mapearInscricoesEstaduais } from "@/lib/fontes-publicas";
import type { CnpjWsBruto } from "@/lib/fontes-publicas";
import type { InscricaoEstadual } from "@/types/fontes-publicas";

/**
 * Inscrições estaduais (o que o Sintegra de cada estado informa) pela API
 * pública da CNPJ.ws. Gratuita, sem chave.
 *
 * Por que a CNPJ.ws (pesquisado em 2026-09-30): a via oficial, o Cadastro
 * Centralizado de Contribuintes, exige certificado digital e-CNPJ; o
 * Sintegra de cada estado só tem site com captcha; e a API aberta da CNPJá,
 * que já usamos pra SUFRAMA, não devolve inscrições estaduais.
 *
 * Limite: 3 consultas por minuto por IP — e as funções da Vercel saem por
 * IPs compartilhados, então ele pode estar gasto por outros. Por isso a tela
 * só consulta quando a pessoa pede, e trata o 429 como "tente de novo".
 */
const BASE_URL = "https://publica.cnpj.ws/cnpj";
const TIMEOUT_MS = 8000;
const CACHE_SEGUNDOS = 24 * 60 * 60;

export class LimiteCnpjWsError extends Error {}

/** Lista vazia quando a CNPJ.ws não conhece o CNPJ ou ele não tem inscrição. */
export async function buscarInscricoesEstaduais(cnpj: string, signal?: AbortSignal): Promise<InscricaoEstadual[]> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(`${BASE_URL}/${cnpj}`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/json", "User-Agent": "QBuscado/1.0" },
    next: { revalidate: CACHE_SEGUNDOS },
  });

  if (resposta.status === 404) return [];
  if (resposta.status === 429) throw new LimiteCnpjWsError("CNPJ.ws: limite de consultas por minuto atingido");
  if (!resposta.ok) throw new Error(`CNPJ.ws respondeu ${resposta.status}`);

  return mapearInscricoesEstaduais((await resposta.json()) as CnpjWsBruto);
}
