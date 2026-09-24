import type { ProdutoSaude } from "@/types/produto-saude";
import type { NomeTecnico } from "@/types/nome-tecnico";

/**
 * Cliente da API "Consultas Externas" da ANVISA — produtos para saúde
 * (dispositivos médicos, materiais hospitalares) e nomenclatura técnica.
 * Exige OAuth2 client_credentials (Keycloak, realm "externo"): registre um
 * app em api.anvisa.gov.br para obter CLIENT_ID/CLIENT_SECRET.
 *
 * Um token é gerado a cada chamada (expira em ~29 min) — dado o volume
 * baixo de uso esperado aqui, não vale a complexidade de cachear entre
 * requisições serverless.
 *
 * Nem todo endpoint documentado no Swagger deste gateway está de fato
 * roteado: `/api/v1/certificadoMedicamento` (busca de Certificado de Boas
 * Práticas de Fabricação) devolve 404 mesmo com o payload exato do exemplo
 * da documentação, enquanto os endpoints de apoio dele (`/status`,
 * `/classesCertificacao`) funcionam normalmente — não integramos essa busca
 * por não conseguir validar que ela responde de verdade.
 */

const TOKEN_URL = "https://acesso.prd.apps.anvisa.gov.br/auth/realms/externo/protocol/openid-connect/token";
const BASE_URL = "https://api-gateway.prd.apps.anvisa.gov.br/consultas-externas-api/api/v1";
const TIMEOUT_MS = 10000;
const USER_AGENT = "RadarLicitacoes/1.0";

export interface CredenciaisAnvisa {
  clientId: string;
  clientSecret: string;
}

interface RespostaPaginadaAnvisa<T> {
  content?: T[];
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

/** POST autenticado num endpoint de consulta paginada da ANVISA (busca o token primeiro). */
async function consultarPaginado<TBruto>(
  caminho: string,
  corpo: Record<string, unknown>,
  credenciais: CredenciaisAnvisa,
  signal?: AbortSignal,
): Promise<RespostaPaginadaAnvisa<TBruto>> {
  const token = await obterToken(credenciais, signal);

  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(`${BASE_URL}/${caminho}`, {
    method: "POST",
    signal: AbortSignal.any(sinaisAbortar),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) throw new Error(`ANVISA (${caminho}) respondeu ${resposta.status}`);
  return (await resposta.json()) as RespostaPaginadaAnvisa<TBruto>;
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
  const corpo = await consultarPaginado<ProdutoSaudeBruto>(
    "saude",
    { count: 20, page: "1", order: "ASC", filter: { nomeProduto: termo } },
    credenciais,
    signal,
  );
  const itens = (corpo.content ?? []).map(mapearProduto).filter((item): item is ProdutoSaude => item !== undefined);
  return { itens, total: corpo.totalElements ?? itens.length };
}

interface NomeTecnicoBruto {
  codigo?: string;
  nomeTecnico?: string;
  descricaoTipoProduto?: string;
  classeRisco?: string;
}

function mapearNomeTecnico(raw: NomeTecnicoBruto): NomeTecnico | undefined {
  if (!raw.codigo || !raw.nomeTecnico) return undefined;
  return {
    codigo: raw.codigo,
    nomeTecnico: raw.nomeTecnico,
    descricaoTipoProduto: raw.descricaoTipoProduto || undefined,
    classeRisco: raw.classeRisco || undefined,
  };
}

export async function buscarNomesTecnicos(
  termo: string,
  credenciais: CredenciaisAnvisa,
  signal?: AbortSignal,
): Promise<{ itens: NomeTecnico[]; total: number }> {
  const corpo = await consultarPaginado<NomeTecnicoBruto>(
    "nomeTecnico",
    { size: 20, page: "1", filter: { nomeTecnico: termo } },
    credenciais,
    signal,
  );
  const itens = (corpo.content ?? [])
    .map(mapearNomeTecnico)
    .filter((item): item is NomeTecnico => item !== undefined);
  return { itens, total: corpo.totalElements ?? itens.length };
}
