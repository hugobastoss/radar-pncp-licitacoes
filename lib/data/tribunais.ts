import { ESTADOS } from "@/lib/data/estados";

/**
 * Tribunais indexados pela API pública do DataJud (CNJ) — um índice
 * Elasticsearch por tribunal, em `api_publica_{alias}`. Lista conferida ao
 * vivo em 2026-09-30 contra https://datajud-wiki.cnj.jus.br/api-publica/endpoints
 * (91 tribunais). O STF não integra o DataJud — não tem alias aqui.
 */
export interface OpcaoTribunal {
  /** Usado como `api_publica_{alias}` no endpoint do DataJud. */
  alias: string;
  nome: string;
  grupo:
    | "Tribunais Superiores"
    | "Justiça Federal"
    | "Justiça Estadual"
    | "Justiça do Trabalho"
    | "Justiça Eleitoral"
    | "Justiça Militar Estadual";
}

// A API usa "tjdft"/"tre-dft" pro Distrito Federal, não "tjdf"/"tre-df".
const ALIAS_TJ_ESPECIAL: Record<string, string> = { DF: "tjdft" };
const ALIAS_TRE_ESPECIAL: Record<string, string> = { DF: "tre-dft" };

export const TRIBUNAIS: OpcaoTribunal[] = [
  { alias: "stj", nome: "STJ — Superior Tribunal de Justiça", grupo: "Tribunais Superiores" },
  { alias: "tst", nome: "TST — Tribunal Superior do Trabalho", grupo: "Tribunais Superiores" },
  { alias: "tse", nome: "TSE — Tribunal Superior Eleitoral", grupo: "Tribunais Superiores" },
  { alias: "stm", nome: "STM — Superior Tribunal Militar", grupo: "Tribunais Superiores" },

  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    alias: `trf${n}`,
    nome: `TRF${n} — Tribunal Regional Federal da ${n}ª Região`,
    grupo: "Justiça Federal" as const,
  })),

  ...ESTADOS.map((e) => ({
    alias: ALIAS_TJ_ESPECIAL[e.sigla] ?? `tj${e.sigla.toLowerCase()}`,
    nome: `TJ${e.sigla} — Tribunal de Justiça de ${e.nome}`,
    grupo: "Justiça Estadual" as const,
  })),

  ...Array.from({ length: 24 }, (_, i) => i + 1).map((n) => ({
    alias: `trt${n}`,
    nome: `TRT${n} — Tribunal Regional do Trabalho da ${n}ª Região`,
    grupo: "Justiça do Trabalho" as const,
  })),

  ...ESTADOS.map((e) => ({
    alias: ALIAS_TRE_ESPECIAL[e.sigla] ?? `tre-${e.sigla.toLowerCase()}`,
    nome: `TRE${e.sigla} — Tribunal Regional Eleitoral de ${e.nome}`,
    grupo: "Justiça Eleitoral" as const,
  })),

  { alias: "tjmmg", nome: "TJM-MG — Tribunal de Justiça Militar de Minas Gerais", grupo: "Justiça Militar Estadual" },
  { alias: "tjmrs", nome: "TJM-RS — Tribunal de Justiça Militar do Rio Grande do Sul", grupo: "Justiça Militar Estadual" },
  { alias: "tjmsp", nome: "TJM-SP — Tribunal de Justiça Militar de São Paulo", grupo: "Justiça Militar Estadual" },
];

export function tribunalPorAlias(alias: string): OpcaoTribunal | undefined {
  return TRIBUNAIS.find((t) => t.alias === alias);
}
