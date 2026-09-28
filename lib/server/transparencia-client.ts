import { descreverFalha } from "@/lib/server/erros";
import type {
  ContratoFederal,
  DadosGovernoFederal,
  DadosPessoaFisica,
  PagamentosFederais,
  PessoaExposta,
  PunicaoCeaf,
  ResultadoSancoes,
  ResumoPessoaFisica,
  ResumoPessoaJuridica,
  Sancao,
  VinculoServidor,
} from "@/types/transparencia";

/**
 * Cliente da API de Dados do Portal da Transparência (CGU) — sanções (CEIS,
 * empresas inidôneas/suspensas; CNEP, empresas punidas pela Lei
 * Anticorrupção) e a relação da empresa com o governo federal (resumo,
 * contratos, pagamentos recebidos). Exige uma chave gratuita (cadastro em
 * portaldatransparencia.gov.br/api-de-dados), enviada no header
 * `chave-api-dados`.
 *
 * Pegadinhas descobertas testando com uma chave real:
 * 1. A API migrou de portaldatransparencia.gov.br para este domínio
 *    (api.portaldatransparencia.gov.br) — o domínio antigo só devolve um
 *    redirecionamento em texto plano.
 * 2. Requisições sem um User-Agent de navegador são bloqueadas pela
 *    proteção anti-bot (WAF) antes mesmo de chegar na API.
 * 3. Recusa chamadas vindas dos servidores da Vercel nos EUA — as rotas que
 *    usam este cliente rodam em São Paulo (ver vercel.json).
 * 4. As listas vêm em páginas de 15, sem ordem por data e sem informar o
 *    total: só dá pra saber que acabou quando uma página vem com menos de 15.
 */

const BASE_URL = "https://api.portaldatransparencia.gov.br/api-de-dados";
const TIMEOUT_MS = 10000;
const USER_AGENT = "Mozilla/5.0 (compatible; RadarLicitacoes/1.0)";
const TAMANHO_PAGINA = 15;

// A CGU atualiza os dados uma vez por dia e limita a 400 chamadas por minuto
// (no horário comercial) — contratos e pagamentos podem custar até 10
// chamadas por CNPJ, então ficam 6 h no cache do Next. As sanções não, pra
// uma sanção nova aparecer assim que a CGU publicar.
const CACHE_GOVERNO_FEDERAL_SEGUNDOS = 6 * 60 * 60;

// Até 150 contratos / 150 linhas de pagamento — fornecedores grandes (ex.:
// Dell) passam disso, e aí a tela avisa que a lista está incompleta.
const MAXIMO_PAGINAS = 10;
const PAGINAS_EM_PARALELO = 5;

async function requisitar<T>(
  caminho: string,
  chave: string,
  signal: AbortSignal | undefined,
  opcoes: { cacheSegundos?: number } = {},
): Promise<T | undefined> {
  const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinaisAbortar.push(signal);

  const resposta = await fetch(`${BASE_URL}/${caminho}`, {
    signal: AbortSignal.any(sinaisAbortar),
    headers: { Accept: "application/json", "chave-api-dados": chave, "User-Agent": USER_AGENT },
    ...(opcoes.cacheSegundos ? { next: { revalidate: opcoes.cacheSegundos } } : {}),
  });

  // 204/404 tratados como "nada consta" — o resultado esperado pra maioria das empresas.
  if (resposta.status === 204 || resposta.status === 404) return undefined;
  if (!resposta.ok) {
    throw new Error(`Portal da Transparência (${caminho.split("?")[0]}) respondeu ${resposta.status}`);
  }
  // CNPJ sem registro em `pessoa-juridica` volta 200 com corpo vazio.
  const texto = await resposta.text();
  return texto ? (JSON.parse(texto) as T) : undefined;
}

/** Busca páginas de 15 em lotes paralelos até uma vir incompleta (ou até o limite). */
async function buscarPaginas<T>(
  caminhoDaPagina: (pagina: number) => string,
  chave: string,
  signal: AbortSignal | undefined,
  cacheSegundos: number,
): Promise<{ itens: T[]; completo: boolean }> {
  const itens: T[] = [];
  for (let primeira = 1; primeira <= MAXIMO_PAGINAS; primeira += PAGINAS_EM_PARALELO) {
    const numeros = Array.from(
      { length: Math.min(PAGINAS_EM_PARALELO, MAXIMO_PAGINAS - primeira + 1) },
      (_, i) => primeira + i,
    );
    const paginas = await Promise.all(
      numeros.map((n) => requisitar<T[]>(caminhoDaPagina(n), chave, signal, { cacheSegundos })),
    );
    for (const pagina of paginas) {
      const lista = Array.isArray(pagina) ? pagina : [];
      itens.push(...lista);
      if (lista.length < TAMANHO_PAGINA) return { itens, completo: true };
    }
  }
  return { itens, completo: false };
}

/** A CGU usa "Sem informação"/"Sem Informação" e string vazia pra campo não preenchido. */
function valor(texto: string | null | undefined): string | undefined {
  const limpo = texto?.trim();
  if (!limpo || /^sem informa[cç][aã]o$/i.test(limpo)) return undefined;
  return limpo;
}

/** "350.000,00" → 350000. */
function paraNumero(texto: string | null | undefined): number | undefined {
  const limpo = valor(texto);
  if (!limpo) return undefined;
  const numero = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : undefined;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ---------------------------------------------------------------------------
// Sanções (CEIS/CNEP)
// ---------------------------------------------------------------------------

// Tipos que não barram licitar nem contratar (Lei Anticorrupção). O resto —
// impedimento, suspensão, inidoneidade, interdição — barra. Tipo novo ou
// desconhecido conta como impeditivo: na dúvida, é melhor a tela avisar.
const TIPOS_SEM_IMPEDIMENTO = ["multa", "publicacao extraordinaria"];

interface SancaoBruta {
  id: number;
  tipoSancao?: { descricaoResumida?: string };
  dataInicioSancao?: string;
  dataFimSancao?: string;
  dataPublicacaoSancao?: string;
  dataTransitadoJulgado?: string;
  fonteSancao?: { telefoneContato?: string; enderecoContato?: string };
  fundamentacao?: { codigo?: string; descricao?: string }[];
  orgaoSancionador?: { nome?: string; siglaUf?: string; poder?: string; esfera?: string };
  sancionado?: { nome?: string };
  valorMulta?: string;
  textoPublicacao?: string;
  linkPublicacao?: string;
  detalhamentoPublicacao?: string;
  numeroProcesso?: string;
  abrangenciaDefinidaDecisaoJudicial?: string;
  informacoesAdicionaisDoOrgaoSancionador?: string;
}

function mapearSancao(raw: SancaoBruta, tipo: "CEIS" | "CNEP"): Sancao {
  const tipoSancao = raw.tipoSancao?.descricaoResumida ?? "Tipo não informado";
  const orgao = raw.orgaoSancionador;
  const publicacao = {
    texto: valor(raw.textoPublicacao),
    detalhamento: valor(raw.detalhamentoPublicacao),
    link: valor(raw.linkPublicacao),
  };
  const multa = paraNumero(raw.valorMulta);

  return {
    id: raw.id,
    tipo,
    tipoSancao,
    impedeContratar: !TIPOS_SEM_IMPEDIMENTO.some((t) => semAcento(tipoSancao).startsWith(t)),
    abrangencia: valor(raw.abrangenciaDefinidaDecisaoJudicial),
    dataInicioSancao: valor(raw.dataInicioSancao),
    dataFimSancao: valor(raw.dataFimSancao),
    dataPublicacao: valor(raw.dataPublicacaoSancao),
    dataTransitoJulgado: valor(raw.dataTransitadoJulgado),
    orgaoSancionador: orgao?.nome
      ? {
          nome: orgao.nome,
          uf: valor(orgao.siglaUf),
          esfera: valor(orgao.esfera),
          poder: valor(orgao.poder),
          telefone: valor(raw.fonteSancao?.telefoneContato),
          endereco: valor(raw.fonteSancao?.enderecoContato),
        }
      : undefined,
    fundamentacao: [
      ...new Set(
        (raw.fundamentacao ?? [])
          .map((f) => valor(f.descricao) ?? valor(f.codigo))
          .filter((f): f is string => Boolean(f)),
      ),
    ],
    valorMulta: multa && multa > 0 ? multa : undefined,
    numeroProcesso: valor(raw.numeroProcesso),
    publicacao: publicacao.texto || publicacao.detalhamento || publicacao.link ? publicacao : undefined,
    informacoesAdicionais: valor(raw.informacoesAdicionaisDoOrgaoSancionador),
    nomeSancionado: raw.sancionado?.nome ?? "Não informado",
  };
}

/** `documento` é o CNPJ ou o CPF do sancionado — o CEIS e o CNEP aceitam os dois no mesmo parâmetro. */
async function buscarLista(
  caminho: "ceis" | "cnep",
  documento: string,
  chave: string,
  signal?: AbortSignal,
): Promise<Sancao[]> {
  const corpo = await requisitar<SancaoBruta[]>(`${caminho}?codigoSancionado=${documento}&pagina=1`, chave, signal);
  return Array.isArray(corpo) ? corpo.map((item) => mapearSancao(item, caminho.toUpperCase() as "CEIS" | "CNEP")) : [];
}

export async function buscarSancoes(documento: string, chave: string, signal?: AbortSignal): Promise<ResultadoSancoes> {
  const [ceis, cnep] = await Promise.all([
    buscarLista("ceis", documento, chave, signal),
    buscarLista("cnep", documento, chave, signal),
  ]);
  return { ceis, cnep };
}

// ---------------------------------------------------------------------------
// Relação com o governo federal (resumo, contratos, pagamentos)
// ---------------------------------------------------------------------------

type ResumoBruto = Partial<Record<Exclude<keyof ResumoPessoaJuridica, "semRegistro">, boolean>>;

async function buscarResumo(cnpj: string, chave: string, signal?: AbortSignal): Promise<ResumoPessoaJuridica> {
  const raw = await requisitar<ResumoBruto>(`pessoa-juridica?cnpj=${cnpj}`, chave, signal, {
    cacheSegundos: CACHE_GOVERNO_FEDERAL_SEGUNDOS,
  });
  return {
    semRegistro: !raw,
    possuiContratacao: raw?.possuiContratacao === true,
    participanteLicitacao: raw?.participanteLicitacao === true,
    favorecidoDespesas: raw?.favorecidoDespesas === true,
    emitiuNFe: raw?.emitiuNFe === true,
    convenios: raw?.convenios === true,
    favorecidoTransferencias: raw?.favorecidoTransferencias === true,
    sancionadoCEIS: raw?.sancionadoCEIS === true,
    sancionadoCNEP: raw?.sancionadoCNEP === true,
    sancionadoCEPIM: raw?.sancionadoCEPIM === true,
    beneficiadoRenunciaFiscal: raw?.beneficiadoRenunciaFiscal === true,
  };
}

interface ContratoBruto {
  id: number;
  numero?: string;
  objeto?: string;
  modalidadeCompra?: string;
  compra?: { numeroProcesso?: string };
  unidadeGestora?: {
    nome?: string;
    orgaoVinculado?: { sigla?: string; nome?: string };
    orgaoMaximo?: { sigla?: string; nome?: string };
  };
  dataAssinatura?: string;
  dataInicioVigencia?: string;
  dataFimVigencia?: string;
  valorInicialCompra?: number;
  valorFinalCompra?: number;
}

// Alguns contratos vêm com lixo no número do processo (ex.: "-3"); um
// processo de verdade tem bem mais dígitos ("25386001557202578").
function processoValido(texto: string | undefined): string | undefined {
  const limpo = valor(texto);
  return limpo && (limpo.match(/\d/g)?.length ?? 0) >= 5 ? limpo : undefined;
}

function mapearContrato(raw: ContratoBruto, hoje: string): ContratoFederal {
  const vinculado = raw.unidadeGestora?.orgaoVinculado;
  const fim = valor(raw.dataFimVigencia);
  return {
    id: raw.id,
    numero: valor(raw.numero) ?? "Sem número",
    // O texto vem com o rótulo junto: "Objeto: Aquisição de…".
    objeto: valor(raw.objeto?.replace(/^objeto:\s*/i, "")),
    modalidade: valor(raw.modalidadeCompra),
    processo: processoValido(raw.compra?.numeroProcesso),
    unidadeGestora: valor(raw.unidadeGestora?.nome),
    orgao: [valor(vinculado?.sigla), valor(vinculado?.nome)].filter(Boolean).join(" — ") || undefined,
    orgaoMaximo: valor(raw.unidadeGestora?.orgaoMaximo?.sigla),
    dataAssinatura: valor(raw.dataAssinatura),
    dataInicioVigencia: valor(raw.dataInicioVigencia),
    dataFimVigencia: fim,
    valorInicial: raw.valorInicialCompra,
    valorFinal: raw.valorFinalCompra,
    // Datas AAAA-MM-DD comparam direto como texto.
    vigente: Boolean(fim && fim >= hoje),
  };
}

/** Hoje em Brasília, AAAA-MM-DD. */
function hojeBrasilia(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function buscarContratos(
  documento: string,
  chave: string,
  signal?: AbortSignal,
  cacheSegundos = CACHE_GOVERNO_FEDERAL_SEGUNDOS,
): Promise<{ itens: ContratoFederal[]; completo: boolean }> {
  const { itens, completo } = await buscarPaginas<ContratoBruto>(
    (pagina) => `contratos/cpf-cnpj?cpfCnpj=${documento}&pagina=${pagina}`,
    chave,
    signal,
    cacheSegundos,
  );
  const hoje = hojeBrasilia();
  const contratos = itens
    .map((c) => mapearContrato(c, hoje))
    // A API não ordena: mais recentes primeiro.
    .sort((a, b) => (b.dataAssinatura ?? "").localeCompare(a.dataAssinatura ?? ""));
  return { itens: contratos, completo };
}

interface PagamentoBruto {
  nomeOrgao?: string;
  nomeOrgaoSuperior?: string;
  valor?: number;
}

/** Últimos 12 meses, incluindo o atual, em MM/AAAA. */
function periodoDozeMeses(): { inicio: string; fim: string } {
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const mesAno = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 11, 1));
  return { inicio: mesAno(inicio), fim: mesAno(agora) };
}

async function buscarPagamentos(cnpj: string, chave: string, signal?: AbortSignal): Promise<PagamentosFederais> {
  const { inicio, fim } = periodoDozeMeses();
  const { itens, completo } = await buscarPaginas<PagamentoBruto>(
    (pagina) =>
      `despesas/recursos-recebidos?mesAnoInicio=${inicio}&mesAnoFim=${fim}&codigoFavorecido=${cnpj}&pagina=${pagina}`,
    chave,
    signal,
    CACHE_GOVERNO_FEDERAL_SEGUNDOS,
  );

  // Vem uma linha por mês × unidade gestora — somamos por órgão.
  const porOrgao = new Map<string, { orgao: string; orgaoSuperior?: string; valor: number }>();
  for (const p of itens) {
    const orgao = valor(p.nomeOrgao) ?? "Órgão não informado";
    const atual = porOrgao.get(orgao) ?? { orgao, orgaoSuperior: valor(p.nomeOrgaoSuperior), valor: 0 };
    atual.valor += p.valor ?? 0;
    porOrgao.set(orgao, atual);
  }
  const lista = [...porOrgao.values()].sort((a, b) => b.valor - a.valor);

  return { inicio, fim, total: lista.reduce((soma, o) => soma + o.valor, 0), porOrgao: lista, completo };
}

/**
 * Resumo, contratos e pagamentos numa tacada. Contratos e pagamentos só são
 * consultados quando o resumo diz que existem (a maioria das empresas não
 * tem relação com o governo federal — economiza até 20 chamadas). Cada
 * parte falha sozinha: vem `null` e as outras continuam valendo.
 */
export async function buscarDadosGovernoFederal(
  cnpj: string,
  chave: string,
  signal?: AbortSignal,
): Promise<DadosGovernoFederal> {
  const registrarFalha = (parte: string) => (erro: unknown) => {
    console.error(`[governo-federal] ${parte}: ${descreverFalha(erro)}`);
    return null;
  };

  const resumo = await buscarResumo(cnpj, chave, signal).catch(registrarFalha("resumo"));

  // Sem o resumo, não dá pra saber se vale consultar — tenta as duas.
  const [contratos, pagamentos] = await Promise.all([
    resumo && !resumo.possuiContratacao
      ? { itens: [], completo: true }
      : buscarContratos(cnpj, chave, signal).catch(registrarFalha("contratos")),
    resumo && !resumo.favorecidoDespesas
      ? { ...periodoDozeMeses(), total: 0, porOrgao: [], completo: true }
      : buscarPagamentos(cnpj, chave, signal).catch(registrarFalha("pagamentos")),
  ]);

  return { resumo, contratos, pagamentos };
}

// ---------------------------------------------------------------------------
// Pessoa física (consulta de CPF)
// ---------------------------------------------------------------------------
//
// Nada daqui usa o cache do Next: ele guarda a resposta com a URL (que tem o
// CPF) como chave, fora da memória da função. Cada consulta de CPF vai direto
// na CGU e não fica gravada em lugar nenhum.

type PessoaFisicaBruta = { cpf?: string; nome?: string } & Record<string, unknown>;

function mapearResumoPessoaFisica(raw: PessoaFisicaBruta | undefined): ResumoPessoaFisica {
  const sim = (...campos: string[]) => campos.some((c) => raw?.[c] === true);
  return {
    semRegistro: !raw,
    servidor: sim("servidor"),
    servidorInativo: sim("servidorInativo"),
    pensionista: sim("pensionistaOuRepresentanteLegal"),
    instituidorPensao: sim("instituidorPensao"),
    contratado: sim("contratado"),
    participanteLicitacao: sim("participanteLicitacao"),
    // `favorecidoCPGF`/`CPDC`/`CPCC` = recebeu pagamento feito com cartão do governo — também é pagamento recebido.
    favorecidoDespesas: sim("favorecidoDespesas", "favorecidoCPGF", "favorecidoCPDC", "favorecidoCPCC"),
    beneficiarioDiarias: sim("beneficiarioDiarias"),
    permissionario: sim("permissionario"),
    portadorCartao: sim("portadorCPGF", "portadorCPDC"),
    sancionadoCEIS: sim("sancionadoCEIS"),
    sancionadoCNEP: sim("sancionadoCNEP"),
    sancionadoCEAF: sim("sancionadoCEAF"),
  };
}

interface CeafBruto {
  id: number;
  dataPublicacao?: string;
  tipoPunicao?: { descricao?: string };
  punicao?: { portaria?: string; processo?: string };
  orgaoLotacao?: { sigla?: string; nome?: string };
  ufLotacaoPessoa?: { uf?: { sigla?: string } };
  cargoEfetivo?: string;
  cargoComissao?: string;
  fundamentacao?: { codigo?: string; descricao?: string }[];
}

async function buscarCeaf(cpf: string, chave: string, signal?: AbortSignal): Promise<PunicaoCeaf[]> {
  const corpo = await requisitar<CeafBruto[]>(`ceaf?cpfSancionado=${cpf}&pagina=1`, chave, signal);
  return (Array.isArray(corpo) ? corpo : []).map((raw) => ({
    id: raw.id,
    tipo: valor(raw.tipoPunicao?.descricao) ?? "Punição não informada",
    dataPublicacao: valor(raw.dataPublicacao),
    orgao: [valor(raw.orgaoLotacao?.sigla), valor(raw.orgaoLotacao?.nome)].filter(Boolean).join(" — ") || undefined,
    uf: valor(raw.ufLotacaoPessoa?.uf?.sigla),
    cargoEfetivo: valor(raw.cargoEfetivo),
    cargoComissao: valor(raw.cargoComissao),
    portaria: valor(raw.punicao?.portaria),
    processo: valor(raw.punicao?.processo),
    fundamentacao: [
      ...new Set(
        (raw.fundamentacao ?? [])
          .map((f) => valor(f.descricao) ?? valor(f.codigo))
          .filter((f): f is string => Boolean(f)),
      ),
    ],
  }));
}

// Campos em snake_case, diferente do resto da API.
interface PepBruto {
  descricao_funcao?: string;
  sigla_funcao?: string;
  nivel_funcao?: string;
  nome_orgao?: string;
  dt_inicio_exercicio?: string;
  dt_fim_exercicio?: string;
  dt_fim_carencia?: string;
}

async function buscarPeps(cpf: string, chave: string, signal?: AbortSignal): Promise<PessoaExposta[]> {
  const corpo = await requisitar<PepBruto[]>(`peps?cpf=${cpf}&pagina=1`, chave, signal);
  return (Array.isArray(corpo) ? corpo : []).map((raw) => ({
    funcao: valor(raw.descricao_funcao) ?? valor(raw.sigla_funcao) ?? "Função não informada",
    nivel: valor(raw.nivel_funcao),
    orgao: valor(raw.nome_orgao),
    inicioExercicio: valor(raw.dt_inicio_exercicio),
    fimExercicio: valor(raw.dt_fim_exercicio),
    fimCarencia: valor(raw.dt_fim_carencia),
  }));
}

interface OrgaoServidorBruto {
  sigla?: string;
  nome?: string;
}

interface ServidorBruto {
  servidor?: {
    tipoServidor?: string;
    situacao?: string;
    orgaoServidorLotacao?: OrgaoServidorBruto;
    orgaoServidorExercicio?: OrgaoServidorBruto;
    estadoExercicio?: { sigla?: string };
    funcao?: { descricaoFuncaoCargo?: string };
  };
  fichasCargoEfetivo?: { cargo?: string }[];
  fichasMilitar?: { cargo?: string }[];
  fichasAposentadoria?: { cargo?: string }[];
}

function nomeOrgao(orgao: OrgaoServidorBruto | undefined): string | undefined {
  return [valor(orgao?.sigla), valor(orgao?.nome)].filter(Boolean).join(" — ") || undefined;
}

async function buscarVinculos(cpf: string, chave: string, signal?: AbortSignal): Promise<VinculoServidor[]> {
  const corpo = await requisitar<ServidorBruto[]>(`servidores?cpf=${cpf}&pagina=1`, chave, signal);
  return (Array.isArray(corpo) ? corpo : []).map((raw) => {
    const lotacao = nomeOrgao(raw.servidor?.orgaoServidorLotacao);
    const exercicio = nomeOrgao(raw.servidor?.orgaoServidorExercicio);
    return {
      tipo: valor(raw.servidor?.tipoServidor),
      situacao: valor(raw.servidor?.situacao),
      cargo: [raw.fichasCargoEfetivo, raw.fichasMilitar, raw.fichasAposentadoria]
        .flatMap((fichas) => fichas ?? [])
        .map((f) => valor(f.cargo))
        .find(Boolean),
      funcao: valor(raw.servidor?.funcao?.descricaoFuncaoCargo),
      orgaoLotacao: lotacao,
      orgaoExercicio: exercicio !== lotacao ? exercicio : undefined,
      uf: valor(raw.servidor?.estadoExercicio?.sigla),
    };
  });
}

/**
 * Nome e relação de um CPF com o governo federal. O resumo (`pessoa-fisica`)
 * é a base: se ele falha, a consulta toda falha. Sanções, CEAF e PEP são
 * consultados sempre (a lista de PEPs não tem indicador no resumo, e sanção
 * é o que mais importa numa contratação); vínculos de servidor e contratos,
 * só quando o resumo diz que existem.
 */
export async function buscarPessoaFisica(cpf: string, chave: string, signal?: AbortSignal): Promise<DadosPessoaFisica> {
  const registrarFalha = (parte: string) => (erro: unknown) => {
    console.error(`[cpf] ${parte}: ${descreverFalha(erro)}`);
    return null;
  };

  const [bruto, sancoes, ceaf, peps] = await Promise.all([
    requisitar<PessoaFisicaBruta>(`pessoa-fisica?cpf=${cpf}`, chave, signal),
    buscarSancoes(cpf, chave, signal).catch(registrarFalha("sancoes")),
    buscarCeaf(cpf, chave, signal).catch(registrarFalha("ceaf")),
    buscarPeps(cpf, chave, signal).catch(registrarFalha("peps")),
  ]);
  const resumo = mapearResumoPessoaFisica(bruto);

  const [vinculos, contratos] = await Promise.all([
    resumo.servidor || resumo.servidorInativo || resumo.pensionista || resumo.instituidorPensao
      ? buscarVinculos(cpf, chave, signal).catch(registrarFalha("servidores"))
      : [],
    resumo.contratado
      ? buscarContratos(cpf, chave, signal, 0).catch(registrarFalha("contratos"))
      : { itens: [], completo: true },
  ]);

  return {
    nome: typeof bruto?.nome === "string" ? valor(bruto.nome) : undefined,
    cpfMascarado: typeof bruto?.cpf === "string" ? valor(bruto.cpf) : undefined,
    resumo,
    sancoes,
    ceaf,
    peps,
    vinculos,
    contratos,
  };
}
