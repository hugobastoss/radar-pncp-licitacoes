/** Links pras páginas do Portal da Transparência (CGU), usados no navegador. */

const PORTAL = "https://portaldatransparencia.gov.br";

const FASES_NO_PORTAL: Record<string, string> = { Empenho: "empenho", Liquidação: "liquidacao", Pagamento: "pagamento" };

/**
 * Página do documento (empenho, liquidação ou pagamento) no Portal;
 * `undefined` pra fase desconhecida. Pra `curl` a página responde 202
 * (desafio anti-robô), mas abre normalmente num navegador.
 */
export function linkDocumentoDespesa(fase: string, codigo: string): string | undefined {
  const caminho = FASES_NO_PORTAL[fase];
  return caminho ? `${PORTAL}/despesas/documento/${caminho}/${codigo}` : undefined;
}
