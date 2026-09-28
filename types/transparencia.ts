/** Dados do Portal da Transparência (CGU) — ver lib/server/transparencia-client.ts. */

export interface OrgaoSancionador {
  nome: string;
  uf?: string;
  /** Ex.: "MUNICIPAL", "ESTADUAL", "FEDERAL". */
  esfera?: string;
  /** Ex.: "Executivo". */
  poder?: string;
  telefone?: string;
  endereco?: string;
}

export interface Sancao {
  id: number;
  tipo: "CEIS" | "CNEP";
  tipoSancao: string;
  /**
   * `false` só pros tipos que não barram licitar/contratar (multa e
   * publicação extraordinária da decisão). Tipo desconhecido conta como
   * impeditivo — na dúvida, a tela avisa.
   */
  impedeContratar: boolean;
  /** Onde vale o impedimento — ex.: "No órgão sancionador", "Todas as Esferas em todos os Poderes". */
  abrangencia?: string;
  /** Datas já vêm formatadas (DD/MM/AAAA) pela própria API — exibir como estão. */
  dataInicioSancao?: string;
  /** Ausente = sem prazo determinado (37% das sanções numa amostra). */
  dataFimSancao?: string;
  dataPublicacao?: string;
  dataTransitoJulgado?: string;
  orgaoSancionador?: OrgaoSancionador;
  /** Artigos de lei aplicados, ex.: "LEI 14133 - ART. 156, III - IMPEDIMENTO DE LICITAR E CONTRATAR". */
  fundamentacao: string[];
  /** Só no CNEP; ausente quando zero. */
  valorMulta?: number;
  numeroProcesso?: string;
  /** Onde a sanção foi publicada, ex.: "Diário Oficial do Município Pagina 238". */
  publicacao?: { texto?: string; detalhamento?: string; link?: string };
  informacoesAdicionais?: string;
  nomeSancionado: string;
}

export interface ResultadoSancoes {
  ceis: Sancao[];
  cnep: Sancao[];
}

/** "Raio-x" da empresa no Portal da Transparência — o que ela tem de relação com o governo federal. */
export interface ResumoPessoaJuridica {
  /** A CGU não tem registro do CNPJ — todos os campos abaixo vêm `false`. */
  semRegistro: boolean;
  possuiContratacao: boolean;
  participanteLicitacao: boolean;
  favorecidoDespesas: boolean;
  emitiuNFe: boolean;
  convenios: boolean;
  favorecidoTransferencias: boolean;
  sancionadoCEIS: boolean;
  sancionadoCNEP: boolean;
  /** Entidade sem fins lucrativos impedida de firmar convênios. */
  sancionadoCEPIM: boolean;
  beneficiadoRenunciaFiscal: boolean;
}

export interface ContratoFederal {
  id: number;
  numero: string;
  objeto?: string;
  /** Ex.: "Pregão - Registro de Preço". */
  modalidade?: string;
  /** Número do processo da compra que originou o contrato. */
  processo?: string;
  unidadeGestora?: string;
  /** Sigla e nome do órgão vinculado (ex.: "FIOCRUZ — Fundação Oswaldo Cruz"). */
  orgao?: string;
  /** Sigla do ministério (ex.: "SAÚDE"). */
  orgaoMaximo?: string;
  /** Datas em AAAA-MM-DD. */
  dataAssinatura?: string;
  dataInicioVigencia?: string;
  dataFimVigencia?: string;
  valorInicial?: number;
  valorFinal?: number;
  vigente: boolean;
}

export interface PagamentosPorOrgao {
  orgao: string;
  orgaoSuperior?: string;
  valor: number;
}

export interface PagamentosFederais {
  /** Meses do período, em MM/AAAA. */
  inicio: string;
  fim: string;
  total: number;
  porOrgao: PagamentosPorOrgao[];
  /** `false` quando havia mais páginas do que o limite buscado — total subestimado. */
  completo: boolean;
}

export interface DadosGovernoFederal {
  /** `null` quando a consulta falhou. */
  resumo: ResumoPessoaJuridica | null;
  /**
   * `null` quando a consulta falhou. Vem vazio sem consultar quando o resumo
   * diz que não há contratação — economiza chamadas à CGU.
   */
  contratos: { itens: ContratoFederal[]; completo: boolean } | null;
  /** `null` quando a consulta falhou. Mesmo atalho do resumo, pra `favorecidoDespesas`. */
  pagamentos: PagamentosFederais | null;
}
