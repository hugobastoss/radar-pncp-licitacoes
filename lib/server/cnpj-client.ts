import type { Empresa } from "@/types/cnpj";

/**
 * Cliente da BrasilAPI para consulta de CNPJ — espelha dados públicos da
 * Receita Federal (situação cadastral, sócios, endereço etc.), sem
 * necessidade de autenticação. https://brasilapi.com.br
 */

const BASE_URL = "https://brasilapi.com.br/api/cnpj/v1";
const TIMEOUT_MS = 8000;

export class CnpjNaoEncontradoError extends Error {}

interface SocioBrasilApi {
  nome_socio?: string;
  qualificacao_socio?: string;
  data_entrada_sociedade?: string;
}

interface CnaeSecundarioBrasilApi {
  codigo?: number;
  descricao?: string;
}

interface EmpresaBrasilApi {
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  descricao_motivo_situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: CnaeSecundarioBrasilApi[];
  ddd_telefone_1?: string;
  email?: string | null;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  qsa?: SocioBrasilApi[];
}

function mapearParaEmpresa(raw: EmpresaBrasilApi, cnpjDigitos: string): Empresa {
  const enderecoPartes = [raw.logradouro, raw.numero, raw.complemento].filter(Boolean).join(", ");

  return {
    cnpj: cnpjDigitos,
    razaoSocial: raw.razao_social ?? "Razão social não informada",
    nomeFantasia: raw.nome_fantasia || undefined,
    situacaoCadastral: raw.descricao_situacao_cadastral,
    motivoSituacaoCadastral:
      raw.descricao_motivo_situacao_cadastral && raw.descricao_motivo_situacao_cadastral !== "SEM MOTIVO"
        ? raw.descricao_motivo_situacao_cadastral
        : undefined,
    dataSituacaoCadastral: raw.data_situacao_cadastral ?? undefined,
    dataInicioAtividade: raw.data_inicio_atividade,
    naturezaJuridica: raw.natureza_juridica,
    porte: raw.porte,
    capitalSocial: raw.capital_social,
    atividadePrincipal: raw.cnae_fiscal_descricao,
    atividadesSecundarias: (raw.cnaes_secundarios ?? [])
      .map((c) => c.descricao)
      .filter((descricao): descricao is string => Boolean(descricao)),
    telefone: raw.ddd_telefone_1 || undefined,
    email: raw.email || undefined,
    endereco: enderecoPartes || undefined,
    bairro: raw.bairro || undefined,
    municipio: raw.municipio,
    uf: raw.uf,
    cep: raw.cep,
    socios: (raw.qsa ?? [])
      .filter((s): s is SocioBrasilApi & { nome_socio: string } => Boolean(s.nome_socio))
      .map((s) => ({
        nome: s.nome_socio,
        qualificacao: s.qualificacao_socio ?? "Não informada",
        dataEntrada: s.data_entrada_sociedade,
      })),
  };
}

export async function buscarEmpresaPorCnpj(cnpjDigitos: string, signal?: AbortSignal): Promise<Empresa> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(`${BASE_URL}/${cnpjDigitos}`, {
    signal: AbortSignal.any(sinaisAbortar),
    // A BrasilAPI bloqueia (403) requisições sem User-Agent — o fetch do
    // Node, ao contrário do navegador, não manda um por padrão.
    headers: { Accept: "application/json", "User-Agent": "RadarLicitacoes/1.0" },
  });

  if (resposta.status === 404) {
    throw new CnpjNaoEncontradoError("CNPJ não encontrado");
  }
  if (!resposta.ok) {
    throw new Error(`BrasilAPI respondeu ${resposta.status}`);
  }

  const corpo = (await resposta.json()) as EmpresaBrasilApi;
  return mapearParaEmpresa(corpo, cnpjDigitos);
}
