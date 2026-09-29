export interface Socio {
  nome: string;
  qualificacao: string;
  dataEntrada?: string;
  /** "pj" = outra empresa (o `documento` é o CNPJ inteiro), "pf" = pessoa (CPF mascarado), "estrangeiro". */
  tipo?: "pj" | "pf" | "estrangeiro";
  /** Como a Receita publica: CNPJ completo do sócio empresa, ou CPF mascarado ("***455835**"). */
  documento?: string;
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

export interface IncentivoSuframa {
  /** Ex.: "ICMS", "IPI". */
  tributo: string;
  /** Ex.: "Isenção". */
  beneficio?: string;
  /** Ex.: "Industrialização e Comercialização". */
  finalidade?: string;
  /** Ex.: "Convênio ICMS n° 65 de 1988". */
  fundamento?: string;
}

export interface InscricaoSuframa {
  numero: string;
  /** Ex.: "Ativa". */
  situacao?: string;
  /** Datas em AAAA-MM-DD. */
  desde?: string;
  incentivos: IncentivoSuframa[];
}

/**
 * O que a CNPJá acrescenta ao cadastro da BrasilAPI (ver
 * lib/server/cnpja-client.ts): inscrição SUFRAMA e e-mail corporativo.
 */
export interface ComplementoCnpj {
  suframa: InscricaoSuframa[];
  /** Só e-mails corporativos — os pessoais (ex.: do dono de um MEI) ficam de fora. */
  emails: string[];
  /** Quando a CNPJá atualizou esses dados pela última vez (ISO 8601) — pode ter até 45 dias. */
  atualizadoEm?: string;
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
