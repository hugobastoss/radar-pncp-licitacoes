export interface ProdutoSaude {
  processo?: string;
  produto: string;
  registro: string;
  situacao?: string;
  cnpjEmpresa?: string;
  razaoSocialEmpresa?: string;
  /** ISO 8601 */
  dataVencimento?: string;
  cancelado: boolean;
  siglaRiscoProduto?: string;
}
