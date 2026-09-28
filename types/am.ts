/**
 * Contratos e empenhos do Governo do Amazonas — ver
 * lib/server/am-sgc-client.ts (contratos, SGC) e
 * lib/server/am-sefaz-despesa-client.ts (valores das notas, portal da SEFAZ).
 */

export interface AditivoEstadual {
  /** Ex.: "1º TACT 9/2026". */
  termo: string;
  numero: string;
  /** Ex.: "Termo Aditivo". */
  tipo?: string;
  /** Ex.: "Alteração de Valores". */
  detalhamento?: string;
  /** AAAA-MM-DD */
  dataAssinatura?: string;
  valorTotal?: number;
}

export interface ContratoEstadual {
  /** `${ug}-${ano}-${numero}` — identifica o contrato entre UGs e anos. */
  chave: string;
  /** Código da unidade gestora, 6 dígitos (ex.: "017101"). */
  ug: string;
  ugNome?: string;
  ugSigla?: string;
  numero: string;
  ano: string;
  /** Ex.: "CT 8/2026" ou "NE 361/2026" (empenho usado como instrumento de contrato). */
  termo: string;
  objeto?: string;
  processoCompra?: string;
  valorMensal?: number;
  valorTotal?: number;
  contratado: string;
  /** Só dígitos. */
  cnpjContratado: string;
  vigente: boolean;
  /** AAAA-MM-DD */
  dataAssinatura?: string;
  dataInicio?: string;
  dataFim?: string;
  diarioOficial?: { numero?: string; data?: string };
  consorcio: boolean;
  aditivos: AditivoEstadual[];
}

export interface ResultadoContratosAm {
  contratos: ContratoEstadual[];
  /** Anos varridos: o atual e o anterior inteiros, os mais antigos só com contratos vigentes. */
  anos: { inicio: number; fim: number };
  /** `false` quando alguma UG falhou — pode haver contratos faltando. */
  completo: boolean;
}

/**
 * Empenhado, liquidado e pago são só das notas do ano; as de anos
 * anteriores (restos a pagar) entram à parte, porque a SEFAZ não informa
 * empenhado nem liquidado delas no ano — somar tudo junto dava "pago maior
 * que liquidado".
 */
export interface TotaisEmpenhos {
  empenhado: number;
  liquidado: number;
  pago: number;
  /** Tudo que falta receber: empenhado − pago das notas do ano + `restosAPagar`. */
  aReceber: number;
  /** Liquidado − pago: entrega já atestada, só falta pagar (só notas do ano). */
  liquidadoAPagar: number;
  /** Saldo a pagar de notas de anos anteriores — já incluído em `aReceber`. */
  restosAPagar: number;
  /** Pago neste ano de notas de anos anteriores. */
  pagoRestosAPagar: number;
}

/**
 * - `encontrada`: a nota está na lista da SEFAZ do ano atual.
 * - `sem_saldo`: nota de ano anterior que não aparece como resto a pagar — quitada ou cancelada.
 * - `nao_encontrada`: nota do ano que não aparece na SEFAZ — normalmente um reforço, que a SEFAZ soma na nota original do mesmo contrato.
 * - `indisponivel`: não foi possível ler a lista de notas da UG na SEFAZ agora.
 */
export type SituacaoNota = "encontrada" | "sem_saldo" | "nao_encontrada" | "indisponivel";

export interface NotaEmpenhoContrato {
  /** No formato do portal da SEFAZ, ex.: "2026NE0001718". */
  numero: string;
  ano: string;
  ug: string;
  /** Valor registrado no contrato (SGC) — não inclui reforços e anulações posteriores. */
  valorNoContrato: number;
  /** AAAA-MM-DD */
  dataEmissao?: string;
  situacao: SituacaoNota;
  /** Valores do portal da SEFAZ; só quando `encontrada`. */
  valores?: TotaisEmpenhos;
  /** Página da nota no portal da SEFAZ. */
  link: string;
}

export interface ContratoComEmpenhos extends ContratoEstadual {
  notas: NotaEmpenhoContrato[];
  totais: TotaisEmpenhos;
}

export interface ResultadoEmpenhosAm {
  contratos: ContratoComEmpenhos[];
  totais: TotaisEmpenhos;
  /** Ano do exercício consultado no portal da SEFAZ. */
  anoExercicio: number;
  /** `false` quando alguma consulta de contrato ou de nota falhou. */
  completo: boolean;
}
