/**
 * Filtros da busca de nomes técnicos, usados nos dois lados (tela e rota).
 *
 * Os rótulos das categorias são exatamente os valores de
 * `descricaoTipoProduto` que a ANVISA devolve (conferido em 2026-09-25) — o
 * filtro compara com eles. Se a ANVISA criar uma categoria nova, a busca por
 * texto continua achando os nomes dela; só o filtro não a oferece.
 */

export const CATEGORIAS_NOME_TECNICO = [
  { valor: "material", rotulo: "Equipamento ou Material" },
  { valor: "diagnostico", rotulo: "Diagnóstico in vitro" },
] as const;

export type CategoriaNomeTecnico = (typeof CATEGORIAS_NOME_TECNICO)[number]["valor"];

export const CLASSES_RISCO = ["I", "II", "III", "IV"] as const;

/** "nenhuma" = sem classe de risco vinculada — mais da metade da base. */
export type FiltroClasseRisco = (typeof CLASSES_RISCO)[number] | "nenhuma";

export function ehCategoriaNomeTecnico(valor: string): valor is CategoriaNomeTecnico {
  return CATEGORIAS_NOME_TECNICO.some((c) => c.valor === valor);
}

export function ehFiltroClasseRisco(valor: string): valor is FiltroClasseRisco {
  return valor === "nenhuma" || (CLASSES_RISCO as readonly string[]).includes(valor);
}
