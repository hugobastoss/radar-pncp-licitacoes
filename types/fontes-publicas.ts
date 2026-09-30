/**
 * Fontes públicas que complementam a ficha do CNPJ (ver docs/FONTES-PUBLICAS.md):
 * lista suja do MTE, registro.br, CNPJ.ws, TransfereGov e ANS.
 */

/** Uma linha do Cadastro de Empregadores do MTE (a "lista suja" do trabalho análogo ao de escravo). */
export interface RegistroListaSuja {
  anoAcaoFiscal?: number;
  uf?: string;
  empregador: string;
  /** Só dígitos, como publicado: 14 (CNPJ) ou 11 (CPF). */
  documento: string;
  estabelecimento?: string;
  trabalhadores?: number;
  cnae?: string;
  /** Datas como o MTE publica: dd/mm/aaaa. */
  decisaoEm?: string;
  inclusaoEm?: string;
}

/** Quem registrou um domínio .br, segundo o registro.br. */
export interface RegistroDominio {
  dominio: string;
  titular?: {
    nome?: string;
    tipo: "cnpj" | "cpf" | "outro";
    /** 14 dígitos. Só vem quando o titular é pessoa jurídica — CPF de titular nunca sai do servidor. */
    cnpj?: string;
  };
  /** Datas em ISO 8601. */
  criadoEm?: string;
  alteradoEm?: string;
  expiraEm?: string;
}

export interface InscricaoEstadual {
  uf: string;
  numero: string;
  ativa: boolean;
  atualizadoEm?: string;
}

/** Um plano de ação de transferência especial ("emenda PIX") recebida. */
export interface TransferenciaEspecial {
  codigo: string;
  ano: number;
  situacao: string;
  motivoImpedimento?: string;
  parlamentar?: string;
  /** 12 dígitos, o mesmo código da tela de Emendas. */
  numeroEmenda?: string;
  area?: string;
  /** Custeio + investimento. */
  valor: number;
}

export interface TransferenciasEspeciais {
  /** Quantos planos de ação a fonte tem para o CNPJ — `itens` traz só os mais recentes. */
  total: number;
  itens: TransferenciaEspecial[];
}

export interface OperadoraAns {
  registro: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  classificacao?: string;
  ativa: boolean;
}
