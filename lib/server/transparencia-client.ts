import { descreverFalha } from "@/lib/server/erros";
import { emParalelo } from "@/lib/server/paralelo";
import type {
  BeneficiosFiscais,
  ContratoFederal,
  ConvenioFederal,
  DadosGovernoFederal,
  DadosPessoaFisica,
  DocumentoEmenda,
  EmendaParlamentar,
  EmpenhoFederal,
  RecebedorEmenda,
  ResultadoConvenios,
  ResultadoDocumentosEmenda,
  ResultadoEmendas,
  ResultadoEmpenhosFederais,
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
  maximoPaginas = MAXIMO_PAGINAS,
): Promise<{ itens: T[]; completo: boolean }> {
  const itens: T[] = [];
  for (let primeira = 1; primeira <= maximoPaginas; primeira += PAGINAS_EM_PARALELO) {
    const numeros = Array.from(
      { length: Math.min(PAGINAS_EM_PARALELO, maximoPaginas - primeira + 1) },
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

/** "350.000,00" → 350000; "- 35.865,08" (negativo, com espaço) → -35865.08; "-" → undefined. */
function paraNumero(texto: string | null | undefined): number | undefined {
  const limpo = valor(texto)?.replace(/\s/g, "");
  if (!limpo || limpo === "-") return undefined;
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
  const [contratos, pagamentos, beneficiosFiscais] = await Promise.all([
    resumo && !resumo.possuiContratacao
      ? { itens: [], completo: true }
      : buscarContratos(cnpj, chave, signal).catch(registrarFalha("contratos")),
    resumo && !resumo.favorecidoDespesas
      ? { ...periodoDozeMeses(), total: 0, porOrgao: [], completo: true }
      : buscarPagamentos(cnpj, chave, signal).catch(registrarFalha("pagamentos")),
    buscarBeneficiosFiscais(cnpj, chave, signal, resumo?.beneficiadoRenunciaFiscal ?? true).catch(
      registrarFalha("beneficios-fiscais"),
    ),
  ]);

  return { resumo, beneficiosFiscais, contratos, pagamentos };
}

// ---------------------------------------------------------------------------
// Benefícios fiscais (renúncias da Receita Federal)
// ---------------------------------------------------------------------------

interface RegimeBruto {
  beneficioFiscal?: string;
  descricao?: string;
  fruicaoVigente?: string;
  dataInicioFruicao?: string;
  dataFimFruicao?: string;
  fundamentoLegal?: string;
}

interface ImunidadeBruta {
  beneficioFiscal?: string;
  tipoEntidade?: string;
}

interface RenunciaBruta {
  ano?: number;
  valorRenunciado?: number;
  tributo?: string;
  tipoRenuncia?: string;
}

// Fabricante da Zona Franca tem dezenas de linhas de renúncia por ano (Moto
// Honda: 161 linhas, 11 páginas, de 2015 a 2024).
const MAXIMO_PAGINAS_RENUNCIAS = 20;

/**
 * Regimes especiais e imunidades vêm sempre (2 chamadas): o indicador
 * `beneficiadoRenunciaFiscal` do resumo não os cobre — a PECEM ENERGIA é
 * habilitada no REIDI com o indicador `false`. Os valores renunciados, que
 * podem passar de 10 páginas, só quando o indicador diz que existem.
 */
async function buscarBeneficiosFiscais(
  cnpj: string,
  chave: string,
  signal: AbortSignal | undefined,
  temRenuncia: boolean,
): Promise<BeneficiosFiscais> {
  const opcoes = { cacheSegundos: CACHE_GOVERNO_FEDERAL_SEGUNDOS };
  const [regimes, imunidades, renuncias] = await Promise.all([
    requisitar<RegimeBruto[]>(`renuncias-fiscais-empresas-habilitadas-beneficios-fiscais?cnpj=${cnpj}&pagina=1`, chave, signal, opcoes),
    requisitar<ImunidadeBruta[]>(`renuncias-fiscais-empresas-imunes-isentas?cnpj=${cnpj}&pagina=1`, chave, signal, opcoes),
    temRenuncia
      ? buscarPaginas<RenunciaBruta>(
          (pagina) => `renuncias-valor?cnpj=${cnpj}&pagina=${pagina}`,
          chave,
          signal,
          CACHE_GOVERNO_FEDERAL_SEGUNDOS,
          MAXIMO_PAGINAS_RENUNCIAS,
        )
      : { itens: [], completo: true },
  ]);

  const porAno = new Map<number, Map<string, number>>();
  for (const r of renuncias.itens) {
    if (!r.ano || !r.valorRenunciado) continue;
    const tributos = porAno.get(r.ano) ?? new Map<string, number>();
    const tributo = valor(r.tributo) ?? valor(r.tipoRenuncia) ?? "Não informado";
    tributos.set(tributo, (tributos.get(tributo) ?? 0) + r.valorRenunciado);
    porAno.set(r.ano, tributos);
  }

  return {
    regimes: (Array.isArray(regimes) ? regimes : []).map((r) => ({
      beneficio: valor(r.beneficioFiscal) ?? "Benefício não informado",
      descricao: valor(r.descricao),
      vigente: /^sim$/i.test(r.fruicaoVigente ?? ""),
      inicio: valor(r.dataInicioFruicao),
      fim: valor(r.dataFimFruicao),
      fundamentoLegal: valor(r.fundamentoLegal),
    })),
    imunidades: (Array.isArray(imunidades) ? imunidades : []).map((i) => ({
      beneficio: valor(i.beneficioFiscal) ?? "Benefício não informado",
      tipoEntidade: valor(i.tipoEntidade),
    })),
    renunciasPorAno: [...porAno.entries()]
      .map(([ano, tributos]) => ({
        ano,
        total: [...tributos.values()].reduce((soma, v) => soma + v, 0),
        porTributo: [...tributos.entries()]
          .map(([tributo, v]) => ({ tributo, valor: v }))
          .sort((a, b) => b.valor - a.valor),
      }))
      .sort((a, b) => b.ano - a.ano),
    completo: renuncias.completo,
  };
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

// ---------------------------------------------------------------------------
// Emendas parlamentares
// ---------------------------------------------------------------------------
//
// Dados públicos, atualizados uma vez por dia pela CGU — mesmo cache de 6 h
// do governo federal.

interface EmendaBruta {
  codigoEmenda?: string;
  ano?: number;
  tipoEmenda?: string;
  autor?: string;
  nomeAutor?: string;
  numeroEmenda?: string;
  localidadeDoGasto?: string;
  funcao?: string;
  subfuncao?: string;
  valorEmpenhado?: string;
  valorLiquidado?: string;
  valorPago?: string;
  valorRestoInscrito?: string;
  valorRestoCancelado?: string;
  valorRestoPago?: string;
}

function mapearEmenda(raw: EmendaBruta): EmendaParlamentar {
  return {
    codigo: raw.codigoEmenda ?? "",
    ano: raw.ano ?? 0,
    tipo: valor(raw.tipoEmenda) ?? "Tipo não informado",
    autor: valor(raw.nomeAutor) ?? valor(raw.autor) ?? "Autor não informado",
    numero: valor(raw.numeroEmenda) ?? "",
    localidade: valor(raw.localidadeDoGasto),
    funcao: valor(raw.funcao),
    subfuncao: valor(raw.subfuncao),
    empenhado: paraNumero(raw.valorEmpenhado) ?? 0,
    liquidado: paraNumero(raw.valorLiquidado) ?? 0,
    pago: paraNumero(raw.valorPago) ?? 0,
    restoInscrito: paraNumero(raw.valorRestoInscrito) ?? 0,
    restoCancelado: paraNumero(raw.valorRestoCancelado) ?? 0,
    restoPago: paraNumero(raw.valorRestoPago) ?? 0,
  };
}

export interface FiltrosEmendas {
  codigo?: string;
  ano?: number;
  autor?: string;
  numero?: string;
  tipo?: string;
  pagina: number;
}

/**
 * `nomeAutor` casa com parte do nome ("HEINZE", "BANCADA DO AMAZONAS"), mas
 * só em maiúsculas e sem acento: "heinze" e "GUIMARÃES" voltam vazio.
 */
function normalizarAutor(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

export async function buscarEmendas(filtros: FiltrosEmendas, chave: string, signal?: AbortSignal): Promise<ResultadoEmendas> {
  const parametros = [
    filtros.codigo && `codigoEmenda=${filtros.codigo}`,
    filtros.ano && `ano=${filtros.ano}`,
    filtros.autor && `nomeAutor=${encodeURIComponent(normalizarAutor(filtros.autor))}`,
    filtros.numero && `numeroEmenda=${filtros.numero}`,
    filtros.tipo && `tipoEmenda=${encodeURIComponent(filtros.tipo)}`,
    `pagina=${filtros.pagina}`,
  ].filter(Boolean);

  const corpo = await requisitar<EmendaBruta[]>(`emendas?${parametros.join("&")}`, chave, signal, {
    cacheSegundos: CACHE_GOVERNO_FEDERAL_SEGUNDOS,
  });
  const lista = Array.isArray(corpo) ? corpo : [];
  return { itens: lista.map(mapearEmenda), pagina: filtros.pagina, temMais: lista.length === TAMANHO_PAGINA };
}

interface DocumentoEmendaBruto {
  data?: string;
  fase?: string;
  codigoDocumento?: string;
  codigoDocumentoResumido?: string;
  especieTipo?: string;
}

interface DocumentoDespesaBruto {
  valor?: string;
  nomeFavorecido?: string;
  codigoFavorecido?: string;
  ufFavorecido?: string;
  orgao?: string;
  ug?: string;
  observacao?: string;
}

// A lista de documentos da emenda não tem valor nem favorecido — vêm do
// detalhe de cada documento, uma chamada por documento. Limite pra uma emenda
// grande não gastar a cota da chave (400/min): pagamentos primeiro (é o que
// diz quem recebeu), depois empenhos. Liquidação não tem valor no detalhe da
// CGU ("-"), então não vale a chamada.
const MAXIMO_DETALHES_DOCUMENTOS = 40;
const DETALHES_EM_PARALELO = 5;

/** "31/07/2026" → "20260731", pra ordenar. */
function chaveData(data: string | undefined): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data ?? "");
  return m ? `${m[3]}${m[2]}${m[1]}` : "";
}

export async function buscarDocumentosEmenda(
  codigo: string,
  chave: string,
  signal?: AbortSignal,
): Promise<ResultadoDocumentosEmenda> {
  const { itens: brutos, completo } = await buscarPaginas<DocumentoEmendaBruto>(
    (pagina) => `emendas/documentos/${codigo}?pagina=${pagina}`,
    chave,
    signal,
    CACHE_GOVERNO_FEDERAL_SEGUNDOS,
  );

  const documentos: DocumentoEmenda[] = brutos
    .filter((d): d is DocumentoEmendaBruto & { codigoDocumento: string } => Boolean(valor(d.codigoDocumento)))
    .map((d) => ({
      codigo: d.codigoDocumento,
      codigoResumido: valor(d.codigoDocumentoResumido) ?? d.codigoDocumento,
      data: valor(d.data),
      fase: valor(d.fase) ?? "Fase não informada",
      especie: valor(d.especieTipo) === "Não se aplica" ? undefined : valor(d.especieTipo),
      detalhado: false,
    }))
    // A API não ordena: mais recentes primeiro.
    .sort((a, b) => chaveData(b.data).localeCompare(chaveData(a.data)));

  const paraDetalhar = [
    ...documentos.filter((d) => d.fase === "Pagamento"),
    ...documentos.filter((d) => d.fase === "Empenho"),
  ].slice(0, MAXIMO_DETALHES_DOCUMENTOS);

  await emParalelo(paraDetalhar, DETALHES_EM_PARALELO, async (d) => {
    const detalhe = await requisitar<DocumentoDespesaBruto>(`despesas/documentos/${d.codigo}`, chave, signal, {
      cacheSegundos: CACHE_GOVERNO_FEDERAL_SEGUNDOS,
    }).catch((erro: unknown) => {
      console.error(`[emendas/documentos] detalhe: ${descreverFalha(erro)}`);
      return undefined;
    });
    if (!detalhe) return;
    const nome = valor(detalhe.nomeFavorecido);
    Object.assign(d, {
      detalhado: true,
      valor: paraNumero(detalhe.valor),
      favorecido: nome
        ? { nome, documento: valor(detalhe.codigoFavorecido), uf: valor(detalhe.ufFavorecido) }
        : undefined,
      orgao: valor(detalhe.orgao) ?? valor(detalhe.ug),
      observacao: valor(detalhe.observacao),
    });
  });

  // Quem recebeu: pagamentos somados por favorecido. Um estorno vem negativo
  // e anula o pagamento que desfez — favorecido que fica com zero sai da lista.
  const porFavorecido = new Map<string, RecebedorEmenda>();
  for (const d of documentos) {
    if (d.fase !== "Pagamento" || d.valor === undefined || !d.favorecido) continue;
    const chaveFavorecido = d.favorecido.documento ?? d.favorecido.nome;
    const atual = porFavorecido.get(chaveFavorecido) ?? { ...d.favorecido, valor: 0 };
    atual.valor = Math.round((atual.valor + d.valor) * 100) / 100;
    porFavorecido.set(chaveFavorecido, atual);
  }
  const recebedores = [...porFavorecido.values()].filter((r) => Math.abs(r.valor) >= 0.01).sort((a, b) => b.valor - a.valor);

  return {
    itens: documentos,
    recebedores,
    completo,
    pagamentosDetalhados: completo && documentos.every((d) => d.fase !== "Pagamento" || d.detalhado),
  };
}

// ---------------------------------------------------------------------------
// Convênios
// ---------------------------------------------------------------------------

interface ConvenioBruto {
  id: number;
  dataInicioVigencia?: string | null;
  dataFinalVigencia?: string | null;
  dataUltimaLiberacao?: string | null;
  dimConvenio?: { codigo?: string; numero?: string; objeto?: string };
  situacao?: string;
  convenente?: { nome?: string; cnpjFormatado?: string; cpfFormatado?: string; tipo?: string };
  municipioConvenente?: { nomeIBGE?: string; uf?: { sigla?: string; nome?: string } };
  orgao?: { nome?: string; sigla?: string; orgaoMaximo?: { sigla?: string; nome?: string } };
  unidadeGestora?: { nome?: string };
  valor?: number;
  valorLiberado?: number;
  valorContrapartida?: number;
  valorDaUltimaLiberacao?: number;
}

/** A CGU troca os campos da UF no convênio: `sigla` vem "AMAZONAS" e `nome` vem "AM". */
function siglaUf(uf: { sigla?: string; nome?: string } | undefined): string | undefined {
  return [uf?.sigla, uf?.nome].map((t) => valor(t)).find((t) => t?.length === 2);
}

function mapearConvenio(raw: ConvenioBruto): ConvenioFederal {
  const maximo = raw.orgao?.orgaoMaximo;
  return {
    id: raw.id,
    codigo: valor(raw.dimConvenio?.codigo),
    numero: valor(raw.dimConvenio?.numero),
    objeto: valor(raw.dimConvenio?.objeto),
    situacao: valor(raw.situacao),
    convenente: {
      nome: valor(raw.convenente?.nome) ?? "Convenente não informado",
      documento: valor(raw.convenente?.cnpjFormatado) ?? valor(raw.convenente?.cpfFormatado),
      tipo: valor(raw.convenente?.tipo),
    },
    municipio: valor(raw.municipioConvenente?.nomeIBGE),
    uf: siglaUf(raw.municipioConvenente?.uf),
    concedente:
      [valor(maximo?.sigla), valor(maximo?.nome)].filter(Boolean).join(" — ") || valor(raw.orgao?.nome),
    unidadeGestora: valor(raw.unidadeGestora?.nome),
    valor: raw.valor ?? 0,
    valorLiberado: raw.valorLiberado ?? 0,
    valorContrapartida: raw.valorContrapartida ?? 0,
    inicioVigencia: valor(raw.dataInicioVigencia),
    fimVigencia: valor(raw.dataFinalVigencia),
    ultimaLiberacao: valor(raw.dataUltimaLiberacao),
    valorUltimaLiberacao: raw.valorDaUltimaLiberacao || undefined,
  };
}

export interface FiltrosConvenios {
  uf?: string;
  codigoIbge?: string;
  convenente?: string;
  /** Só os que ainda estão em vigência (terminam hoje ou depois). */
  somenteVigentes: boolean;
  pagina: number;
}

/** Hoje em Brasília, DD/MM/AAAA. */
function hojeBrasiliaBr(): string {
  const [a, m, d] = hojeBrasilia().split("-");
  return `${d}/${m}/${a}`;
}

/**
 * A CGU exige ao menos um filtro de peso — período de até 1 mês, convenente,
 * órgão ou localidade (UF ou município); sem isso, 400. `convenente` é o
 * nome COMPLETO e exato ("MUNICIPIO DE MANAUS" acha; "MANAUS" e "MUNICIPIO DE
 * MAN" não) — CNPJ volta vazio, com ou sem pontuação. Maiúsculas e acentos
 * não importam depois de normalizar.
 */
export async function buscarConvenios(
  filtros: FiltrosConvenios,
  chave: string,
  signal?: AbortSignal,
): Promise<ResultadoConvenios> {
  const parametros = [
    filtros.uf && `uf=${filtros.uf}`,
    filtros.codigoIbge && `codigoIBGE=${filtros.codigoIbge}`,
    filtros.convenente && `convenente=${encodeURIComponent(normalizarAutor(filtros.convenente))}`,
    // `dataVigencia*` filtra pelo FIM da vigência (as duas datas são obrigatórias): de hoje em diante = em vigência.
    filtros.somenteVigentes && `dataVigenciaInicial=${hojeBrasiliaBr()}&dataVigenciaFinal=31/12/2099`,
    `pagina=${filtros.pagina}`,
  ].filter(Boolean);

  const corpo = await requisitar<ConvenioBruto[]>(`convenios?${parametros.join("&")}`, chave, signal, {
    cacheSegundos: CACHE_GOVERNO_FEDERAL_SEGUNDOS,
  });
  const lista = Array.isArray(corpo) ? corpo : [];
  return { itens: lista.map(mapearConvenio), pagina: filtros.pagina, temMais: lista.length === TAMANHO_PAGINA };
}

// ---------------------------------------------------------------------------
// Empenhos a receber do governo federal
// ---------------------------------------------------------------------------
//
// Não há endpoint com o saldo de um empenho. O caminho (testado em
// 2026-09-29 com a Dell e com fornecedores das emendas):
// 1. `despesas/documentos-por-favorecido` (fase 1) lista os empenhos da
//    empresa por ano. O `valor` ali e o `valorAtual` dos itens
//    (`despesas/itens-de-empenho`) costumam bater com o valor atual, mas cada
//    um erra em casos diferentes (Dell, 2026-09-29): a lista não pega reforços
//    recentes (2026NE000072: 225.239,76 na lista, 807.743,76 de fato) nem
//    anulações (2026NE000214, anulado inteiro, segue 118.943,26); os itens
//    SOMAM a "ANULAÇÃO POR BAIXA DE SALDO" em vez de subtrair (2025NE000284:
//    inclusão e baixa de 73.917,60 cada, itens 147.835,20). Quando os dois
//    concordam, vale; quando não, o valor sai do histórico de cada item
//    (`itens-de-empenho/historico`): inclusão + reforços − anulações.
// 2. Empenho de ano anterior às vezes aparece também na lista de um ano
//    seguinte — é o resto a pagar, e o `valor` ali é o que sobrou depois de
//    cancelamentos: 2024NE004989 (341.873,00) aparece em 2025 com 177.493,99
//    e a nota "CANCELAMENTO DE RESTOS A PAGAR"; 2024NE000452, cancelado
//    inteiro, aparece com 0,00. Nesses casos o saldo é esse valor menos os
//    pagamentos feitos depois do ano de emissão (a inscrição em restos a
//    pagar é no começo do ano seguinte — 2023NE000560 foi inscrito em
//    13/01/2024 e aparece na lista de 2025). O histórico dos itens não mostra
//    o cancelamento de restos a pagar, então pra saldo vale essa linha.
// 3. `despesas/documentos-relacionados` de cada empenho traz os pagamentos,
//    de qualquer ano, com data e estorno negativo.
// 4. Um pagamento pode quitar mais de um empenho: aí a relação traz o valor
//    cheio do pagamento em cada empenho, e a divisão vem de
//    `despesas/empenhos-impactados` (2024OB000219, de 146.968,15, foi
//    134.582,33 pro 2023NE000559 e 12.385,82 pro 2023NE000560). A divisão é
//    buscada quando o pagamento aparece em mais de um empenho da lista ou
//    quando a soma dos pagamentos passa do empenho — o outro empenho pode
//    não estar na lista. Um pagamento dividido com empenho de fora que não
//    estoure o valor passa despercebido e reduz o saldo a receber.
// A CGU não informa o valor liquidado (vem 0,00), então não dá pra separar o
// que já foi atestado.

interface DocumentoFavorecidoBruto {
  data?: string;
  documento?: string;
  documentoResumido?: string;
  observacao?: string;
  orgao?: string;
  orgaoSuperior?: string;
  ug?: string;
  elemento?: string;
  numeroProcesso?: string;
  valor?: string;
  nomeFavorecido?: string;
}

interface RelacionadoBruto {
  data?: string;
  fase?: string;
  documento?: string;
  valor?: string;
}

interface ImpactadoBruto {
  empenho?: string;
  valorPago?: string;
  valorRestoPago?: string;
}

interface ItemEmpenhoBruto {
  valorAtual?: string;
  sequencial?: number;
}

interface HistoricoItemBruto {
  operacao?: string;
  valorTotal?: string;
}

type LinhaEmpenho = DocumentoFavorecidoBruto & { documento: string };

// Fornecedor grande tem centenas de empenhos por ano (a Dell teve 80 em 2025).
// Cada um custa uma chamada, e a cota da chave é de 400/min pro app inteiro.
const MAXIMO_EMPENHOS_ANALISADOS = 120;
const MAXIMO_PAGAMENTOS_CONFERIDOS = 100;
const EMPENHOS_EM_PARALELO = 5;
const ITENS_EM_PARALELO = 3;
// Empenho com mais itens que isso tem o histórico só dos primeiros (e fica marcado como incompleto).
const MAXIMO_ITENS_POR_EMPENHO = 30;
// Resíduo de centavos (ex.: empenho de 69.297,75 pago com 69.297,74) conta como quitado.
const RESIDUO_MAXIMO = 1;

function anoAtualBrasilia(): number {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCFullYear();
}

function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** "31/07/2026" → 2026. */
function anoDaData(data: string | undefined): number {
  return Number(/(\d{4})$/.exec(data ?? "")?.[1] ?? 0);
}

export async function buscarEmpenhosFederais(
  cnpj: string,
  chave: string,
  signal?: AbortSignal,
): Promise<ResultadoEmpenhosFederais> {
  const opcoes = { cacheSegundos: CACHE_GOVERNO_FEDERAL_SEGUNDOS };
  const anoAtual = anoAtualBrasilia();
  const anos = [anoAtual, anoAtual - 1];
  let completo = true;

  const listas = await Promise.all(
    anos.map((ano) =>
      buscarPaginas<DocumentoFavorecidoBruto>(
        (pagina) => `despesas/documentos-por-favorecido?codigoPessoa=${cnpj}&fase=1&ano=${ano}&pagina=${pagina}`,
        chave,
        signal,
        CACHE_GOVERNO_FEDERAL_SEGUNDOS,
      ),
    ),
  );
  if (listas.some((l) => !l.completo)) completo = false;

  // Onde cada empenho aparece: na lista do ano de emissão e/ou na de um ano seguinte (resto a pagar).
  const aparicoes = new Map<string, { linha: LinhaEmpenho; anoLista: number }[]>();
  listas.forEach((lista, i) => {
    for (const linha of lista.itens) {
      if (!linha.documento) continue;
      aparicoes.set(linha.documento, [...(aparicoes.get(linha.documento) ?? []), { linha: linha as LinhaEmpenho, anoLista: anos[i] }]);
    }
  });

  const candidatos = [...aparicoes.values()]
    .map((lista) => {
      const anoEmpenho = Number(lista[0].linha.documentoResumido?.slice(0, 4)) || Math.min(...lista.map((a) => a.anoLista));
      const propria = lista.find((a) => a.anoLista === anoEmpenho)?.linha;
      const restos = lista.filter((a) => a.anoLista > anoEmpenho).sort((a, b) => b.anoLista - a.anoLista)[0];
      return { anoEmpenho, propria, restos, principal: propria ?? restos.linha };
    })
    .sort((a, b) => chaveData(b.principal.data).localeCompare(chaveData(a.principal.data)));
  if (candidatos.length > MAXIMO_EMPENHOS_ANALISADOS) completo = false;
  const analisados = candidatos.slice(0, MAXIMO_EMPENHOS_ANALISADOS);

  const registrarFalha = (parte: string) => (erro: unknown) => {
    console.error(`[empenhos-federais] ${parte}: ${descreverFalha(erro)}`);
    return undefined;
  };

  /** Valor atual do empenho: lista e itens, se concordam; senão, o histórico dos itens (ver comentário do topo). */
  async function valorAtualDoEmpenho(codigo: string, valorNaLista: number | undefined): Promise<number> {
    const { itens } = await buscarPaginas<ItemEmpenhoBruto>(
      (pagina) => `despesas/itens-de-empenho?codigoDocumento=${codigo}&pagina=${pagina}`,
      chave,
      signal,
      CACHE_GOVERNO_FEDERAL_SEGUNDOS,
      Math.ceil(MAXIMO_ITENS_POR_EMPENHO / TAMANHO_PAGINA),
    );
    // Alguns empenhos vêm sem itens (2025NE002012 da Dell, pago em 45.065,12): aí só resta a lista.
    if (itens.length === 0) return valorNaLista ?? 0;
    const somaItens = itens.reduce((soma, i) => soma + (paraNumero(i.valorAtual) ?? 0), 0);
    if (valorNaLista !== undefined && Math.abs(somaItens - valorNaLista) < 0.02) return somaItens;

    const parciais = await emParalelo(
      itens.filter((i) => i.sequencial !== undefined),
      ITENS_EM_PARALELO,
      async (item) => {
        const historico = await requisitar<HistoricoItemBruto[]>(
          `despesas/itens-de-empenho/historico?codigoDocumento=${codigo}&sequencial=${item.sequencial}&pagina=1`,
          chave,
          signal,
          opcoes,
        );
        return (Array.isArray(historico) ? historico : []).reduce((soma, h) => {
          const operacao = semAcento(h.operacao ?? "");
          const v = paraNumero(h.valorTotal) ?? 0;
          if (operacao.startsWith("inclus") || operacao.startsWith("reforc")) return soma + v;
          if (operacao.startsWith("anulac") || operacao.includes("cancel")) return soma - v;
          return soma; // "INSCRICAO EM RP" e outras não mudam o valor.
        }, 0);
      },
    );
    return parciais.reduce((soma, v) => soma + v, 0);
  }

  const analises = await emParalelo(analisados, EMPENHOS_EM_PARALELO, async (c) => {
    const codigo = c.principal.documento;
    const [empenhado, relacionados] = await Promise.all([
      valorAtualDoEmpenho(codigo, c.propria ? paraNumero(c.propria.valor) ?? 0 : undefined).catch(registrarFalha("itens")),
      requisitar<RelacionadoBruto[]>(`despesas/documentos-relacionados?codigoDocumento=${codigo}&fase=1`, chave, signal, opcoes)
        .then((lista) => (Array.isArray(lista) ? lista : []))
        .catch(registrarFalha("relacionados")),
    ]);
    const pagamentos = (relacionados ?? []).filter(
      (r): r is RelacionadoBruto & { documento: string } => r.fase === "Pagamento" && Boolean(r.documento),
    );
    return { ...c, codigo, empenhado, pagamentos, falhou: empenhado === undefined || relacionados === undefined };
  });

  // Pagamento que aparece em mais de um empenho: busca a divisão real.
  const empenhosPorPagamento = new Map<string, Set<string>>();
  for (const a of analises) {
    for (const p of a.pagamentos) {
      empenhosPorPagamento.set(p.documento, (empenhosPorPagamento.get(p.documento) ?? new Set()).add(a.codigo));
    }
  }
  const compartilhados = new Set([...empenhosPorPagamento.entries()].filter(([, e]) => e.size > 1).map(([p]) => p));
  // Pagos a mais que o empenho: algum pagamento foi dividido com um empenho que não está na lista.
  for (const a of analises) {
    const bruto = a.pagamentos.reduce((soma, p) => soma + (paraNumero(p.valor) ?? 0), 0);
    if (a.empenhado !== undefined && bruto > a.empenhado + 0.01) for (const p of a.pagamentos) compartilhados.add(p.documento);
  }
  const aConferir = [...compartilhados].slice(0, MAXIMO_PAGAMENTOS_CONFERIDOS);
  const divisao = new Map<string, Map<string, number>>();
  await emParalelo(aConferir, EMPENHOS_EM_PARALELO, async (pagamento) => {
    const impactados = await requisitar<ImpactadoBruto[]>(
      `despesas/empenhos-impactados?codigoDocumento=${pagamento}&fase=3&pagina=1`,
      chave,
      signal,
      opcoes,
    ).catch(registrarFalha("impactados"));
    if (!Array.isArray(impactados)) return;
    divisao.set(
      pagamento,
      new Map(
        impactados
          .filter((i): i is ImpactadoBruto & { empenho: string } => Boolean(i.empenho))
          .map((i) => [i.empenho, (paraNumero(i.valorPago) ?? 0) + (paraNumero(i.valorRestoPago) ?? 0)]),
      ),
    );
  });

  const empenhos: EmpenhoFederal[] = analises.map((a) => {
    let completoEmpenho = !a.falhou;
    const valorDoPagamento = (p: RelacionadoBruto & { documento: string }) => {
      const parte = divisao.get(p.documento)?.get(a.codigo);
      if (parte !== undefined) return parte;
      // Compartilhado sem a divisão: o valor cheio pode estar contado a mais.
      if (compartilhados.has(p.documento)) completoEmpenho = false;
      return paraNumero(p.valor) ?? 0;
    };
    const empenhado = centavos(a.empenhado ?? 0);
    const pago = centavos(a.pagamentos.reduce((soma, p) => soma + valorDoPagamento(p), 0));

    let aReceber: number;
    if (a.restos) {
      // Resto a pagar: o saldo inscrito (já sem cancelamentos), menos o que foi pago depois do ano de emissão.
      const saldoInscrito = paraNumero(a.restos.linha.valor) ?? 0;
      const pagoDepois = a.pagamentos
        .filter((p) => anoDaData(p.data) > a.anoEmpenho)
        .reduce((soma, p) => soma + valorDoPagamento(p), 0);
      aReceber = Math.max(0, centavos(saldoInscrito - pagoDepois));
    } else {
      aReceber = Math.max(0, centavos(empenhado - pago));
    }
    if (aReceber <= RESIDUO_MAXIMO) aReceber = 0;
    if (!completoEmpenho) completo = false;
    const cancelado = Math.max(0, centavos(empenhado - pago - aReceber));

    const notaRestos = a.restos && a.propria ? valor(a.restos.linha.observacao) : undefined;
    return {
      codigo: a.codigo,
      codigoResumido: valor(a.principal.documentoResumido) ?? a.codigo,
      ano: a.anoEmpenho,
      data: valor(a.principal.data),
      orgao: valor(a.principal.orgao),
      orgaoSuperior: valor(a.principal.orgaoSuperior),
      ug: valor(a.principal.ug),
      descricao: valor(a.principal.observacao),
      notaRestos: notaRestos !== valor(a.principal.observacao) ? notaRestos : undefined,
      elemento: valor(a.principal.elemento),
      processo: processoValido(a.principal.numeroProcesso),
      empenhado,
      pago,
      aReceber,
      // O que não foi pago nem está a receber: cancelado (em geral, resto a pagar cancelado).
      cancelado: cancelado > RESIDUO_MAXIMO ? cancelado : 0,
      restoAPagar: a.anoEmpenho < anoAtual,
      completo: completoEmpenho,
    };
  });

  empenhos.sort((a, b) => b.aReceber - a.aReceber || chaveData(b.data).localeCompare(chaveData(a.data)));
  const soma = (campo: "empenhado" | "pago" | "aReceber" | "cancelado") =>
    centavos(empenhos.reduce((s, e) => s + e[campo], 0));

  return {
    favorecido: valor(analisados[0]?.principal.nomeFavorecido),
    anos,
    empenhos,
    totais: { empenhado: soma("empenhado"), pago: soma("pago"), aReceber: soma("aReceber"), cancelado: soma("cancelado") },
    totalEmpenhos: candidatos.length,
    completo,
  };
}
