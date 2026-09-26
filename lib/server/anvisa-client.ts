import { CATEGORIAS_NOME_TECNICO } from "@/lib/nome-tecnico";
import type { CategoriaNomeTecnico, FiltroClasseRisco } from "@/lib/nome-tecnico";
import { buscaAceitaFiltroValidos } from "@/lib/produtos-saude";
import type {
  CaracteristicasUdi,
  CertificadoBoasPraticas,
  DetalheCompletoProdutoSaude,
  DetalheProdutoSaude,
  ProdutoSaude,
  ResultadoProdutosSaude,
  TipoBuscaProdutoSaude,
  Udi,
} from "@/types/produto-saude";
import type { NomeTecnico, ResultadoNomesTecnicos } from "@/types/nome-tecnico";

/**
 * Cliente da API "Consultas Externas" da ANVISA — produtos para saúde
 * (dispositivos médicos, materiais hospitalares), UDI, certificados de boas
 * práticas e nomenclatura técnica. Exige OAuth2 client_credentials
 * (Keycloak, realm "externo"): registre um app em api.anvisa.gov.br para
 * obter CLIENT_ID/CLIENT_SECRET.
 *
 * O token (válido por ~29 min) fica guardado em memória e é reaproveitado
 * enquanto a instância do servidor estiver viva — economiza uma ida ao
 * Keycloak (~350 ms) por busca. Se a ANVISA recusar um token guardado (401),
 * geramos outro e tentamos de novo, uma vez.
 *
 * Neste gateway, 404 quer dizer "nenhum resultado" (busca vazia, página
 * além do fim, processo inexistente) — não é erro.
 *
 * Nem todo endpoint documentado no Swagger deste gateway funciona de
 * verdade:
 * - `/api/v1/certificadoMedicamento` (busca de Certificado de Boas Práticas
 *   de Fabricação de medicamentos) devolve 404 mesmo com o payload exato do
 *   exemplo da documentação, enquanto os endpoints de apoio dele (`/status`,
 *   `/classesCertificacao`) funcionam normalmente.
 * - `/api/v1/saude/downloadPDF/{processo}` responde 200 com um PDF, mas com
 *   todos os campos "sem dados cadastrados".
 * Nenhum dos dois é usado aqui.
 */

const TOKEN_URL = "https://acesso.prd.apps.anvisa.gov.br/auth/realms/externo/protocol/openid-connect/token";
const BASE_URL = "https://api-gateway.prd.apps.anvisa.gov.br/consultas-externas-api/api/v1";
const TIMEOUT_MS = 10000;
const USER_AGENT = "RadarLicitacoes/1.0";

// Folga pra não usar um token que expiraria no meio da requisição.
const MARGEM_EXPIRACAO_MS = 60_000;

export interface CredenciaisAnvisa {
  clientId: string;
  clientSecret: string;
}

/** Credenciais das variáveis de ambiente, ou `undefined` quando esta instância não tem a ANVISA configurada. */
export function lerCredenciaisAnvisa(): CredenciaisAnvisa | undefined {
  const clientId = process.env.ANVISA_CLIENT_ID;
  const clientSecret = process.env.ANVISA_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

/** Erro de uma consulta à ANVISA — carrega a mensagem que ela devolveu (quando houver). */
export class ErroConsultaAnvisa extends Error {
  constructor(
    message: string,
    public readonly mensagemAnvisa?: string,
  ) {
    super(message);
    this.name = "ErroConsultaAnvisa";
  }
}

interface RespostaPaginadaAnvisa<T> {
  content?: T[];
  totalElements?: number;
  totalPages?: number;
}

interface CorpoErroAnvisa {
  mensagem?: string;
  mensagem_detalhada?: string;
}

let tokenEmCache: { clientId: string; valor: string; expiraEm: number } | undefined;

async function obterToken(credenciais: CredenciaisAnvisa, signal?: AbortSignal, renovar = false): Promise<string> {
  if (!renovar && tokenEmCache?.clientId === credenciais.clientId && tokenEmCache.expiraEm > Date.now()) {
    return tokenEmCache.valor;
  }

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

  const dados = (await resposta.json()) as { access_token?: string; expires_in?: number };
  if (!dados.access_token) throw new Error("ANVISA não devolveu access_token");

  tokenEmCache = {
    clientId: credenciais.clientId,
    valor: dados.access_token,
    expiraEm: Date.now() + (dados.expires_in ?? 300) * 1000 - MARGEM_EXPIRACAO_MS,
  };
  return dados.access_token;
}

/**
 * Requisição autenticada num endpoint de consulta (POST quando há `corpo`,
 * GET quando não há). Devolve `undefined` no 404 — "nenhum resultado".
 */
async function requisitar<T>(
  caminho: string,
  credenciais: CredenciaisAnvisa,
  signal?: AbortSignal,
  corpo?: Record<string, unknown>,
): Promise<T | undefined> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const token = await obterToken(credenciais, signal, tentativa > 0);

    const sinaisAbortar = [AbortSignal.timeout(TIMEOUT_MS)];
    if (signal) sinaisAbortar.push(signal);

    const resposta = await fetch(`${BASE_URL}/${caminho}`, {
      method: corpo ? "POST" : "GET",
      signal: AbortSignal.any(sinaisAbortar),
      headers: {
        ...(corpo ? { "Content-Type": "application/json" } : {}),
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        Authorization: `Bearer ${token}`,
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });

    // Token guardado recusado antes da hora: a segunda volta do laço gera outro.
    if (resposta.status === 401 && tentativa === 0) continue;
    if (resposta.status === 404) return undefined;
    if (!resposta.ok) {
      const corpoErro = (await resposta.json().catch(() => undefined)) as CorpoErroAnvisa | undefined;
      const mensagemAnvisa = corpoErro?.mensagem_detalhada || corpoErro?.mensagem;
      throw new ErroConsultaAnvisa(`ANVISA (${caminho}) respondeu ${resposta.status}`, mensagemAnvisa);
    }
    return (await resposta.json()) as T;
  }
  throw new ErroConsultaAnvisa(`ANVISA (${caminho}) recusou o token`);
}

/** As datas deste gateway vêm como epoch em milissegundos. */
function paraIso(epochMs: number | null | undefined): string | undefined {
  return epochMs ? new Date(epochMs).toISOString() : undefined;
}

/** Campos "SIM"/"NAO" da UDI. */
function simNao(valor: string | null | undefined): boolean | undefined {
  if (valor === "SIM") return true;
  if (valor === "NAO") return false;
  return undefined;
}

// ---------------------------------------------------------------------------
// Busca de produtos para saúde
// ---------------------------------------------------------------------------

interface ProdutoSaudeBruto {
  processo?: string;
  empresa?: { cnpj?: string; razaoSocial?: string };
  produto?: string;
  registro?: string;
  situacao?: string;
  dataVencimento?: number | null;
  cancelado?: number;
  dataCancelamento?: number | null;
  siglaRiscoProduto?: string;
  vencimento?: { descricao?: string | null; vencido?: boolean };
}

function mapearProduto(raw: ProdutoSaudeBruto): ProdutoSaude | undefined {
  if (!raw.produto || !raw.registro) return undefined;

  // A ANVISA marca como VIGENTE registros cuja `dataVencimento` já passou
  // (39 de 100 válidos numa amostra) — a data não vale, e mostrá-la ao lado
  // de "Válido" confundiria.
  const vigente = raw.vencimento?.descricao === "VIGENTE";
  const dataPassada = Boolean(raw.dataVencimento && raw.dataVencimento < Date.now());

  return {
    processo: raw.processo,
    produto: raw.produto,
    registro: raw.registro,
    situacao: raw.situacao,
    cnpjEmpresa: raw.empresa?.cnpj,
    razaoSocialEmpresa: raw.empresa?.razaoSocial,
    dataVencimento: vigente && dataPassada ? undefined : paraIso(raw.dataVencimento),
    vigente,
    vencido: raw.vencimento?.vencido === true,
    cancelado: raw.cancelado === 1,
    dataCancelamento: paraIso(raw.dataCancelamento),
    siglaRiscoProduto: raw.siglaRiscoProduto,
  };
}

// Conferidos ao vivo. Cuidado ao acrescentar outros: `registro` (sem o
// "numero"), `nomeTecnico`, `razaoSocial` e a ordenação (`sorting`,
// `column`) são ignorados em silêncio — devolvem a base inteira (~192 mil
// registros) em vez de filtrar.
const CAMPO_DO_FILTRO: Record<TipoBuscaProdutoSaude, string> = {
  nome: "nomeProduto",
  registro: "numeroRegistro",
  processo: "numeroProcesso",
  cnpj: "cnpj",
};

export interface BuscaProdutosSaude {
  tipo: TipoBuscaProdutoSaude;
  valor: string;
  /** Restringe à empresa detentora, combinado com o termo acima. */
  cnpjEmpresa?: string;
  apenasValidos: boolean;
  pagina: number;
  tamanhoPagina: number;
}

export async function buscarProdutosSaude(
  busca: BuscaProdutosSaude,
  credenciais: CredenciaisAnvisa,
  signal?: AbortSignal,
): Promise<ResultadoProdutosSaude> {
  const filtro: Record<string, string> = { [CAMPO_DO_FILTRO[busca.tipo]]: busca.valor };
  // Os filtros se combinam (E): nome + CNPJ traz só os produtos daquela empresa.
  if (busca.cnpjEmpresa) filtro.cnpj = busca.cnpjEmpresa;
  if (busca.apenasValidos && buscaAceitaFiltroValidos(busca.tipo)) {
    filtro.situacaoNotificacaoRegistro = "1"; // "1" = válidos, "2" = inválidos
  }

  // O tamanho da página é `size` — `count`, que aparece no exemplo da
  // documentação, é ignorado e a API devolve sempre 10.
  const corpo = await requisitar<RespostaPaginadaAnvisa<ProdutoSaudeBruto>>("saude", credenciais, signal, {
    size: busca.tamanhoPagina,
    page: String(busca.pagina),
    filter: filtro,
  });

  const itens = (corpo?.content ?? [])
    .map(mapearProduto)
    .filter((item): item is ProdutoSaude => item !== undefined);
  return {
    itens,
    total: corpo?.totalElements ?? itens.length,
    pagina: busca.pagina,
    totalPaginas: corpo?.totalPages ?? (itens.length > 0 ? 1 : 0),
    tipoBusca: busca.tipo,
    cnpjEmpresa: busca.cnpjEmpresa,
  };
}

// ---------------------------------------------------------------------------
// Detalhe do registro (+ UDI e certificados)
// ---------------------------------------------------------------------------

// As apresentações (com os modelos) vêm paginadas dentro do detalhe; 100 cobre quase todos os registros.
const MAXIMO_MODELOS = 100;
const MAXIMO_UDIS = 50;
const MAXIMO_CERTIFICADOS = 20;

interface DetalheProdutoSaudeBruto {
  registro?: string;
  empresa?: { cnpj?: string; autorizacao?: string };
  nomeTecnico?: string;
  risco?: { sigla?: string; descricao?: string };
  dataInicioVigencia?: number | null;
  fabricantes?: { atividade?: string; razaoSocial?: string; pais?: string; endereco?: string }[];
  apresentacoesPage?: RespostaPaginadaAnvisa<{ modelos?: string[]; componente?: string; apresentacao?: string }>;
  arquivos?: { descricaoTipoAnexo?: string; nomeArquivo?: string; dtEnvio?: number | null }[];
  processoMedidaCautelar?: string | null;
  mensagem?: { situacao?: string | null; resolucao?: string | null; motivo?: string | null };
}

function mapearDetalhe(raw: DetalheProdutoSaudeBruto, processo: string): DetalheProdutoSaude {
  const apresentacoes = raw.apresentacoesPage?.content ?? [];
  const modelos = apresentacoes.flatMap((a) =>
    a.modelos?.length ? a.modelos : [a.apresentacao || a.componente].filter((m): m is string => Boolean(m)),
  );
  const { situacao, resolucao, motivo } = raw.mensagem ?? {};

  return {
    processo,
    nomeTecnico: raw.nomeTecnico || undefined,
    autorizacaoEmpresa: raw.empresa?.autorizacao || undefined,
    risco: raw.risco?.sigla ? { sigla: raw.risco.sigla, descricao: raw.risco.descricao || undefined } : undefined,
    dataInicioVigencia: paraIso(raw.dataInicioVigencia),
    fabricantes: (raw.fabricantes ?? [])
      .filter((f): f is typeof f & { razaoSocial: string } => Boolean(f.razaoSocial))
      .map((f) => ({
        razaoSocial: f.razaoSocial,
        atividade: f.atividade || undefined,
        pais: f.pais || undefined,
        endereco: f.endereco?.trim() || undefined,
      })),
    modelos,
    // O total da página conta apresentações, não modelos — uma apresentação pode ter dezenas de modelos.
    modelosIncompletos: apresentacoes.length < (raw.apresentacoesPage?.totalElements ?? 0),
    documentos: (raw.arquivos ?? [])
      .filter((a): a is typeof a & { descricaoTipoAnexo: string } => Boolean(a.descricaoTipoAnexo))
      .map((a) => ({ tipo: a.descricaoTipoAnexo, nomeArquivo: a.nomeArquivo, dataEnvio: paraIso(a.dtEnvio) })),
    processoMedidaCautelar: raw.processoMedidaCautelar || undefined,
    resolucao:
      situacao || resolucao || motivo
        ? { situacao: situacao || undefined, resolucao: resolucao || undefined, motivo: motivo || undefined }
        : undefined,
  };
}

interface UdiBruto {
  id?: number;
  udiDi?: string;
  nomeComercial?: string;
}

async function buscarUdisDoRegistro(
  numeroRegistro: string,
  credenciais: CredenciaisAnvisa,
  signal?: AbortSignal,
): Promise<{ itens: Udi[]; total: number }> {
  const corpo = await requisitar<RespostaPaginadaAnvisa<UdiBruto>>("udi", credenciais, signal, {
    size: MAXIMO_UDIS,
    page: "1",
    filter: { nuRegistro: numeroRegistro },
  });
  const itens = (corpo?.content ?? [])
    .filter((u): u is UdiBruto & { id: number; udiDi: string } => u.id !== undefined && Boolean(u.udiDi))
    .map((u) => ({ id: u.id, gtin: u.udiDi, nomeComercial: u.nomeComercial || undefined }));
  return { itens, total: corpo?.totalElements ?? itens.length };
}

interface CertificadoBruto {
  idCertificado?: number;
  tipoCertificado?: string;
  assunto?: string;
  status?: string;
  datavalidade?: number | null;
  certificacaoConcedidaPor?: string;
}

async function buscarCertificadosDaEmpresa(
  cnpj: string,
  credenciais: CredenciaisAnvisa,
  signal?: AbortSignal,
): Promise<CertificadoBoasPraticas[]> {
  // `contexto: "certificado"` é o genérico (produtos para saúde, entre
  // outros); o de medicamentos (`certificadoMedicamento`) não funciona — ver
  // o comentário do topo.
  const corpo = await requisitar<RespostaPaginadaAnvisa<CertificadoBruto>>("certificado/", credenciais, signal, {
    size: MAXIMO_CERTIFICADOS,
    page: "1",
    filter: { cnpjCertificada: cnpj, contexto: "certificado" },
  });
  return (corpo?.content ?? [])
    .filter((c): c is CertificadoBruto & { idCertificado: number; tipoCertificado: string } =>
      Boolean(c.idCertificado && c.tipoCertificado),
    )
    .map((c) => ({
      id: c.idCertificado,
      tipo: c.tipoCertificado,
      // Tira o código do assunto do começo ("70428 - PRODUTOS PARA SAÚDE - …").
      assunto: c.assunto?.replace(/^\d+\s*-\s*/, "") || undefined,
      status: c.status || undefined,
      dataValidade: paraIso(c.datavalidade),
      concedidoPor: c.certificacaoConcedidaPor || undefined,
    }));
}

/**
 * Detalhe do registro, mais os códigos UDI do registro e os certificados de
 * boas práticas da detentora. UDI e certificados só complementam: se uma
 * dessas consultas falhar, vem `null` no lugar e o detalhe continua valendo.
 * Devolve `undefined` quando o processo não existe.
 */
export async function buscarDetalheProdutoSaude(
  processo: string,
  credenciais: CredenciaisAnvisa,
  signal?: AbortSignal,
): Promise<DetalheCompletoProdutoSaude | undefined> {
  const bruto = await requisitar<DetalheProdutoSaudeBruto>(`saude/${processo}`, credenciais, signal, {
    size: MAXIMO_MODELOS,
    page: "1",
  });
  if (!bruto) return undefined;

  const [udis, certificados] = await Promise.all([
    bruto.registro
      ? buscarUdisDoRegistro(bruto.registro, credenciais, signal).catch(() => null)
      : Promise.resolve({ itens: [], total: 0 }),
    bruto.empresa?.cnpj
      ? buscarCertificadosDaEmpresa(bruto.empresa.cnpj, credenciais, signal).catch(() => null)
      : Promise.resolve([]),
  ]);

  return {
    detalhe: mapearDetalhe(bruto, processo),
    udis: udis?.itens ?? null,
    totalUdis: udis?.total ?? 0,
    certificados,
  };
}

interface DispositivoUdiBruto {
  versaoModelo?: string;
  categoria?: string;
  qtdPorEmbalagem?: number;
  isDispositivoEsteril?: string;
  isUsoUnico?: string;
  isPossuiLatex?: string;
  isUsoLeigo?: string;
  compatibilidadeComRM?: string;
  dtDescontinuacao?: number | null;
}

/** Características declaradas no cadastro UDI de um modelo. `undefined` quando o id não existe. */
export async function buscarCaracteristicasUdi(
  id: number,
  credenciais: CredenciaisAnvisa,
  signal?: AbortSignal,
): Promise<CaracteristicasUdi | undefined> {
  const corpo = await requisitar<{ dispositivo?: DispositivoUdiBruto }>(`udi/${id}`, credenciais, signal);
  const d = corpo?.dispositivo;
  if (!d) return undefined;
  return {
    versaoModelo: d.versaoModelo || undefined,
    categoria: d.categoria || undefined,
    unidadesPorEmbalagem: d.qtdPorEmbalagem ?? undefined,
    esteril: simNao(d.isDispositivoEsteril),
    usoUnico: simNao(d.isUsoUnico),
    contemLatex: simNao(d.isPossuiLatex),
    usoLeigo: simNao(d.isUsoLeigo),
    compatibilidadeRessonancia: d.compatibilidadeComRM || undefined,
    dataDescontinuacao: paraIso(d.dtDescontinuacao),
  };
}

// ---------------------------------------------------------------------------
// Nomenclatura técnica
// ---------------------------------------------------------------------------
//
// A base inteira é pequena (~2,7 mil nomes, ~860 KB) e a busca da própria
// ANVISA procura a frase exata — "balão cateter" não acha "cateter balão".
// Por isso carregamos a base toda (10 páginas em paralelo, ~0,7 s) e
// buscamos aqui: palavras em qualquer ordem, sem acento, também na
// definição e no código, com filtro por classe de risco (que a API não
// tem). Fica em memória por 24 h, por instância do servidor; se a recarga
// falhar, seguimos com a cópia antiga.

const VALIDADE_BASE_NOMES_TECNICOS_MS = 24 * 60 * 60 * 1000;

// A API corta a página em 300 sem avisar — pedir 3000 devolve 300.
const TAMANHO_PAGINA_BASE = 300;

// Conectivos curtos que casariam com quase tudo na busca por trecho.
const PALAVRAS_VAZIAS = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "para", "por"]);

interface NomeTecnicoBruto {
  codigo?: string;
  nomeTecnico?: string;
  descricao?: string | null;
  descricaoTipoProduto?: string;
  classeRisco?: string | null;
}

function mapearNomeTecnico(raw: NomeTecnicoBruto): NomeTecnico | undefined {
  // 86 nomes vêm com espaço sobrando no fim.
  const nome = raw.nomeTecnico?.trim();
  if (!raw.codigo || !nome) return undefined;
  return {
    codigo: raw.codigo,
    nomeTecnico: nome,
    descricao: raw.descricao?.trim() || undefined,
    descricaoTipoProduto: raw.descricaoTipoProduto || undefined,
    classeRisco: raw.classeRisco || undefined,
  };
}

// Plural → singular, na ordem (a primeira terminação que casar vale). Não
// precisa ser gramática perfeita: o mesmo tratamento vale pro texto digitado
// e pra base, então basta os dois lados caírem na mesma forma —
// "descartáveis" e "descartável", "balões" e "balão", "cateteres" e
// "cateter", "portáteis" e "portátil", "estéreis" e "estéril".
const PLURAIS: [string, string][] = [
  ["teis", "til"],
  ["ereis", "eril"],
  ["ceis", "cil"],
  ["veis", "vel"],
  ["eis", "el"],
  ["oes", "ao"],
  ["aes", "ao"],
  ["ais", "al"],
  ["res", "r"],
  ["zes", "z"],
  ["ns", "m"],
  ["s", ""],
];

function singularizar(palavra: string): string {
  // Palavras curtas ("gas", "luz") ficam como estão — o risco de estragar é maior que o ganho.
  if (palavra.length <= 4) return palavra;
  const regra = PLURAIS.find(([plural]) => palavra.endsWith(plural));
  return regra ? palavra.slice(0, -regra[0].length) + regra[1] : palavra;
}

/**
 * Minúsculas, sem acento, só letras/números e cada palavra no singular —
 * pra comparar o texto digitado com a base.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map(singularizar)
    .join(" ");
}

interface EntradaNomeTecnico {
  item: NomeTecnico;
  /** Nome normalizado — pra ranquear primeiro quem tem todas as palavras no nome. */
  nome: string;
  /** Nome, definição e código normalizados, juntos — onde a busca procura. */
  texto: string;
}

let baseNomesTecnicos: { entradas: EntradaNomeTecnico[]; carregadaEm: number } | undefined;
let cargaEmAndamento: Promise<EntradaNomeTecnico[]> | undefined;

async function carregarBaseNomesTecnicos(credenciais: CredenciaisAnvisa): Promise<EntradaNomeTecnico[]> {
  // Sem o `signal` da requisição: a carga é compartilhada entre buscas
  // simultâneas, e o cancelamento de uma não pode derrubar as outras.
  const pedirPagina = (pagina: number) =>
    requisitar<RespostaPaginadaAnvisa<NomeTecnicoBruto>>("nomeTecnico", credenciais, undefined, {
      size: TAMANHO_PAGINA_BASE,
      page: String(pagina),
      filter: {},
    });

  const primeira = await pedirPagina(1);
  if (!primeira) throw new ErroConsultaAnvisa("ANVISA (nomeTecnico) não devolveu a base de nomes técnicos");

  const totalPaginas = primeira.totalPages ?? 1;
  const demais = await Promise.all(Array.from({ length: totalPaginas - 1 }, (_, i) => pedirPagina(i + 2)));
  const brutos = [primeira, ...demais].flatMap((pagina) => pagina?.content ?? []);

  // Uma página faltando deixaria nomes de fora sem ninguém perceber — melhor falhar e tentar de novo.
  if (primeira.totalElements !== undefined && brutos.length < primeira.totalElements) {
    throw new ErroConsultaAnvisa(
      `ANVISA (nomeTecnico) devolveu ${brutos.length} de ${primeira.totalElements} nomes técnicos`,
    );
  }

  return brutos
    .map(mapearNomeTecnico)
    .filter((item): item is NomeTecnico => item !== undefined)
    .sort((a, b) => a.nomeTecnico.localeCompare(b.nomeTecnico, "pt-BR"))
    .map((item) => ({
      item,
      nome: normalizar(item.nomeTecnico),
      texto: normalizar([item.nomeTecnico, item.descricao, item.codigo].filter(Boolean).join(" ")),
    }));
}

async function obterBaseNomesTecnicos(credenciais: CredenciaisAnvisa): Promise<EntradaNomeTecnico[]> {
  if (baseNomesTecnicos && Date.now() - baseNomesTecnicos.carregadaEm < VALIDADE_BASE_NOMES_TECNICOS_MS) {
    return baseNomesTecnicos.entradas;
  }

  cargaEmAndamento ??= carregarBaseNomesTecnicos(credenciais)
    .then((entradas) => {
      baseNomesTecnicos = { entradas, carregadaEm: Date.now() };
      return entradas;
    })
    .finally(() => {
      cargaEmAndamento = undefined;
    });

  try {
    return await cargaEmAndamento;
  } catch (erro) {
    // Base vencida é melhor que nenhuma: a nomenclatura muda pouco de um dia pro outro.
    if (baseNomesTecnicos) return baseNomesTecnicos.entradas;
    throw erro;
  }
}

/**
 * Só números (com ou sem pontuação) é busca por código, e vale prefixo:
 * "9000" traz a família inteira. O resto é busca por palavras, em qualquer
 * ordem — primeiro quem tem todas elas no nome, depois quem só casou pela
 * definição. A base já vem em ordem alfabética, e a ordenação é estável.
 *
 * A nomenclatura é genérica ("Luvas Descartaveis"), e quem cola a descrição
 * de um item de edital ("seringa descartável") muitas vezes não acha nenhum
 * nome com todas as palavras. Nesse caso a busca vira parcial: entra quem
 * tem ao menos uma, ranqueado pelas que tem — a primeira palavra digitada,
 * normalmente o substantivo principal, vale mais.
 */
function filtrarPorTermo(
  entradas: EntradaNomeTecnico[],
  termo: string,
): { encontradas: EntradaNomeTecnico[]; parcial: boolean } {
  const semPontuacao = termo.replace(/[\s./-]/g, "");
  if (/^\d+$/.test(semPontuacao)) {
    const encontradas = entradas
      .filter((e) => e.item.codigo.startsWith(semPontuacao))
      .sort((a, b) => a.item.codigo.localeCompare(b.item.codigo));
    return { encontradas, parcial: false };
  }

  const palavras = normalizar(termo).split(" ").filter(Boolean);
  const significativas = palavras.filter((p) => !PALAVRAS_VAZIAS.has(p));
  const procuradas = significativas.length > 0 ? significativas : palavras;
  if (procuradas.length === 0) return { encontradas: entradas, parcial: false };

  const pontuarCompleta = (e: EntradaNomeTecnico) => {
    if (!procuradas.every((p) => e.nome.includes(p))) return 2;
    return e.nome.startsWith(procuradas[0]) ? 0 : 1;
  };
  const completas = entradas
    .filter((e) => procuradas.every((p) => e.texto.includes(p)))
    .map((e) => ({ e, pontos: pontuarCompleta(e) }))
    .sort((a, b) => a.pontos - b.pontos)
    .map(({ e }) => e);
  if (completas.length > 0 || procuradas.length === 1) return { encontradas: completas, parcial: false };

  const pontuarParcial = (e: EntradaNomeTecnico) =>
    procuradas.reduce(
      (soma, p, indice) => {
        if (e.nome.includes(p)) return soma + (indice === 0 ? 3 : 2);
        return soma + (e.texto.includes(p) ? 1 : 0);
      },
      // "Seringa Carpule" antes de "Agulha para seringa" quando a busca começa por "seringa".
      e.nome.startsWith(procuradas[0]) ? 1 : 0,
    );
  const parciais = entradas
    .map((e) => ({ e, pontos: pontuarParcial(e) }))
    .filter(({ pontos }) => pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map(({ e }) => e);
  return { encontradas: parciais, parcial: parciais.length > 0 };
}

export interface BuscaNomesTecnicos {
  /** Pode vir vazio quando há filtro — lista tudo da categoria/classe. */
  termo: string;
  categoria?: CategoriaNomeTecnico;
  classeRisco?: FiltroClasseRisco;
  pagina: number;
  tamanhoPagina: number;
}

export async function buscarNomesTecnicos(
  busca: BuscaNomesTecnicos,
  credenciais: CredenciaisAnvisa,
): Promise<ResultadoNomesTecnicos> {
  const entradas = await obterBaseNomesTecnicos(credenciais);

  const rotuloCategoria = CATEGORIAS_NOME_TECNICO.find((c) => c.valor === busca.categoria)?.rotulo;
  const filtradas = entradas.filter(
    ({ item }) =>
      (!rotuloCategoria || item.descricaoTipoProduto === rotuloCategoria) &&
      (!busca.classeRisco ||
        (busca.classeRisco === "nenhuma" ? !item.classeRisco : item.classeRisco === busca.classeRisco)),
  );
  const { encontradas, parcial } = filtrarPorTermo(filtradas, busca.termo);

  const inicio = (busca.pagina - 1) * busca.tamanhoPagina;
  return {
    itens: encontradas.slice(inicio, inicio + busca.tamanhoPagina).map((e) => e.item),
    total: encontradas.length,
    pagina: busca.pagina,
    totalPaginas: Math.ceil(encontradas.length / busca.tamanhoPagina),
    correspondenciaParcial: parcial,
  };
}
