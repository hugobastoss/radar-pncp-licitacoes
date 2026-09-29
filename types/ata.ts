/** Ata de registro de preço publicada no PNCP — ver lib/server/pncp-atas-client.ts. */
export interface AtaRegistroPreco {
  /** Número de controle PNCP da ata (ex.: "03930106000182-1-000203/2024-000001"). */
  id: string;
  /** Ex.: "Ata nº 0235/2024-5/2024". */
  titulo: string;
  objeto?: string;
  orgao?: string;
  /** CNPJ do órgão gerenciador, formatado. */
  orgaoCnpj?: string;
  unidade?: string;
  municipio?: string;
  uf?: string;
  modalidade?: string;
  /** Datas em AAAA-MM-DD. */
  vigenciaInicio?: string;
  vigenciaFim?: string;
  dataAssinatura?: string;
  cancelada: boolean;
  /** Página da ata no PNCP (itens, fornecedores e preços registrados). */
  link?: string;
}

export interface ResultadoAtas {
  itens: AtaRegistroPreco[];
  total: number;
  pagina: number;
  totalPaginas: number;
}
