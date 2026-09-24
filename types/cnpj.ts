export interface Socio {
  nome: string;
  qualificacao: string;
  dataEntrada?: string;
}

export interface Empresa {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacaoCadastral?: string;
  motivoSituacaoCadastral?: string;
  dataSituacaoCadastral?: string;
  dataInicioAtividade?: string;
  naturezaJuridica?: string;
  porte?: string;
  capitalSocial?: number;
  atividadePrincipal?: string;
  atividadesSecundarias: string[];
  telefone?: string;
  email?: string;
  endereco?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  socios: Socio[];
}
