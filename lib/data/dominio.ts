/**
 * Vocabulário de domínio do Radar Licitações.
 *
 * Estas listas cobrem os valores mais comuns hoje. A API do PNCP pode
 * devolver modalidades ou portais fora desta lista — nesse caso a interface
 * deve exibir o valor recebido normalmente (ver lib/portal.ts para o
 * tratamento de portais desconhecidos) em vez de escondê-lo.
 */

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

export const SITUACOES = [
  "Recebendo propostas",
  "Em julgamento",
  "Homologada",
  "Encerrada",
  "Suspensa",
  "Revogada",
  "Cancelada",
] as const;

export type TonalidadeBadge = "neutral" | "primary" | "success" | "warning" | "danger" | "accent";

const TONALIDADE_POR_SITUACAO: Record<string, TonalidadeBadge> = {
  "recebendo propostas": "success",
  "em julgamento": "warning",
  homologada: "primary",
  encerrada: "neutral",
  suspensa: "warning",
  revogada: "danger",
  cancelada: "danger",
};

/** Usado para colorir o badge de situação — mesmo texto exibido nos detalhes da licitação. */
export function tonalidadeDaSituacao(situacao: string | undefined): TonalidadeBadge {
  if (!situacao) return "neutral";
  return TONALIDADE_POR_SITUACAO[situacao.toLowerCase()] ?? "neutral";
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
