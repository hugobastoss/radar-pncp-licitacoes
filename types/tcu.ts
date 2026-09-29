/** Consulta consolidada de pessoa jurídica do TCU — ver lib/server/tcu-client.ts. */

export interface ItemCertidaoTcu {
  /** Ex.: "Inidôneos", "CNIA", "CEIS", "CNEP". */
  tipo: string;
  /** Ex.: "Licitantes Inidôneos", "CNIA - Cadastro Nacional de Condenações Cíveis por Ato de Improbidade…". */
  descricao: string;
  /** Ex.: "TCU", "CNJ", "Portal da Transparência". */
  emissor: string;
  /** `indisponivel` quando o TCU não conseguiu consultar aquele cadastro (ou devolveu uma situação nova). */
  situacao: "nada_consta" | "consta" | "indisponivel";
  /** Quando consta: o registro resumido, ex.: "Impedimento/proibição de contratar… (14/05/2027) - EPA-ESTADO DO PARÁ". */
  observacao?: string;
  linkConsulta?: string;
}

export interface CertidaoTcu {
  razaoSocial?: string;
  /** `false` quando o CNPJ não está na base do TCU — os cadastros ainda são consultados. */
  encontrado: boolean;
  /** Como vem do TCU: "29/09/2026 01:22". */
  emitidaEm?: string;
  itens: ItemCertidaoTcu[];
}
