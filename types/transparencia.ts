/** Dados do Portal da Transparência (CGU) — ver lib/server/transparencia-client.ts. */

export interface OrgaoSancionador {
  nome: string;
  uf?: string;
  /** Ex.: "MUNICIPAL", "ESTADUAL", "FEDERAL". */
  esfera?: string;
  /** Ex.: "Executivo". */
  poder?: string;
  telefone?: string;
  endereco?: string;
}

export interface Sancao {
  id: number;
  tipo: "CEIS" | "CNEP";
  tipoSancao: string;
  /**
   * `false` só pros tipos que não barram licitar/contratar (multa e
   * publicação extraordinária da decisão). Tipo desconhecido conta como
   * impeditivo — na dúvida, a tela avisa.
   */
  impedeContratar: boolean;
  /** Onde vale o impedimento — ex.: "No órgão sancionador", "Todas as Esferas em todos os Poderes". */
  abrangencia?: string;
  /** Datas já vêm formatadas (DD/MM/AAAA) pela própria API — exibir como estão. */
  dataInicioSancao?: string;
  /** Ausente = sem prazo determinado (37% das sanções numa amostra). */
  dataFimSancao?: string;
  dataPublicacao?: string;
  dataTransitoJulgado?: string;
  orgaoSancionador?: OrgaoSancionador;
  /** Artigos de lei aplicados, ex.: "LEI 14133 - ART. 156, III - IMPEDIMENTO DE LICITAR E CONTRATAR". */
  fundamentacao: string[];
  /** Só no CNEP; ausente quando zero. */
  valorMulta?: number;
  numeroProcesso?: string;
  /** Onde a sanção foi publicada, ex.: "Diário Oficial do Município Pagina 238". */
  publicacao?: { texto?: string; detalhamento?: string; link?: string };
  informacoesAdicionais?: string;
  nomeSancionado: string;
}

export interface ResultadoSancoes {
  ceis: Sancao[];
  cnep: Sancao[];
}

/** "Raio-x" da empresa no Portal da Transparência — o que ela tem de relação com o governo federal. */
export interface ResumoPessoaJuridica {
  /** A CGU não tem registro do CNPJ — todos os campos abaixo vêm `false`. */
  semRegistro: boolean;
  possuiContratacao: boolean;
  participanteLicitacao: boolean;
  favorecidoDespesas: boolean;
  emitiuNFe: boolean;
  convenios: boolean;
  favorecidoTransferencias: boolean;
  sancionadoCEIS: boolean;
  sancionadoCNEP: boolean;
  /** Entidade sem fins lucrativos impedida de firmar convênios. */
  sancionadoCEPIM: boolean;
  beneficiadoRenunciaFiscal: boolean;
}

export interface ContratoFederal {
  id: number;
  numero: string;
  objeto?: string;
  /** Ex.: "Pregão - Registro de Preço". */
  modalidade?: string;
  /** Número do processo da compra que originou o contrato. */
  processo?: string;
  unidadeGestora?: string;
  /** Sigla e nome do órgão vinculado (ex.: "FIOCRUZ — Fundação Oswaldo Cruz"). */
  orgao?: string;
  /** Sigla do ministério (ex.: "SAÚDE"). */
  orgaoMaximo?: string;
  /** Datas em AAAA-MM-DD. */
  dataAssinatura?: string;
  dataInicioVigencia?: string;
  dataFimVigencia?: string;
  valorInicial?: number;
  valorFinal?: number;
  vigente: boolean;
}

export interface PagamentosPorOrgao {
  orgao: string;
  orgaoSuperior?: string;
  valor: number;
}

export interface PagamentosFederais {
  /** Meses do período, em MM/AAAA. */
  inicio: string;
  fim: string;
  total: number;
  porOrgao: PagamentosPorOrgao[];
  /** `false` quando havia mais páginas do que o limite buscado — total subestimado. */
  completo: boolean;
}

/**
 * O que a pessoa tem de relação com o governo federal, pelo `pessoa-fisica`
 * da CGU. Benefícios sociais (Bolsa Família, BPC, auxílios…), que a CGU
 * também informa, ficam de fora de propósito — não têm a ver com
 * contratações e são o dado mais sensível da resposta.
 */
export interface ResumoPessoaFisica {
  /** A CGU não tem registro do CPF — todos os campos abaixo vêm `false`. */
  semRegistro: boolean;
  servidor: boolean;
  servidorInativo: boolean;
  /** Recebe pensão ou representa um pensionista. */
  pensionista: boolean;
  instituidorPensao: boolean;
  contratado: boolean;
  participanteLicitacao: boolean;
  favorecidoDespesas: boolean;
  beneficiarioDiarias: boolean;
  /** Ocupa imóvel funcional da União. */
  permissionario: boolean;
  /** Portador de cartão de pagamento do governo federal (CPGF ou CPDC). */
  portadorCartao: boolean;
  sancionadoCEIS: boolean;
  sancionadoCNEP: boolean;
  sancionadoCEAF: boolean;
}

/** Expulsão da administração federal (CEAF): demissão, destituição, cassação de aposentadoria. */
export interface PunicaoCeaf {
  id: number;
  /** Ex.: "Demissão". */
  tipo: string;
  /** Como vem da API, DD/MM/AAAA. */
  dataPublicacao?: string;
  orgao?: string;
  uf?: string;
  cargoEfetivo?: string;
  cargoComissao?: string;
  portaria?: string;
  processo?: string;
  fundamentacao: string[];
}

/** Registro na lista de pessoas politicamente expostas (PEP) da CGU. */
export interface PessoaExposta {
  funcao: string;
  nivel?: string;
  orgao?: string;
  /** Como vêm da API. */
  inicioExercicio?: string;
  fimExercicio?: string;
  /** Fim dos 5 anos em que a pessoa segue PEP depois de deixar a função. */
  fimCarencia?: string;
}

/** Vínculo com o Poder Executivo federal — servidor, militar, aposentado ou pensionista. */
export interface VinculoServidor {
  /** Ex.: "Civil", "Militar". */
  tipo?: string;
  /** Ex.: "Ativo permanente", "Aposentado". */
  situacao?: string;
  cargo?: string;
  funcao?: string;
  orgaoLotacao?: string;
  orgaoExercicio?: string;
  uf?: string;
}

/** Consulta de CPF: cada parte é `null` quando a consulta dela falhou, e as outras continuam valendo. */
export interface DadosPessoaFisica {
  nome?: string;
  /** Como a CGU devolve, já mascarado: "***.444.777-**". */
  cpfMascarado?: string;
  resumo: ResumoPessoaFisica;
  sancoes: ResultadoSancoes | null;
  ceaf: PunicaoCeaf[] | null;
  peps: PessoaExposta[] | null;
  /** Vem vazio sem consultar quando o resumo diz que a pessoa não é nem foi servidor. */
  vinculos: VinculoServidor[] | null;
  /** Vem vazio sem consultar quando o resumo diz que não há contrato. */
  contratos: { itens: ContratoFederal[]; completo: boolean } | null;
}

/** Emenda parlamentar ao orçamento federal. Valores em reais. */
export interface EmendaParlamentar {
  /** 12 dígitos: ano + código do autor + número (ex.: "202541840004"). */
  codigo: string;
  ano: number;
  /** Ex.: "Emenda Individual - Transferências com Finalidade Definida", "Emenda de Bancada". */
  tipo: string;
  /** Parlamentar, bancada ("BANCADA DO AMAZONAS") ou comissão ("COM. DA SAUDE"). */
  autor: string;
  numero: string;
  /** Ex.: "Nacional", "ESPÍRITO SANTO (UF)", "MANAUS - AM". */
  localidade?: string;
  funcao?: string;
  subfuncao?: string;
  /** Pode vir negativo quando houve anulação de empenho maior que o empenhado no ano. */
  empenhado: number;
  liquidado: number;
  pago: number;
  /** Restos a pagar: saldo de anos anteriores inscrito, cancelado e pago. */
  restoInscrito: number;
  restoCancelado: number;
  restoPago: number;
}

export interface ResultadoEmendas {
  itens: EmendaParlamentar[];
  pagina: number;
  /** A CGU não informa o total: há mais quando a página veio cheia (15). */
  temMais: boolean;
}

export interface FavorecidoDocumento {
  nome: string;
  /** CNPJ ou CPF formatado, como vem da CGU (CPF já mascarado). */
  documento?: string;
  uf?: string;
}

/** Empenho, liquidação ou pagamento ligado a uma emenda. */
export interface DocumentoEmenda {
  /** Código completo (UG + gestão + número), ex.: "785810000012025OB006819". */
  codigo: string;
  /** Ex.: "2025OB006819". */
  codigoResumido: string;
  /** Como vem da API, DD/MM/AAAA. */
  data?: string;
  /** "Empenho", "Liquidação" ou "Pagamento". */
  fase: string;
  /** Ex.: "Original", "Estorno / Cancelamento". */
  especie?: string;
  /** Só quando `detalhado`. Liquidação não tem valor na CGU; estorno vem negativo. */
  valor?: number;
  favorecido?: FavorecidoDocumento;
  orgao?: string;
  observacao?: string;
  /** `false` quando o detalhe (valor, favorecido) não foi buscado ou falhou. */
  detalhado: boolean;
}

/** Quanto um favorecido recebeu da emenda: soma dos pagamentos, estornos descontados. */
export interface RecebedorEmenda extends FavorecidoDocumento {
  valor: number;
}

export interface ResultadoDocumentosEmenda {
  /** Mais recentes primeiro. */
  itens: DocumentoEmenda[];
  recebedores: RecebedorEmenda[];
  /** `false` quando havia mais documentos do que o limite buscado. */
  completo: boolean;
  /** `false` quando algum pagamento ficou sem detalhe — a soma por favorecido está incompleta. */
  pagamentosDetalhados: boolean;
}

/** Nota de empenho do governo federal em favor de uma empresa, com o que já foi pago dela. */
export interface EmpenhoFederal {
  /** Código completo (UG + gestão + número), ex.: "785810000012025NE005117". */
  codigo: string;
  /** Ex.: "2025NE005117". */
  codigoResumido: string;
  /** Ano de emissão do empenho. */
  ano: number;
  /** Como vem da API, DD/MM/AAAA. */
  data?: string;
  orgao?: string;
  orgaoSuperior?: string;
  ug?: string;
  /** O que foi empenhado, como o órgão descreveu. */
  descricao?: string;
  /** Nota do resto a pagar, quando difere da descrição — ex.: "CANCELAMENTO DE RESTOS A PAGAR DO EMPENHO…". */
  notaRestos?: string;
  /** Ex.: "39 - Outros Serviços de Terceiros - Pessoa Jurídica". */
  elemento?: string;
  processo?: string;
  /** Valor atual do empenho, já com reforços e anulações. */
  empenhado: number;
  /** Soma dos pagamentos (estornos descontados), inclusive de restos a pagar em anos seguintes. */
  pago: number;
  aReceber: number;
  /** Nem pago nem a receber: em geral, resto a pagar cancelado. */
  cancelado: number;
  /** Empenho de ano anterior — o saldo é resto a pagar. */
  restoAPagar: boolean;
  /** `false` quando os pagamentos dele não puderam ser consultados — pago e a receber podem estar errados. */
  completo: boolean;
}

export interface ResultadoEmpenhosFederais {
  favorecido?: string;
  /** Anos das listas de empenhos consultadas, ex.: [2026, 2025]. */
  anos: number[];
  /** Maior saldo primeiro. */
  empenhos: EmpenhoFederal[];
  totais: { empenhado: number; pago: number; aReceber: number; cancelado: number };
  /** Quantos empenhos a empresa tem nos anos consultados; só os mais recentes são analisados. */
  totalEmpenhos: number;
  /** `false` quando algo ficou de fora: limite de páginas ou de empenhos, ou consulta que falhou. */
  completo: boolean;
}

/** Convênio (ou contrato de repasse, termo de fomento…) do governo federal com estado, município ou entidade. */
export interface ConvenioFederal {
  id: number;
  /** Código do convênio no Portal (ex.: "999870") — é o que vai na URL da página dele. */
  codigo?: string;
  /** Ex.: "07021/2026". */
  numero?: string;
  objeto?: string;
  /** Ex.: "EM EXECUÇÃO", "CONCLUÍDO", "NORMAL". */
  situacao?: string;
  convenente: { nome: string; documento?: string; tipo?: string };
  municipio?: string;
  /** Sigla, ex.: "AM". */
  uf?: string;
  /** Quem repassa: ministério ou órgão federal. */
  concedente?: string;
  /** Unidade que opera o repasse (ex.: "CAIXA ECONOMICA FEDERAL - PROGRAMAS SOCIAIS"). */
  unidadeGestora?: string;
  valor: number;
  valorLiberado: number;
  valorContrapartida: number;
  /** Datas em AAAA-MM-DD. */
  inicioVigencia?: string;
  fimVigencia?: string;
  ultimaLiberacao?: string;
  valorUltimaLiberacao?: number;
}

export interface ResultadoConvenios {
  itens: ConvenioFederal[];
  pagina: number;
  /** A CGU não informa o total: há mais quando a página veio cheia (15). */
  temMais: boolean;
}

/** Regime especial de tributação em que a empresa foi habilitada pela Receita (ex.: REIDI, RECAP, PADIS). */
export interface RegimeFiscalHabilitado {
  /** Ex.: "Reidi". */
  beneficio: string;
  /** Ex.: "Regime Especial de Incentivos para o Desenvolvimento da Infraestrutura." */
  descricao?: string;
  vigente: boolean;
  /** Como vêm da API, DD/MM/AAAA. */
  inicio?: string;
  fim?: string;
  fundamentoLegal?: string;
}

/** Imunidade ou isenção (entidades sem fins lucrativos, templos, partidos…). */
export interface ImunidadeIsencao {
  beneficio: string;
  tipoEntidade?: string;
}

export interface RenunciaAnual {
  ano: number;
  total: number;
  /** Maior primeiro. */
  porTributo: { tributo: string; valor: number }[];
}

/** Benefícios fiscais federais da empresa, pelos dados de renúncia da Receita que a CGU publica. */
export interface BeneficiosFiscais {
  regimes: RegimeFiscalHabilitado[];
  imunidades: ImunidadeIsencao[];
  /** Quanto a empresa deixou de pagar de tributos federais por ano — mais recente primeiro. */
  renunciasPorAno: RenunciaAnual[];
  /** `false` quando havia mais páginas de renúncia do que o limite buscado — totais subestimados. */
  completo: boolean;
}

export interface DadosGovernoFederal {
  /** `null` quando a consulta falhou. */
  resumo: ResumoPessoaJuridica | null;
  /** `null` quando a consulta falhou. */
  beneficiosFiscais: BeneficiosFiscais | null;
  /**
   * `null` quando a consulta falhou. Vem vazio sem consultar quando o resumo
   * diz que não há contratação — economiza chamadas à CGU.
   */
  contratos: { itens: ContratoFederal[]; completo: boolean } | null;
  /** `null` quando a consulta falhou. Mesmo atalho do resumo, pra `favorecidoDespesas`. */
  pagamentos: PagamentosFederais | null;
}
