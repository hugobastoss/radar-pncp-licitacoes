/**
 * Verificação leve de disponibilidade das duas fontes de dados do PNCP —
 * alimenta só o indicador de status do cabeçalho (components/ui/StatusPncp.tsx).
 * Não reaproveita lib/server/pncp-client.ts nem lib/server/pncp-search-client.ts
 * porque aqui basta saber se o serviço responde, sem buscar nem mapear
 * licitações de verdade.
 */

const TIMEOUT_MS = 6000;

export interface StatusPncp {
  /** API de busca interna — fonte primária usada em app/api/licitacoes. */
  primaria: boolean;
  /** API de consulta oficial — fonte de contingência. */
  fallback: boolean;
}

/**
 * O PNCP costuma resetar a conexão (ECONNRESET) de forma esporádica mesmo
 * quando está no ar — por isso duas tentativas antes de considerar a fonte
 * fora do ar, para o indicador não "piscar" por causa de uma falha passageira.
 */
async function respondeOk(url: string): Promise<boolean> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const resposta = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });
      // 204 ("sem resultados para esse filtro") também indica que o serviço está no ar.
      return resposta.ok || resposta.status === 204;
    } catch {
      // tenta mais uma vez antes de desistir
    }
  }
  return false;
}

function dataFinalAmanha(): string {
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const ano = amanha.getUTCFullYear();
  const mes = String(amanha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(amanha.getUTCDate()).padStart(2, "0");
  return `${ano}${mes}${dia}`;
}

export async function verificarStatusPncp(): Promise<StatusPncp> {
  const [primaria, fallback] = await Promise.all([
    // A API rejeita `q` vazio ou ausente (400) — um espaço em branco é o
    // valor mais neutro que ela aceita, só para testar se responde.
    respondeOk(
      "https://pncp.gov.br/api/search/?q=%20&tipos_documento=edital&pagina=1&tam_pagina=1&ordenacao=-data_publicacao_pncp",
    ),
    respondeOk(
      `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal=${dataFinalAmanha()}&codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=1`,
    ),
  ]);

  return { primaria, fallback };
}
