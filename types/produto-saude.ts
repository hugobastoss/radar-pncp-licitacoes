export interface ProdutoSaude {
  processo?: string;
  produto: string;
  registro: string;
  situacao?: string;
  cnpjEmpresa?: string;
  razaoSocialEmpresa?: string;
  /** ISO 8601. Omitida quando a ANVISA marca o registro como vigente apesar de a data já ter passado. */
  dataVencimento?: string;
  /** A ANVISA marca o registro como "VIGENTE". */
  vigente: boolean;
  /** Registro passou da data de vencimento — o motivo mais comum de "Inválido". */
  vencido: boolean;
  cancelado: boolean;
  /** ISO 8601 */
  dataCancelamento?: string;
  /** Classe de risco: I, II, III ou IV. */
  siglaRiscoProduto?: string;
}

/** Como o termo digitado foi interpretado — ver lib/produtos-saude.ts. */
export type TipoBuscaProdutoSaude = "nome" | "registro" | "processo" | "cnpj";

export interface ResultadoProdutosSaude {
  itens: ProdutoSaude[];
  total: number;
  pagina: number;
  totalPaginas: number;
  tipoBusca: TipoBuscaProdutoSaude;
  /** CNPJ da empresa aplicado junto com o termo (nome, registro ou processo), quando houver. */
  cnpjEmpresa?: string;
}

export interface FabricanteProdutoSaude {
  razaoSocial: string;
  /** Ex.: "FABRICANTE". */
  atividade?: string;
  pais?: string;
  endereco?: string;
}

export interface DocumentoProdutoSaude {
  /** Ex.: "INSTRUÇÕES DE USO OU MANUAL DO USUÁRIO DO PRODUTO". */
  tipo: string;
  nomeArquivo?: string;
  /** ISO 8601 */
  dataEnvio?: string;
}

/** O que só o endpoint de detalhe traz — complementa o `ProdutoSaude` da lista. */
export interface DetalheProdutoSaude {
  processo: string;
  nomeTecnico?: string;
  /** Número da Autorização de Funcionamento (AFE) da empresa detentora. */
  autorizacaoEmpresa?: string;
  risco?: { sigla: string; descricao?: string };
  /** ISO 8601 */
  dataInicioVigencia?: string;
  fabricantes: FabricanteProdutoSaude[];
  /** Modelos (ou, na falta deles, a descrição da apresentação) cadastrados no registro. */
  modelos: string[];
  /** A ANVISA devolveu só parte das apresentações — pode haver mais modelos que os listados. */
  modelosIncompletos: boolean;
  documentos: DocumentoProdutoSaude[];
  processoMedidaCautelar?: string;
  /** Publicada quando o registro sofreu alguma ação (cancelamento, suspensão…). */
  resolucao?: { situacao?: string; resolucao?: string; motivo?: string };
}

/** Identificação única do dispositivo — o `gtin` é o código de barras de um modelo. */
export interface Udi {
  id: number;
  gtin: string;
  nomeComercial?: string;
}

export interface CaracteristicasUdi {
  versaoModelo?: string;
  categoria?: string;
  unidadesPorEmbalagem?: number;
  esteril?: boolean;
  usoUnico?: boolean;
  contemLatex?: boolean;
  usoLeigo?: boolean;
  /** Ex.: "NAOAPLICA", como vem da ANVISA. */
  compatibilidadeRessonancia?: string;
  /** ISO 8601 */
  dataDescontinuacao?: string;
}

export interface CertificadoBoasPraticas {
  id: number;
  /** Ex.: "CBPF" (fabricação) ou "CBPDA" (distribuição e/ou armazenagem). */
  tipo: string;
  assunto?: string;
  status?: string;
  /** ISO 8601 */
  dataValidade?: string;
  concedidoPor?: string;
}

export interface DetalheCompletoProdutoSaude {
  detalhe: DetalheProdutoSaude;
  /** `null` quando a consulta de UDI falhou — o detalhe continua valendo. */
  udis: Udi[] | null;
  totalUdis: number;
  /** Certificados do CNPJ da detentora. `null` quando a consulta falhou. */
  certificados: CertificadoBoasPraticas[] | null;
}
