/**
 * `fetch` que tenta de novo quando a conexão cai — feito pra busca do PNCP,
 * que derruba a maioria das conexões (ECONNRESET): em 2026-09-29, 1 de 10
 * chamadas passou de primeira e 9 de 10 com até 3 tentativas, sem relação
 * com o termo buscado. Resposta HTTP de erro não é retentada (quem chamou
 * decide o que fazer com ela).
 */

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Erro de rede do `fetch` do Node (ECONNRESET, conexão recusada…) — vem como TypeError "fetch failed". */
function ehQuedaDeConexao(erro: unknown): boolean {
  return erro instanceof TypeError;
}

function ehTimeout(erro: unknown): boolean {
  return erro instanceof Error && erro.name === "TimeoutError";
}

export interface OpcoesRetentativa {
  tentativas: number;
  /** Tempo máximo de cada tentativa. */
  timeoutMs: number;
  /**
   * Tentar de novo também quando uma tentativa estoura o tempo. Desligado na
   * busca de licitações: lá um timeout deve cair logo na fonte reserva, e
   * repetir 8 s várias vezes atrasaria a resposta.
   */
  retentarTimeout?: boolean;
  signal?: AbortSignal;
}

export async function buscarComRetentativa(
  url: string,
  init: Omit<RequestInit, "signal">,
  opcoes: OpcoesRetentativa,
): Promise<Response> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= opcoes.tentativas; tentativa++) {
    try {
      const sinais = [AbortSignal.timeout(opcoes.timeoutMs)];
      if (opcoes.signal) sinais.push(opcoes.signal);
      return await fetch(url, { ...init, signal: AbortSignal.any(sinais) });
    } catch (erro) {
      ultimoErro = erro;
      const vaiRetentar = ehQuedaDeConexao(erro) || (opcoes.retentarTimeout === true && ehTimeout(erro));
      if (opcoes.signal?.aborted || !vaiRetentar) throw erro;
      if (tentativa < opcoes.tentativas) await esperar(250 * tentativa);
    }
  }
  throw ultimoErro;
}
