import type { ComplementoCnpj, IncentivoSuframa, InscricaoSuframa } from "@/types/cnpj";

/**
 * Cliente da API aberta da CNPJá (open.cnpja.com) — usado só pra completar o
 * cadastro da BrasilAPI com o que ela não tem: a inscrição na SUFRAMA (com
 * situação e incentivos fiscais) e o e-mail corporativo. Gratuita, sem
 * cadastro nem chave.
 *
 * Por que a CNPJá pra SUFRAMA (pesquisado em 2026-09-28):
 * - A consulta oficial da SUFRAMA (www4.suframa.gov.br/cadsuf) exige
 *   reCAPTCHA, conferido no servidor — não dá pra automatizar.
 * - Os dados abertos da SUFRAMA pararam em 31/12/2023.
 * - A API pública da CNPJws só confirma uma inscrição que você já conhece.
 * - As APIs em tempo real (SintegraWS, Infosimples, Netrin) são pagas.
 *
 * Limites: 5 consultas por minuto por IP, e os dados podem ter até 45 dias
 * de atraso. As funções da Vercel saem por IPs compartilhados com outros
 * clientes, então o limite pode estar gasto por outros — por isso o cache de
 * 24 h, e por isso a tela trata falha aqui como "sem complemento", nunca
 * como erro do cadastro.
 */

const BASE_URL = "https://open.cnpja.com/office";
const TIMEOUT_MS = 8000;
const CACHE_SEGUNDOS = 24 * 60 * 60;

export class LimiteCnpjaError extends Error {}

interface EscritorioBruto {
  updated?: string;
  emails?: { ownership?: string; address?: string }[];
  suframa?: {
    number?: string;
    since?: string | null;
    status?: { text?: string };
    incentives?: { tribute?: string; benefit?: string; purpose?: string; basis?: string }[];
  }[];
}

function mapearIncentivo(raw: NonNullable<NonNullable<EscritorioBruto["suframa"]>[number]["incentives"]>[number]): IncentivoSuframa | undefined {
  if (!raw.tribute) return undefined;
  return {
    tributo: raw.tribute,
    beneficio: raw.benefit || undefined,
    finalidade: raw.purpose || undefined,
    fundamento: raw.basis || undefined,
  };
}

function mapearComplemento(raw: EscritorioBruto): ComplementoCnpj {
  const suframa: InscricaoSuframa[] = (raw.suframa ?? [])
    .filter((s): s is typeof s & { number: string } => Boolean(s.number))
    .map((s) => ({
      numero: s.number,
      situacao: s.status?.text || undefined,
      desde: s.since || undefined,
      incentivos: (s.incentives ?? []).map(mapearIncentivo).filter((i): i is IncentivoSuframa => Boolean(i)),
    }));

  return {
    suframa,
    emails: (raw.emails ?? [])
      .filter((e) => e.ownership === "CORPORATE" && e.address)
      .map((e) => e.address!.toLowerCase()),
    atualizadoEm: raw.updated || undefined,
  };
}

/** Devolve `undefined` quando a CNPJá não conhece o CNPJ. */
export async function buscarComplementoCnpj(cnpj: string, signal?: AbortSignal): Promise<ComplementoCnpj | undefined> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(`${BASE_URL}/${cnpj}`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/json", "User-Agent": "RadarLicitacoes/1.0" },
    next: { revalidate: CACHE_SEGUNDOS },
  });

  if (resposta.status === 404) return undefined;
  if (resposta.status === 429) throw new LimiteCnpjaError("CNPJá: limite de consultas por minuto atingido");
  if (!resposta.ok) throw new Error(`CNPJá respondeu ${resposta.status}`);

  return mapearComplemento((await resposta.json()) as EscritorioBruto);
}
