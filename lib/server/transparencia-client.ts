/**
 * Cliente da API de Dados do Portal da Transparência (CGU) — consulta CEIS
 * (empresas inidôneas/suspensas) e CNEP (empresas punidas, Lei
 * Anticorrupção). Exige uma chave gratuita (cadastro em
 * portaldatransparencia.gov.br/api-de-dados), enviada no header
 * `chave-api-dados`.
 *
 * Duas pegadinhas descobertas testando com uma chave real:
 * 1. A API migrou de portaldatransparencia.gov.br para este domínio
 *    (api.portaldatransparencia.gov.br) — o domínio antigo só devolve um
 *    redirecionamento em texto plano.
 * 2. Requisições sem um User-Agent de navegador são bloqueadas pela
 *    proteção anti-bot (WAF) antes mesmo de chegar na API.
 */

const BASE_URL = "https://api.portaldatransparencia.gov.br/api-de-dados";
const TIMEOUT_MS = 10000;
const USER_AGENT = "Mozilla/5.0 (compatible; RadarLicitacoes/1.0)";

export interface Sancao {
  id: number;
  tipo: "CEIS" | "CNEP";
  tipoSancao: string;
  /** Já vem formatada (DD/MM/AAAA) pela própria API — exibir como está. */
  dataInicioSancao?: string;
  dataFimSancao?: string;
  orgaoSancionador?: string;
  nomeSancionado: string;
  numeroProcesso?: string;
}

export interface ResultadoSancoes {
  ceis: Sancao[];
  cnep: Sancao[];
}

interface TipoSancaoBruto {
  descricaoResumida?: string;
}

interface OrgaoSancionadorBruto {
  nome?: string;
}

interface SancionadoBruto {
  nome?: string;
}

interface SancaoBruta {
  id: number;
  tipoSancao?: TipoSancaoBruto;
  dataInicioSancao?: string;
  dataFimSancao?: string;
  orgaoSancionador?: OrgaoSancionadorBruto;
  sancionado?: SancionadoBruto;
  numeroProcesso?: string;
}

function mapearSancao(raw: SancaoBruta, tipo: "CEIS" | "CNEP"): Sancao {
  return {
    id: raw.id,
    tipo,
    tipoSancao: raw.tipoSancao?.descricaoResumida ?? "Tipo não informado",
    dataInicioSancao: raw.dataInicioSancao,
    dataFimSancao: raw.dataFimSancao,
    orgaoSancionador: raw.orgaoSancionador?.nome,
    nomeSancionado: raw.sancionado?.nome ?? "Não informado",
    numeroProcesso: raw.numeroProcesso,
  };
}

async function buscarLista(caminho: "ceis" | "cnep", cnpj: string, chave: string, signal?: AbortSignal): Promise<Sancao[]> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(`${BASE_URL}/${caminho}?codigoSancionado=${cnpj}&pagina=1`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/json", "chave-api-dados": chave, "User-Agent": USER_AGENT },
  });

  // 204/404 tratados como "nada consta" — o resultado esperado pra maioria das empresas.
  if (resposta.status === 204 || resposta.status === 404) return [];
  if (!resposta.ok) {
    throw new Error(`Portal da Transparência (${caminho}) respondeu ${resposta.status}`);
  }

  const corpo = (await resposta.json()) as SancaoBruta[];
  return Array.isArray(corpo) ? corpo.map((item) => mapearSancao(item, caminho.toUpperCase() as "CEIS" | "CNEP")) : [];
}

export async function buscarSancoes(cnpj: string, chave: string, signal?: AbortSignal): Promise<ResultadoSancoes> {
  const [ceis, cnep] = await Promise.all([
    buscarLista("ceis", cnpj, chave, signal),
    buscarLista("cnep", cnpj, chave, signal),
  ]);
  return { ceis, cnep };
}
