import { mapearRegistroDominio } from "@/lib/fontes-publicas";
import type { DominioRdapBruto } from "@/lib/fontes-publicas";
import type { RegistroDominio } from "@/types/fontes-publicas";

/**
 * Quem registrou um domínio .br, pelo RDAP do registro.br (o sucessor do
 * WhoIs). Gratuito, sem chave. O próprio registro.br resolve subdomínios
 * ("mail.empresa.com.br" responde como "empresa.com.br") e devolve 404 pra
 * domínio que não existe.
 *
 * O limite de consultas não é publicado e a resposta não traz cabeçalhos de
 * limite — por isso o cache de 24 h e o limite por visitante na rota.
 */
const BASE_URL = "https://rdap.registro.br/domain";
const TIMEOUT_MS = 8000;
const CACHE_SEGUNDOS = 24 * 60 * 60;

export class LimiteRegistroBrError extends Error {}

/** Devolve `undefined` quando o domínio não está registrado. */
export async function buscarDominio(dominio: string, signal?: AbortSignal): Promise<RegistroDominio | undefined> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(`${BASE_URL}/${encodeURIComponent(dominio)}`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/rdap+json", "User-Agent": "QBuscado/1.0" },
    next: { revalidate: CACHE_SEGUNDOS },
  });

  if (resposta.status === 404 || resposta.status === 400) return undefined;
  if (resposta.status === 429) throw new LimiteRegistroBrError("registro.br: limite de consultas atingido");
  if (!resposta.ok) throw new Error(`registro.br respondeu ${resposta.status}`);

  return mapearRegistroDominio((await resposta.json()) as DominioRdapBruto);
}
