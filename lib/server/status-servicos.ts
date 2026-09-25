/**
 * Health check leve de todas as fontes de dados externas do app — alimenta
 * o indicador de status do cabeçalho (components/ui/StatusServicos.tsx).
 * Cada função aqui só verifica se o serviço responde, com o payload mais
 * barato possível — nunca busca nem mapeia dados de verdade, por isso não
 * reaproveita os clientes reais em lib/server/*-client.ts.
 */

export type NivelServico = "operacional" | "instavel" | "indisponivel" | "nao_configurado";

export interface StatusServicos {
  /** Busca interna (primária) + consulta oficial do PNCP, combinadas. */
  pncp: NivelServico;
  comprasGovBr: NivelServico;
  brasilApi: NivelServico;
  portalTransparencia: NivelServico;
  anvisa: NivelServico;
}

const TIMEOUT_MS = 6000;
const USER_AGENT = "RadarLicitacoes/1.0";

/**
 * O PNCP costuma resetar a conexão (ECONNRESET) de forma esporádica mesmo
 * quando está no ar — por isso duas tentativas antes de considerar a fonte
 * fora do ar, para o indicador não "piscar" por causa de uma falha passageira.
 */
async function respondeOk(url: string, headers?: Record<string, string>): Promise<boolean> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const resposta = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "application/json", ...headers },
      });
      // 204 ("sem resultados para esse filtro") também indica que o serviço está no ar.
      return resposta.ok || resposta.status === 204;
    } catch {
      // tenta mais uma vez antes de desistir
    }
  }
  return false;
}

function dataYYYYMMDD(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}${mes}${dia}`;
}

// O Compras.gov.br exige o formato com hífen (YYYY-MM-DD) — diferente do
// formato compacto que a API oficial do PNCP usa acima.
function dataComHifen(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

async function statusPncp(): Promise<NivelServico> {
  const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [primaria, oficial] = await Promise.all([
    // A API rejeita `q` vazio ou ausente (400) — um espaço em branco é o
    // valor mais neutro que ela aceita, só para testar se responde.
    respondeOk(
      "https://pncp.gov.br/api/search/?q=%20&tipos_documento=edital&pagina=1&tam_pagina=1&ordenacao=-data_publicacao_pncp",
    ),
    respondeOk(
      `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal=${dataYYYYMMDD(amanha)}&codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=1`,
    ),
  ]);
  if (primaria) return "operacional";
  if (oficial) return "instavel";
  return "indisponivel";
}

async function statusComprasGovBr(): Promise<NivelServico> {
  const hoje = dataComHifen(new Date());
  const query = new URLSearchParams({
    dataPublicacaoPncpInicial: hoje,
    dataPublicacaoPncpFinal: hoje,
    codigoModalidade: "6",
    pagina: "1",
    tamanhoPagina: "10",
  });
  const ok = await respondeOk(
    `https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133?${query}`,
  );
  return ok ? "operacional" : "indisponivel";
}

async function statusBrasilApi(): Promise<NivelServico> {
  // CEP fixo e real (Av. Paulista, SP) só para confirmar que a API responde.
  const ok = await respondeOk("https://brasilapi.com.br/api/cep/v2/01310930", { "User-Agent": USER_AGENT });
  return ok ? "operacional" : "indisponivel";
}

async function statusPortalTransparencia(): Promise<NivelServico> {
  const chave = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!chave) return "nao_configurado";

  const ok = await respondeOk(
    "https://api.portaldatransparencia.gov.br/api-de-dados/ceis?codigoSancionado=00000000000191&pagina=1",
    { "chave-api-dados": chave, "User-Agent": "Mozilla/5.0 (compatible; RadarLicitacoes/1.0)" },
  );
  return ok ? "operacional" : "indisponivel";
}

async function statusAnvisa(): Promise<NivelServico> {
  const clientId = process.env.ANVISA_CLIENT_ID;
  const clientSecret = process.env.ANVISA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return "nao_configurado";

  // Só gera um token (Keycloak) — se o auth responde, o resto do gateway
  // depende dele mesmo assim, e evita gastar cota do rate limit da consulta.
  try {
    const corpo = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });
    const resposta = await fetch(
      "https://acesso.prd.apps.anvisa.gov.br/auth/realms/externo/protocol/openid-connect/token",
      {
        method: "POST",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: corpo,
      },
    );
    return resposta.ok ? "operacional" : "indisponivel";
  } catch {
    return "indisponivel";
  }
}

export async function verificarStatusServicos(): Promise<StatusServicos> {
  const [pncp, comprasGovBr, brasilApi, portalTransparencia, anvisa] = await Promise.all([
    statusPncp(),
    statusComprasGovBr(),
    statusBrasilApi(),
    statusPortalTransparencia(),
    statusAnvisa(),
  ]);
  return { pncp, comprasGovBr, brasilApi, portalTransparencia, anvisa };
}
