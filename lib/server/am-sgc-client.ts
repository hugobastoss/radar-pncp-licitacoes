import { emParalelo } from "@/lib/server/paralelo";
import type { AditivoEstadual, ContratoEstadual, ResultadoContratosAm } from "@/types/am";

/**
 * Cliente da API de contratos do Governo do Amazonas — SGC (Sistema de
 * Gestão de Contratos da SEFAZ-AM), publicada no Portal da Transparência do
 * estado. Sem autenticação. Swagger em
 * https://sistemas.sefaz.am.gov.br/sgc-am/api/v1/contrato.do (GET).
 *
 * Particularidades (testadas em 2026-09-28):
 * - Tudo é POST com formulário, sempre com `method=ApiTransparencia` e um
 *   `tipo` por consulta.
 * - UG e ano são obrigatórios (sem eles, 500 com `[{"erro": "ug inválida ou
 *   vazia"}]`) e **não há filtro por CNPJ** — pra achar os contratos de um
 *   fornecedor é preciso varrer as ~127 UGs, ano a ano. Cada consulta leva
 *   ~0,3 s; com 12 em paralelo, um ano inteiro sai em ~2 s.
 * - UG sem contrato no ano responde 204 (vazio).
 * - Datas vêm como AAAAMMDD; valores já numéricos; CNPJ formatado.
 * - Os empenhos de um contrato incluem reforços como se fossem notas à
 *   parte — ver am-sefaz-despesa-client.ts pra como isso aparece na SEFAZ.
 */

const BASE_URL = "https://sistemas.sefaz.am.gov.br/sgc-am/api/v1";
const TIMEOUT_MS = 20000;
const USER_AGENT = "Mozilla/5.0 (compatible; RadarLicitacoes/1.0)";
const PARALELO = 12;

// Contratos mudam pouco ao longo do dia; a varredura de todas as UGs é cara
// (~1.000 chamadas pros 8 anos) — fica em memória e é compartilhada entre
// todos os CNPJs consultados na mesma instância do servidor.
const VALIDADE_CACHE_MS = 6 * 60 * 60 * 1000;

// Contratos vigentes mais antigos encontrados na varredura de teste eram de 2019.
const ANOS_VARRIDOS = 8;

interface UgBruta {
  codUnidadeGestora?: string;
  nmSigla?: string;
  nmNome?: string;
}

interface ContratoBruto {
  nmTermo?: string;
  codUnidadeGestora?: string;
  nmUnidadeGestora?: string;
  nrNumeroContrato?: string;
  txAnoContrato?: string;
  nrNumeroAditamento?: string;
  tipoAditamento?: string;
  detalhamentoAditamento?: string;
  dtAssinaturaContrato?: string;
  desObjetivoContrato?: string;
  numProcessoCompra?: string;
  vlMensal?: number;
  vlTotal?: number;
  cpfCnpjContratado?: string;
  nomeContratado?: string;
  vigente?: string;
  dtInicioContrato?: string;
  dtVencimentoContrato?: string;
  numDiarioOficial?: string;
  dtPublicacao?: string;
  consorcio?: string;
}

interface EmpenhoBruto {
  codUnidadeGestora?: string;
  nrNotaEmpenho?: string;
  anoEmpenho?: string;
  vlEmpenho?: number;
  dtEmissao?: string;
}

const cache = new Map<string, { valor: unknown; expiraEm: number }>();
const emAndamento = new Map<string, Promise<unknown>>();

/** Resultado em cache por `chave`; chamadas simultâneas pra mesma chave esperam a mesma requisição. */
async function comCache<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
  const guardado = cache.get(chave);
  if (guardado && guardado.expiraEm > Date.now()) return guardado.valor as T;

  const pendente = emAndamento.get(chave);
  if (pendente) return pendente as Promise<T>;

  const promessa = buscar()
    .then((valor) => {
      cache.set(chave, { valor, expiraEm: Date.now() + VALIDADE_CACHE_MS });
      return valor;
    })
    .finally(() => emAndamento.delete(chave));
  emAndamento.set(chave, promessa);
  return promessa;
}

async function postar<T>(endpoint: string, campos: Record<string, string>): Promise<T[]> {
  const resposta = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ method: "ApiTransparencia", ...campos }),
  });
  if (resposta.status === 204) return [];
  if (!resposta.ok) throw new Error(`SGC-AM (${endpoint}) respondeu ${resposta.status}`);
  const corpo = (await resposta.json()) as unknown;
  if (!Array.isArray(corpo)) return [];
  // Erro de validação vem como 200 ou 500 com `[{"erro": "..."}]`.
  const erro = (corpo[0] as { erro?: string } | undefined)?.erro;
  if (erro) throw new Error(`SGC-AM (${endpoint}): ${erro}`);
  return corpo as T[];
}

/** "20260123" → "2026-01-23". */
function data(texto: string | undefined): string | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(texto?.trim() ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

function texto(valor: string | undefined): string | undefined {
  return valor?.trim() || undefined;
}

function soDigitos(valor: string | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

function anoAtualBrasilia(): number {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCFullYear();
}

export async function listarUgs(): Promise<{ codigo: string; sigla?: string; nome?: string }[]> {
  return comCache("ugs", async () => {
    const ugs = await postar<UgBruta>("unidadegestora.do", {
      nome: "",
      tipo: "UNIDADEGESTORA",
    });
    return ugs
      .filter((u): u is UgBruta & { codUnidadeGestora: string } => Boolean(u.codUnidadeGestora))
      .map((u) => ({
        codigo: u.codUnidadeGestora,
        sigla: texto(u.nmSigla),
        nome: texto(u.nmNome),
      }));
  });
}

function contratosDaUg(ug: string, ano: number, situacao: "Todos" | "Vigentes"): Promise<ContratoBruto[]> {
  return comCache(`contratos:${ug}:${ano}:${situacao}`, () =>
    postar<ContratoBruto>("contrato.do", {
      ug,
      ano: String(ano),
      termo: "",
      situacao,
      tipo: "CONTRATO",
    }),
  );
}

const chaveDoContrato = (l: ContratoBruto) => `${l.codUnidadeGestora}-${l.txAnoContrato}-${l.nrNumeroContrato}`;
const ehAditivo = (l: ContratoBruto) => Boolean(l.nrNumeroAditamento && l.nrNumeroAditamento !== "0");

/** Junta a linha do contrato com as dos aditivos (vêm como linhas separadas, com `nrNumeroAditamento`). */
function agrupar(linhas: ContratoBruto[], siglas: Map<string, string | undefined>): ContratoEstadual[] {
  const grupos = new Map<string, ContratoBruto[]>();
  for (const l of linhas) {
    const chave = chaveDoContrato(l);
    grupos.set(chave, [...(grupos.get(chave) ?? []), l]);
  }

  return [...grupos.entries()].map(([chave, grupo]) => {
    // Se a linha do contrato original não veio (ex.: a UG não respondeu), a primeira do grupo serve de base.
    const base = grupo.find((l) => !ehAditivo(l)) ?? grupo[0];
    const aditivos: AditivoEstadual[] = grupo
      .filter(ehAditivo)
      .map((l) => ({
        termo: texto(l.nmTermo) ?? `Aditivo ${l.nrNumeroAditamento}`,
        numero: l.nrNumeroAditamento ?? "",
        tipo: texto(l.tipoAditamento),
        detalhamento: texto(l.detalhamentoAditamento),
        dataAssinatura: data(l.dtAssinaturaContrato),
        valorTotal: l.vlTotal,
      }))
      .sort((a, b) => Number(a.numero) - Number(b.numero));
    const ug = base.codUnidadeGestora ?? "";

    return {
      chave,
      ug,
      ugNome: texto(base.nmUnidadeGestora),
      ugSigla: siglas.get(ug),
      numero: base.nrNumeroContrato ?? "",
      ano: base.txAnoContrato ?? "",
      // Sem a linha original, o nmTermo da base é o do aditivo ("3º TACT 10/2023") — não serve de nome do contrato.
      termo: (!ehAditivo(base) && texto(base.nmTermo)) || `Contrato ${base.nrNumeroContrato}/${base.txAnoContrato}`,
      objeto: texto(base.desObjetivoContrato),
      processoCompra: texto(base.numProcessoCompra),
      valorMensal: base.vlMensal || undefined,
      valorTotal: base.vlTotal,
      contratado: texto(base.nomeContratado) ?? "Não informado",
      cnpjContratado: soDigitos(base.cpfCnpjContratado),
      // Vigência do contrato inteiro: vale o último aditivo, se houver.
      vigente: grupo.some((l) => l.vigente === "S"),
      dataAssinatura: data(base.dtAssinaturaContrato),
      dataInicio: data(base.dtInicioContrato),
      dataFim: data(
        grupo
          .map((l) => l.dtVencimentoContrato ?? "")
          .sort()
          .at(-1),
      ),
      diarioOficial:
        texto(base.numDiarioOficial) || data(base.dtPublicacao)
          ? {
              numero: texto(base.numDiarioOficial),
              data: data(base.dtPublicacao),
            }
          : undefined,
      consorcio: base.consorcio === "S",
      aditivos,
    };
  });
}

/**
 * Contratos de um fornecedor com o Governo do Amazonas: varre todas as UGs
 * — o ano atual e o anterior inteiros (contrato encerrado ainda pode ter
 * resto a pagar) e os mais antigos só com contratos vigentes.
 */
export async function buscarContratosDoFornecedor(cnpj: string): Promise<ResultadoContratosAm> {
  const anoAtual = anoAtualBrasilia();
  const ugs = await listarUgs();
  const siglas = new Map(ugs.map((u) => [u.codigo, u.sigla]));

  const consultas = ugs.flatMap((ug) =>
    Array.from({ length: ANOS_VARRIDOS }, (_, i) => {
      const ano = anoAtual - i;
      return {
        ug: ug.codigo,
        ano,
        situacao: (i <= 1 ? "Todos" : "Vigentes") as "Todos" | "Vigentes",
      };
    }),
  );

  let completo = true;
  const linhas = await emParalelo(consultas, PARALELO, (c) =>
    contratosDaUg(c.ug, c.ano, c.situacao).catch(() => {
      completo = false;
      return [] as ContratoBruto[];
    }),
  );

  let doFornecedor = linhas.flat().filter((l) => soDigitos(l.cpfCnpjContratado) === cnpj);

  // Contrato antigo que só segue vigente por aditivo: o filtro "Vigentes" traz só as linhas dos aditivos,
  // cujo objeto descreve o aditivo ("O presente Termo Aditivo tem por objetivo prorrogar..."). A linha
  // original, com objeto, nome e assinatura do contrato, e os aditivos já encerrados vêm na consulta do
  // ano inteiro daquela UG — quando ela traz o original, substitui as linhas do contrato.
  const comOriginal = new Set(doFornecedor.filter((l) => !ehAditivo(l)).map(chaveDoContrato));
  const semOriginal = new Set(doFornecedor.filter((l) => !comOriginal.has(chaveDoContrato(l))).map(chaveDoContrato));
  const anosSemOriginal = [
    ...new Map(
      doFornecedor
        .filter((l) => semOriginal.has(chaveDoContrato(l)))
        .map((l) => [
          `${l.codUnidadeGestora}-${l.txAnoContrato}`,
          { ug: l.codUnidadeGestora ?? "", ano: Number(l.txAnoContrato) },
        ]),
    ).values(),
  ];
  const originais = await emParalelo(anosSemOriginal, PARALELO, (c) =>
    contratosDaUg(c.ug, c.ano, "Todos").catch(() => [] as ContratoBruto[]),
  );
  const anoInteiro = originais.flat().filter((l) => semOriginal.has(chaveDoContrato(l)));
  const recuperados = new Set(anoInteiro.filter((l) => !ehAditivo(l)).map(chaveDoContrato));
  doFornecedor = [
    ...doFornecedor.filter((l) => !recuperados.has(chaveDoContrato(l))),
    ...anoInteiro.filter((l) => recuperados.has(chaveDoContrato(l))),
  ];

  const contratos = agrupar(doFornecedor, siglas).sort(
    (a, b) => Number(b.vigente) - Number(a.vigente) || (b.dataAssinatura ?? "").localeCompare(a.dataAssinatura ?? ""),
  );

  return {
    contratos,
    anos: { inicio: anoAtual - ANOS_VARRIDOS + 1, fim: anoAtual },
    completo,
  };
}

export interface EmpenhoDoContrato {
  ug: string;
  /** Formato do portal da SEFAZ: "2026NE0001718". */
  numero: string;
  ano: string;
  valor: number;
  dataEmissao?: string;
}

export async function buscarEmpenhosDoContrato(contrato: ContratoEstadual): Promise<EmpenhoDoContrato[]> {
  const empenhos = await comCache(`empenhos:${contrato.chave}`, () =>
    postar<EmpenhoBruto>("empenho.do", {
      ug: contrato.ug,
      ano: contrato.ano,
      termo: contrato.numero,
      tipo: "EMPENHO",
    }),
  );
  return empenhos
    .filter((e): e is EmpenhoBruto & { nrNotaEmpenho: string; anoEmpenho: string } =>
      Boolean(e.nrNotaEmpenho && e.anoEmpenho),
    )
    .map((e) => ({
      ug: e.codUnidadeGestora || contrato.ug,
      numero: `${e.anoEmpenho}NE${e.nrNotaEmpenho.padStart(7, "0")}`,
      ano: e.anoEmpenho,
      valor: e.vlEmpenho ?? 0,
      dataEmissao: data(e.dtEmissao),
    }));
}
