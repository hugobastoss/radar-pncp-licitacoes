export interface Socio {
  nome: string;
  qualificacao: string;
  dataEntrada?: string;
}

export interface Cnae {
  /** Já formatado no padrão da Receita (ex.: "35.14-0-00"). */
  codigo?: string;
  descricao: string;
}

/** Situação da empresa no Simples Nacional ou no MEI. Datas em AAAA-MM-DD. */
export interface OpcaoRegime {
  optante: boolean;
  dataOpcao?: string;
  /** Preenchida quando a empresa já foi optante e saiu. */
  dataExclusao?: string;
}

export interface Empresa {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  /** "MATRIZ" ou "FILIAL". */
  matrizOuFilial?: string;
  situacaoCadastral?: string;
  motivoSituacaoCadastral?: string;
  dataSituacaoCadastral?: string;
  dataInicioAtividade?: string;
  naturezaJuridica?: string;
  /** Só vem preenchido pra órgãos públicos (ex.: "PARA"). */
  enteFederativo?: string;
  porte?: string;
  capitalSocial?: number;
  simples: OpcaoRegime;
  mei: OpcaoRegime;
  /** Forma de tributação do ano mais recente informado (ex.: "LUCRO REAL"). */
  regimeTributario?: { ano: number; forma: string };
  atividadePrincipal?: Cnae;
  atividadesSecundarias: Cnae[];
  telefones: string[];
  email?: string;
  endereco?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  socios: Socio[];
}
