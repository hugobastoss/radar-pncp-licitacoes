import type { ProdutoSaude } from "@/types/produto-saude";

/**
 * Cliente da API "Consultas Externas" da ANVISA — consulta de produtos para
 * saúde (dispositivos médicos, materiais hospitalares etc.) registrados.
 * Exige OAuth2 client_credentials (Keycloak, realm "externo"): registre um
 * app em api.anvisa.gov.br para obter CLIENT_ID/CLIENT_SECRET.
 *
 * Um token é gerado a cada chamada (expira em ~29 min) — dado o volume
 * baixo de uso esperado aqui, não vale a complexidade de cachear entre
 * requisições serverless.
 */

const TOKEN_URL = "https://acesso.prd.apps.anvisa.gov.br/auth/realms/externo/protocol/openid-connect/token";
const API_URL = "https://api-gateway.prd.apps.anvisa.gov.br/consultas-externas-api/api/v1/saude";
const TIMEOUT_MS = 10000;
const USER_AGENT = "RadarLicitacoes/1.0";

export interface CredenciaisAnvisa {
  clientId: string;
  clientSecret: string;
}

interface ProdutoSaudeBruto {
  processo?: string;
  empresa?: { cnpj?: string; razaoSocial?: string };
  produto?: string;
  registro?: string;
  situacao?: string;
  dataVencimento?: number;
  cancelado?: number;
  siglaRiscoProduto?: string;
}

interface RespostaPaginadaAnvisa {
  content?: ProdutoSaudeBruto[];
  totalElements?: number;
}

async function obterToken(credenciais: CredenciaisAnvisa, signal?: AbortSignal): Promise<string> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const corpo = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credenciais.clientId,
    client_secret: credenciais.clientSecret,
  });

  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.any(sinaisAbortar),
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
    body: corpo,
  });

  if (!resposta.ok) throw new Error(`ANVISA (token) respondeu ${resposta.status}`);

  const dados = (await resposta.json()) as { access_token?: string };
  if (!dados.access_token) throw new Error("ANVISA não devolveu access_token");
  return dados.access_token;
}

function mapearProduto(raw: ProdutoSaudeBruto): ProdutoSaude | undefined {
  if (!raw.produto || !raw.registro) return undefined;
  return {
    processo: raw.processo,
    produto: raw.produto,
    registro: raw.registro,
    situacao: raw.situacao,
    cnpjEmpresa: raw.empresa?.cnpj,
    razaoSocialEmpresa: raw.empresa?.razaoSocial,
    dataVencimento: raw.dataVencimento ? new Date(raw.dataVencimento).toISOString() : undefined,
    cancelado: raw.cancelado === 1,
    siglaRiscoProduto: raw.siglaRiscoProduto,
  };
}

export async function buscarProdutosSaude(
  termo: string,
  credenciais: CredenciaisAnvisa,
  signal?: AbortSignal,
): Promise<{ itens: ProdutoSaude[]; total: number }> {
  const token = await obterToken(credenciais, signal);

  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(API_URL, {
    method: "POST",
    signal: AbortSignal.any(sinaisAbortar),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      count: 20,
      page: "1",
      order: "ASC",
      filter: { nomeProduto: termo },
    }),
  });

  if (!resposta.ok) throw new Error(`ANVISA (consulta) respondeu ${resposta.status}`);

  const corpo = (await resposta.json()) as RespostaPaginadaAnvisa;
  const itens = (corpo.content ?? []).map(mapearProduto).filter((item): item is ProdutoSaude => item !== undefined);
  return { itens, total: corpo.totalElements ?? itens.length };
}
