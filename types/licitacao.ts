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

/** Um documento (edital, anexo) anexado à licitação no PNCP — ver lib/server/pncp-documentos-client.ts. */
export interface DocumentoLicitacao {
  titulo: string;
  /** Ex.: "Edital", "Anexo", "Ata de Registro de Preços". */
  tipo?: string;
  url: string;
  dataPublicacao?: string; // ISO 8601
}

export type PeriodoPreset = "15" | "30" | "60" | "90" | "personalizado";

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
}

/**
 * Refinamentos rápidos da própria tabela (seção 11 do briefing): não abrem
 * uma nova consulta ao PNCP, só restringem localmente (no cliente) o
 * resultado da pesquisa já buscada — reconsultar o servidor a cada troca
 * batia de novo na cascata de fontes (instáveis por natureza) e podia trazer
 * um resultado de uma fonte diferente da que gerou as opções na tela. Por
 * isso ficam fora de `FiltrosLicitacao` (que descreve só o que vai pro
 * servidor) e são estado local de components/DashboardClient.tsx.
 */
export interface RefinamentosRapidos {
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
  /**
   * Todos os itens que casam com a pesquisa (não paginado pelo servidor) —
   * a paginação é só um recorte local, feito no cliente, sobre esta lista já
   * buscada. Evita reconsultar o PNCP (fontes instáveis) a cada clique de
   * página, o que já causou o mesmo total/página trazer resultados
   * diferentes de uma chamada pra outra.
   */
  items: Licitacao[];
  total: number;
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
