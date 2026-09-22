/**
 * Modelo de dados do Radar Licitações.
 *
 * `Licitacao` é o formato que o FRONTEND consome. Ele é próximo do que a API
 * de consulta do PNCP retorna, mas alguns campos são derivados pelo backend
 * (camada /api/licitacoes) e não devem ser inventados no cliente:
 *
 * - `id`            → identificador estável para listas/react keys.
 * - `portal`        → calculado a partir de `linkSistemaOrigem` (ver lib/portal.ts).
 * - `linkPNCP`      → montado a partir de cnpjOrgao + ano + sequencial.
 *
 * Nenhum campo aqui deve receber um valor inventado quando a API não o
 * fornece: nesse caso o campo fica `undefined` e a camada de apresentação
 * decide o texto de fallback (ver lib/formatters.ts).
 */
export interface Licitacao {
  id: string;

  numeroLicitacao?: string;
  numeroControlePNCP?: string;

  orgao?: string;
  cnpjOrgao?: string;

  objeto?: string;
  modalidade?: string;
  modoDisputa?: string;

  municipio?: string;
  uf?: string;
  codigoMunicipioIbge?: string;

  valorEstimado?: number;
  /** `true` quando o PNCP marca o valor como sigiloso (não é o mesmo que ausente). */
  valorSigiloso?: boolean;

  dataAbertura?: string; // ISO 8601
  dataEncerramento?: string; // ISO 8601

  situacao?: string;

  /** Nome do portal de origem, já identificado a partir de `linkSistemaOrigem`. */
  portal?: string;
  linkSistemaOrigem?: string;
  linkPNCP?: string;
}

export type PeriodoPreset = "7" | "15" | "30" | "60" | "90" | "personalizado";

export type OrdenacaoOpcao =
  | "encerramento_asc"
  | "encerramento_desc"
  | "valor_desc"
  | "valor_asc"
  | "municipio_asc"
  | "portal_asc";

export interface FiltrosLicitacao {
  q?: string;
  uf?: string;
  /** Código IBGE do município, ou "TODOS". */
  municipio?: string;
  periodo?: PeriodoPreset;
  dataInicial?: string; // yyyy-mm-dd
  dataFinal?: string; // yyyy-mm-dd
  modalidades?: string[];
  portais?: string[];
  valorMinimo?: number;
  valorMaximo?: number;
  orgao?: string;
  numeroLicitacao?: string;
  situacao?: string;
  ordenarPor?: OrdenacaoOpcao;
  pagina?: number;
  tamanhoPagina?: number;

  /**
   * Refinamentos rápidos da própria tabela (seção 11 do briefing): não abrem
   * uma nova consulta "cheia" ao PNCP, apenas restringem ainda mais o
   * resultado da pesquisa já aplicada. Mantidos separados dos filtros acima
   * para que as opções desses três seletores continuem mostrando tudo que
   * a pesquisa aplicada trouxe, mesmo depois de um deles ser usado.
   */
  modalidadeRapida?: string;
  localRapido?: string;
  portalRapido?: string;
}

export interface ResumoLicitacoes {
  total: number;
  pregoes: number;
  dispensas: number;
  outras: number;
}

export interface FacetasDisponiveis {
  modalidades: string[];
  portais: string[];
  municipios: { codigoIbge: string; nome: string }[];
}

export interface MetaConsulta {
  consultadoEm: string; // ISO 8601
  tempoRespostaMs: number;
  /**
   * `true` quando a varredura foi interrompida por limite de páginas/tempo
   * antes de cobrir 100% do período — o total exibido pode estar subestimado.
   */
  parcial: boolean;
}

export interface LicitacoesResponse {
  items: Licitacao[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: ResumoLicitacoes;
  facets: FacetasDisponiveis;
  meta: MetaConsulta;
}

export type ResultadoBusca =
  | { status: "sucesso"; dados: LicitacoesResponse }
  | { status: "erro_timeout" }
  | { status: "erro_conexao" }
  | { status: "erro_servidor"; mensagem?: string }
  | { status: "cancelado" };
