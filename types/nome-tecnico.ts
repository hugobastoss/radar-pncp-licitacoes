export interface NomeTecnico {
  codigo: string;
  nomeTecnico: string;
  /** Definição do nome técnico — vem preenchida em cerca de 1/4 da base. */
  descricao?: string;
  descricaoTipoProduto?: string;
  classeRisco?: string;
}

export interface ResultadoNomesTecnicos {
  itens: NomeTecnico[];
  total: number;
  pagina: number;
  totalPaginas: number;
  /** Nenhum nome tinha todas as palavras — vieram os que têm parte delas, ranqueados. */
  correspondenciaParcial: boolean;
}
