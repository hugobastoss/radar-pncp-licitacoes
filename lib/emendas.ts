/** Regras das emendas parlamentares, usadas tanto no navegador quanto no servidor. */

/** O Portal da Transparência tem emendas a partir de 2014 (2013 volta vazio). */
export const PRIMEIRO_ANO_EMENDAS = 2014;

/**
 * Valores aceitos pelo filtro `tipoEmenda` da CGU — tem que ser o texto
 * exato. "Emenda Individual" sozinho também funciona e traz os dois tipos
 * individuais.
 */
export const TIPOS_EMENDA = [
  { valor: "Emenda Individual", rotulo: "Individual (todas)" },
  { valor: "Emenda Individual - Transferências com Finalidade Definida", rotulo: "Individual — finalidade definida" },
  { valor: "Emenda Individual - Transferências Especiais", rotulo: "Individual — transferência especial (\"emenda Pix\")" },
  { valor: "Emenda de Bancada", rotulo: "Bancada" },
  { valor: "Emenda de Comissão", rotulo: "Comissão" },
  { valor: "Emenda de Relator", rotulo: "Relator" },
] as const;

/** Código da emenda: 12 dígitos (ano + código do autor + número, ex.: "202541840004"). */
export const FORMATO_CODIGO_EMENDA = /^\d{12}$/;

const PORTAL = "https://portaldatransparencia.gov.br";

export function linkEmenda(codigo: string): string {
  return `${PORTAL}/emendas/detalhe?codigoEmenda=${codigo}`;
}

const FASES_NO_PORTAL: Record<string, string> = { Empenho: "empenho", Liquidação: "liquidacao", Pagamento: "pagamento" };

/** Página do documento (empenho, liquidação ou pagamento) no Portal; `undefined` pra fase desconhecida. */
export function linkDocumentoDespesa(fase: string, codigo: string): string | undefined {
  const caminho = FASES_NO_PORTAL[fase];
  return caminho ? `${PORTAL}/despesas/documento/${caminho}/${codigo}` : undefined;
}
