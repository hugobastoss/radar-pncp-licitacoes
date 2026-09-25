import type { Cnae, Empresa, OpcaoRegime } from "@/types/cnpj";

/**
 * Cliente de consulta de CNPJ — espelha dados públicos da Receita Federal
 * (situação cadastral, sócios, endereço etc.), sem necessidade de
 * autenticação.
 *
 * Duas fontes em cascata, com exatamente o mesmo formato de resposta
 * (conferido campo a campo): a BrasilAPI (primária) e a Minha Receita
 * (fallback), hospedadas em infraestruturas diferentes (Vercel e fly.io). A
 * segunda só é chamada quando a primeira falha por instabilidade (rede,
 * timeout, 5xx, 429…) — "não encontrado" (404) e "inválido" (400) são
 * respostas definitivas e encerram a cascata.
 */

const FONTES = [
  { nome: "BrasilAPI", url: (cnpj: string) => `https://brasilapi.com.br/api/cnpj/v1/${cnpj}` },
  { nome: "Minha Receita", url: (cnpj: string) => `https://minhareceita.org/${cnpj}` },
];

// Por fonte. No pior caso (as duas esgotando) ainda cabe no timeout de 12 s
// do navegador (lib/api-cnpj.ts).
const TIMEOUT_MS = 5000;

// Dado cadastral muda pouco. O cache do Next só guarda respostas 200, então
// um 404 ou uma falha nunca ficam presos.
const CACHE_SEGUNDOS = 24 * 60 * 60;

export class CnpjNaoEncontradoError extends Error {}
export class CnpjInvalidoError extends Error {}

interface SocioBrasilApi {
  nome_socio?: string;
  qualificacao_socio?: string;
  data_entrada_sociedade?: string;
}

interface CnaeSecundarioBrasilApi {
  codigo?: number;
  descricao?: string;
}

interface RegimeTributarioBrasilApi {
  ano?: number;
  forma_de_tributacao?: string;
}

interface EmpresaBrasilApi {
  razao_social?: string;
  nome_fantasia?: string;
  descricao_identificador_matriz_filial?: string;
  descricao_situacao_cadastral?: string;
  descricao_motivo_situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  natureza_juridica?: string;
  ente_federativo_responsavel?: string;
  porte?: string;
  capital_social?: number;
  opcao_pelo_simples?: boolean | null;
  data_opcao_pelo_simples?: string | null;
  data_exclusao_do_simples?: string | null;
  opcao_pelo_mei?: boolean | null;
  data_opcao_pelo_mei?: string | null;
  data_exclusao_do_mei?: string | null;
  regime_tributario?: RegimeTributarioBrasilApi[];
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: CnaeSecundarioBrasilApi[];
  ddd_telefone_1?: string;
  ddd_telefone_2?: string;
  email?: string | null;
  descricao_tipo_de_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  qsa?: SocioBrasilApi[];
}

/** O código vem como número (3514000), sem o zero à esquerda de códigos como 0111-3/01. */
function mapearCnae(codigo: number | undefined, descricao: string | undefined): Cnae | undefined {
  if (!descricao) return undefined;
  if (!codigo) return { descricao };
  const d = String(codigo).padStart(7, "0");
  return { codigo: `${d.slice(0, 2)}.${d.slice(2, 4)}-${d.slice(4, 5)}-${d.slice(5)}`, descricao };
}

// `opcao` vem `null` quando a empresa nunca optou, e `false` com data de
// exclusão quando já optou e saiu.
function mapearOpcao(
  opcao: boolean | null | undefined,
  dataOpcao: string | null | undefined,
  dataExclusao: string | null | undefined,
): OpcaoRegime {
  return { optante: opcao === true, dataOpcao: dataOpcao || undefined, dataExclusao: dataExclusao || undefined };
}

// O tipo ("AVENIDA", "RUA"…) vem num campo separado do nome do logradouro.
function montarLogradouro(tipo: string | undefined, logradouro: string | undefined): string | undefined {
  if (!logradouro) return undefined;
  if (!tipo || logradouro.toUpperCase().startsWith(`${tipo.toUpperCase()} `)) return logradouro;
  return `${tipo} ${logradouro}`;
}

function mapearParaEmpresa(raw: EmpresaBrasilApi, cnpj: string): Empresa {
  const enderecoPartes = [montarLogradouro(raw.descricao_tipo_de_logradouro, raw.logradouro), raw.numero, raw.complemento]
    .filter(Boolean)
    .join(", ");

  const regimeMaisRecente = (raw.regime_tributario ?? [])
    .filter((r): r is { ano: number; forma_de_tributacao: string } => Boolean(r.ano && r.forma_de_tributacao))
    .sort((a, b) => b.ano - a.ano)[0];

  return {
    cnpj,
    razaoSocial: raw.razao_social ?? "Razão social não informada",
    nomeFantasia: raw.nome_fantasia || undefined,
    matrizOuFilial: raw.descricao_identificador_matriz_filial || undefined,
    situacaoCadastral: raw.descricao_situacao_cadastral,
    motivoSituacaoCadastral:
      raw.descricao_motivo_situacao_cadastral && raw.descricao_motivo_situacao_cadastral !== "SEM MOTIVO"
        ? raw.descricao_motivo_situacao_cadastral
        : undefined,
    dataSituacaoCadastral: raw.data_situacao_cadastral ?? undefined,
    dataInicioAtividade: raw.data_inicio_atividade,
    naturezaJuridica: raw.natureza_juridica,
    enteFederativo: raw.ente_federativo_responsavel || undefined,
    porte: raw.porte,
    capitalSocial: raw.capital_social,
    simples: mapearOpcao(raw.opcao_pelo_simples, raw.data_opcao_pelo_simples, raw.data_exclusao_do_simples),
    mei: mapearOpcao(raw.opcao_pelo_mei, raw.data_opcao_pelo_mei, raw.data_exclusao_do_mei),
    regimeTributario: regimeMaisRecente
      ? { ano: regimeMaisRecente.ano, forma: regimeMaisRecente.forma_de_tributacao }
      : undefined,
    atividadePrincipal: mapearCnae(raw.cnae_fiscal, raw.cnae_fiscal_descricao),
    atividadesSecundarias: (raw.cnaes_secundarios ?? [])
      .map((c) => mapearCnae(c.codigo, c.descricao))
      .filter((cnae): cnae is Cnae => Boolean(cnae)),
    telefones: [raw.ddd_telefone_1, raw.ddd_telefone_2].filter((t): t is string => Boolean(t?.trim())),
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

async function consultarFonte(
  fonte: (typeof FONTES)[number],
  cnpj: string,
  signal?: AbortSignal,
): Promise<Empresa> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(fonte.url(cnpj), {
    signal: AbortSignal.any(sinaisAbortar),
    // A BrasilAPI bloqueia (403) requisições sem User-Agent — o fetch do
    // Node, ao contrário do navegador, não manda um por padrão.
    headers: { Accept: "application/json", "User-Agent": "RadarLicitacoes/1.0" },
    next: { revalidate: CACHE_SEGUNDOS },
  });

  if (resposta.status === 404) {
    throw new CnpjNaoEncontradoError("CNPJ não encontrado");
  }
  // As duas fontes validam o dígito verificador e respondem 400 quando não bate.
  if (resposta.status === 400) {
    throw new CnpjInvalidoError("CNPJ inválido");
  }
  if (!resposta.ok) {
    throw new Error(`${fonte.nome} respondeu ${resposta.status}`);
  }

  const corpo = (await resposta.json()) as EmpresaBrasilApi;
  return mapearParaEmpresa(corpo, cnpj);
}

export async function buscarEmpresaPorCnpj(cnpj: string, signal?: AbortSignal): Promise<Empresa> {
  let ultimoErro: unknown;
  for (const fonte of FONTES) {
    try {
      return await consultarFonte(fonte, cnpj, signal);
    } catch (erro) {
      // Resposta definitiva ou consulta cancelada pelo navegador: não adianta tentar a próxima fonte.
      if (erro instanceof CnpjNaoEncontradoError || erro instanceof CnpjInvalidoError || signal?.aborted) {
        throw erro;
      }
      ultimoErro = erro;
    }
  }
  throw ultimoErro;
}
