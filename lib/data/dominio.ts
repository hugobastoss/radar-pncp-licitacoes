/**
 * Vocabulário de domínio do Radar Licitações.
 *
 * Estas listas cobrem os valores mais comuns hoje. A API do PNCP pode
 * devolver modalidades ou portais fora desta lista — nesse caso a interface
 * deve exibir o valor recebido normalmente (ver lib/portal.ts para o
 * tratamento de portais desconhecidos) em vez de escondê-lo.
 */
import type { Licitacao, OrdenacaoOpcao } from "@/types/licitacao";

export interface OpcaoModalidade {
  codigo: string;
  nome: string;
  /** codigoModalidadeContratacao da API de consulta do PNCP — ver lib/server/pncp-client.ts. */
  codigoPncp: number;
  /** Usado para os cards de resumo: "pregao" | "dispensa" | "outra". */
  grupo: "pregao" | "dispensa" | "outra";
}

/**
 * As 13 modalidades da API de consulta do PNCP (tabela de domínio
 * "codigoModalidadeContratacao" do Manual de Integração PNCP). Os nomes
 * seguem exatamente o que a API retorna em `modalidadeNome`, para que o
 * agrupamento (grupoDaModalidade) e os filtros batam com os dados reais.
 */
export const MODALIDADES: OpcaoModalidade[] = [
  { codigo: "leilao_eletronico", nome: "Leilão - Eletrônico", codigoPncp: 1, grupo: "outra" },
  { codigo: "dialogo_competitivo", nome: "Diálogo Competitivo", codigoPncp: 2, grupo: "outra" },
  { codigo: "concurso", nome: "Concurso", codigoPncp: 3, grupo: "outra" },
  { codigo: "concorrencia_eletronica", nome: "Concorrência - Eletrônica", codigoPncp: 4, grupo: "outra" },
  { codigo: "concorrencia_presencial", nome: "Concorrência - Presencial", codigoPncp: 5, grupo: "outra" },
  { codigo: "pregao_eletronico", nome: "Pregão - Eletrônico", codigoPncp: 6, grupo: "pregao" },
  { codigo: "pregao_presencial", nome: "Pregão - Presencial", codigoPncp: 7, grupo: "pregao" },
  { codigo: "dispensa", nome: "Dispensa de Licitação", codigoPncp: 8, grupo: "dispensa" },
  { codigo: "inexigibilidade", nome: "Inexigibilidade", codigoPncp: 9, grupo: "dispensa" },
  { codigo: "manifestacao_interesse", nome: "Manifestação de Interesse", codigoPncp: 10, grupo: "outra" },
  { codigo: "pre_qualificacao", nome: "Pré-qualificação", codigoPncp: 11, grupo: "outra" },
  { codigo: "credenciamento", nome: "Credenciamento", codigoPncp: 12, grupo: "outra" },
  { codigo: "leilao_presencial", nome: "Leilão - Presencial", codigoPncp: 13, grupo: "outra" },
];

/**
 * Comparação tolerante: a API de busca interna do PNCP às vezes abrevia o
 * nome da modalidade (ex.: "Dispensa" em vez de "Dispensa de Licitação"),
 * então um match exato perderia esses casos.
 */
export function modalidadesCorrespondem(a: string, b: string): boolean {
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function grupoDaModalidade(nomeModalidade: string | undefined): "pregao" | "dispensa" | "outra" {
  if (!nomeModalidade) return "outra";
  const encontrada = MODALIDADES.find((m) => modalidadesCorrespondem(m.nome, nomeModalidade));
  return encontrada?.grupo ?? "outra";
}

/** Compartilhado entre backend (app/api/licitacoes/route.ts) e os refinamentos rápidos no cliente. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * A fonte primária (busca interna) nunca devolve o código IBGE do
 * município (só a oficial e o Compras.gov.br têm esse campo) — usamos o
 * nome normalizado como chave alternativa nesse caso. Como cada busca vem
 * de uma única fonte, a chave é estável dentro de uma mesma resposta.
 */
export function chaveMunicipio(item: { codigoMunicipioIbge?: string; municipio?: string }): string | undefined {
  if (item.codigoMunicipioIbge) return item.codigoMunicipioIbge;
  return item.municipio ? normalizarTexto(item.municipio) : undefined;
}

export interface OpcaoPeriodo {
  valor: "15" | "30" | "60" | "90" | "personalizado";
  rotulo: string;
}

export const PERIODOS: OpcaoPeriodo[] = [
  { valor: "15", rotulo: "Próximos 15 dias" },
  { valor: "30", rotulo: "Próximos 30 dias" },
  { valor: "60", rotulo: "Próximos 60 dias" },
  { valor: "90", rotulo: "Próximos 90 dias" },
  { valor: "personalizado", rotulo: "Período personalizado" },
];

export const PORTAIS_CONHECIDOS = [
  "LICITANET",
  "Compras.gov.br",
  "Portal de Compras Públicas",
  "BLL Compras",
  "Compras BR",
  "Centro de Serviços Compartilhados",
] as const;

// Valores reais que o PNCP devolve (confirmado ao vivo em `situacao_nome` e
// `situacaoCompraNome`/`situacaoCompraNomePncp`, nas três fontes) — não são
// os nomes que se imaginaria à primeira vista (não existe "Recebendo
// propostas", "Em julgamento", "Homologada" ou "Encerrada" no domínio da
// API). "Cancelada" não vem nesse campo: é derivado do flag `cancelado` só
// na fonte primária.
export const SITUACOES = ["Divulgada no PNCP", "Revogada", "Anulada", "Suspensa", "Cancelada"] as const;

export type TonalidadeBadge = "neutral" | "primary" | "success" | "warning" | "danger" | "accent";

const TONALIDADE_POR_SITUACAO: Record<string, TonalidadeBadge> = {
  "divulgada no pncp": "success",
  suspensa: "warning",
  revogada: "danger",
  anulada: "danger",
  cancelada: "danger",
};

/** Usado para colorir o badge de situação — mesmo texto exibido nos detalhes da licitação. */
export function tonalidadeDaSituacao(situacao: string | undefined): TonalidadeBadge {
  if (!situacao) return "neutral";
  return TONALIDADE_POR_SITUACAO[situacao.toLowerCase()] ?? "neutral";
}

/**
 * O PNCP usa o mesmo texto "Divulgada no PNCP" tanto pro intervalo entre a
 * divulgação e a abertura oficial da disputa quanto pro período em que já
 * está recebendo propostas — não dá pra distinguir só pelo texto. Como
 * `dataAbertura` já indica quando a disputa abre, só chamamos de "Recebendo
 * proposta" quando essa data já chegou (ou é hoje); antes disso, mantemos o
 * texto original.
 */
export function rotuloSituacao(situacao: string | undefined, dataAbertura: string | undefined): string {
  if (situacao === "Divulgada no PNCP" && dataAbertura) {
    const abertura = new Date(dataAbertura);
    if (!Number.isNaN(abertura.getTime()) && abertura.getTime() <= Date.now()) {
      return "Recebendo proposta";
    }
  }
  return situacao ?? "Não informada";
}

/**
 * Rótulo do chip do filtro avançado de Situação — sem uma licitação
 * específica pra saber a `dataAbertura`, então usa sempre o nome mais
 * amigável. O `value` do chip continua sendo o texto real ("Divulgada no
 * PNCP"), então o filtro (que compara com o campo bruto da API) não muda.
 */
export function rotuloFiltroSituacao(situacao: string): string {
  return situacao === "Divulgada no PNCP" ? "Recebendo proposta" : situacao;
}

export interface OpcaoOrdenacao {
  valor:
    | "encerramento_asc"
    | "encerramento_desc"
    | "valor_desc"
    | "valor_asc"
    | "municipio_asc"
    | "portal_asc";
  rotulo: string;
}

export const OPCOES_ORDENACAO: OpcaoOrdenacao[] = [
  { valor: "encerramento_asc", rotulo: "Encerramento mais próximo" },
  { valor: "encerramento_desc", rotulo: "Encerramento mais distante" },
  { valor: "valor_desc", rotulo: "Maior valor" },
  { valor: "valor_asc", rotulo: "Menor valor" },
  { valor: "municipio_asc", rotulo: "Município" },
  { valor: "portal_asc", rotulo: "Portal" },
];

/**
 * Sem data de encerramento, o item sempre vai pro final da lista — nas duas
 * direções. Antes disso era resolvido com `+Infinity` num helper único
 * usado nos dois sentidos, o que empurrava itens sem data pro TOPO do
 * "mais distante" (como se a data desconhecida fosse a mais distante no
 * futuro) — incorreto, mesmo não sendo visível hoje (todo item que chega
 * até aqui normalmente já tem `dataEncerramento`, exceto quando o filtro de
 * Situação está em uso, que dispensa essa garantia).
 */
function compararPorEncerramento(a: Licitacao, b: Licitacao, ascendente: boolean): number {
  const tempoA = a.dataEncerramento ? new Date(a.dataEncerramento).getTime() : undefined;
  const tempoB = b.dataEncerramento ? new Date(b.dataEncerramento).getTime() : undefined;
  if (tempoA === undefined && tempoB === undefined) return 0;
  if (tempoA === undefined) return 1;
  if (tempoB === undefined) return -1;
  return ascendente ? tempoA - tempoB : tempoB - tempoA;
}

/**
 * Ordena a lista já buscada — puramente em memória, sem depender de nenhuma
 * das fontes (nenhuma delas aceita parâmetro de ordenação). Por isso é
 * aplicado no CLIENTE (components/DashboardClient.tsx), não reconsultando o
 * servidor a cada troca de "Ordenar por" — mesmo motivo da paginação e dos
 * refinamentos rápidos: reconsultar batia de novo na cascata de fontes,
 * instáveis por natureza, arriscando trocar de fonte no meio do caminho.
 */
export function ordenar(itens: Licitacao[], ordenarPor: OrdenacaoOpcao | null): Licitacao[] {
  const copia = [...itens];

  switch (ordenarPor) {
    case "encerramento_desc":
      return copia.sort((a, b) => compararPorEncerramento(a, b, false));
    case "valor_desc":
      return copia.sort((a, b) => (b.valorEstimado ?? -1) - (a.valorEstimado ?? -1));
    case "valor_asc":
      return copia.sort(
        (a, b) => (a.valorEstimado ?? Number.POSITIVE_INFINITY) - (b.valorEstimado ?? Number.POSITIVE_INFINITY),
      );
    case "municipio_asc":
      return copia.sort((a, b) => (a.municipio ?? "").localeCompare(b.municipio ?? "", "pt-BR"));
    case "portal_asc":
      return copia.sort((a, b) => (a.portal ?? "").localeCompare(b.portal ?? "", "pt-BR"));
    case "encerramento_asc":
    default:
      return copia.sort((a, b) => compararPorEncerramento(a, b, true));
  }
}

export interface PesquisaRapida {
  id: string;
  titulo: string;
  descricao: string;
  palavrasChave: string;
}

export const PESQUISAS_RAPIDAS: PesquisaRapida[] = [
  {
    id: "medicamentos",
    titulo: "Medicamentos",
    descricao: "Medicamentos e produtos farmacêuticos",
    palavrasChave: "medicamentos",
  },
  {
    id: "hospitalar",
    titulo: "Hospitalar",
    descricao: "Materiais e insumos hospitalares",
    palavrasChave: "material hospitalar",
  },
  {
    id: "odontologico",
    titulo: "Odontológico",
    descricao: "Materiais e equipamentos odontológicos",
    palavrasChave: "odontológico",
  },
  {
    id: "laboratorio",
    titulo: "Laboratório",
    descricao: "Materiais e reagentes laboratoriais",
    palavrasChave: "laboratório",
  },
  {
    id: "equipamentos_medicos",
    titulo: "Equipamentos médicos",
    descricao: "Aparelhos e equipamentos médico-hospitalares",
    palavrasChave: "equipamento médico",
  },
  {
    id: "epi",
    titulo: "EPI",
    descricao: "Equipamentos de proteção individual",
    palavrasChave: "equipamento de proteção individual",
  },
  {
    id: "vacinas",
    titulo: "Vacinas",
    descricao: "Vacinas e imunobiológicos",
    palavrasChave: "vacina",
  },
  {
    id: "limpeza",
    titulo: "Limpeza e higienização",
    descricao: "Materiais de limpeza e higienização",
    palavrasChave: "material de limpeza",
  },
  {
    id: "ambulancias",
    titulo: "Ambulâncias",
    descricao: "Veículos e equipamentos de transporte de pacientes",
    palavrasChave: "ambulância",
  },
];
