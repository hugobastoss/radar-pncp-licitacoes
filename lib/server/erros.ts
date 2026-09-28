/**
 * Texto curto do motivo real de uma falha, pra log e diagnóstico (nunca pra
 * tela). Ex.: "Portal da Transparência (ceis) respondeu 403" ou, quando é
 * erro de rede, "fetch failed (ECONNRESET)" — o `fetch` do Node deixa o
 * motivo de rede em `cause`, e sem ele toda falha vira "fetch failed".
 */
export function descreverFalha(erro: unknown): string {
  if (!(erro instanceof Error)) return String(erro);
  const causa = erro.cause instanceof Error ? (erro.cause as Error & { code?: string }) : undefined;
  return causa ? `${erro.message} (${causa.code ?? causa.message})` : erro.message;
}
