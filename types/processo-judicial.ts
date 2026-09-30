/** Metadados públicos de um processo judicial — ver lib/server/datajud-client.ts. */

export interface MovimentoProcesso {
  codigo: number;
  /** Ex.: "Distribuição", "Conclusão", "Trânsito em julgado". */
  nome?: string;
  dataHora: string; // ISO 8601
  /** Detalhe tabelado do movimento, ex.: "sorteio", "para julgamento". */
  complemento?: string;
}

export interface ProcessoJudicial {
  numeroProcesso: string;
  tribunal: string;
  /** Ex.: "G1" (1º grau), "G2" (2º grau), "JE" (Juizado Especial). */
  grau?: string;
  classe?: string;
  assuntos: string[];
  orgaoJulgador?: string;
  sistema?: string;
  /** `0` = público. Qualquer outro valor indica algum grau de segredo de justiça. */
  nivelSigilo: number;
  dataAjuizamento?: string; // ISO 8601
  dataUltimaAtualizacao?: string; // ISO 8601
  /** Mais recente primeiro. */
  movimentos: MovimentoProcesso[];
}
