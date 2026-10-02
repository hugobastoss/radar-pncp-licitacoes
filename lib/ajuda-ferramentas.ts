/**
 * O que cada ferramenta pede pra buscar e o que ela traz de volta, pra tela
 * de ajuda (app/(app)/ajuda/page.tsx). Texto pro usuário final, não a
 * documentação técnica dos campos (ver docs/APIS.md e docs/CAMPOS-ORGAO.md
 * pra isso).
 */
export interface AjudaFerramenta {
  /** O que a pessoa informa pra fazer a busca. */
  busca: string;
  /** O que a busca traz, em itens curtos. */
  retorna: string[];
  fonte: string;
}

export const AJUDA_FERRAMENTAS: Record<string, AjudaFerramenta> = {
  "/licitacoes": {
    busca: "Texto livre (objeto ou órgão), estado, município, período, modalidade, portal e valor.",
    retorna: [
      "Objeto, órgão responsável, modalidade e situação",
      "Valor estimado e datas de abertura e encerramento",
      "Portal de origem e link para o edital completo",
      "Documentos anexados ao edital",
    ],
    fonte: "PNCP (Portal Nacional de Contratações Públicas)",
  },
  "/atas": {
    busca: "Texto livre e estado.",
    retorna: [
      "Objeto e órgão da ata de registro de preço",
      "Vigência e possibilidade de adesão (\"carona\") por outros órgãos",
    ],
    fonte: "PNCP",
  },
  "/empenhos-am": {
    busca: "CNPJ do fornecedor.",
    retorna: [
      "Contratos do fornecedor com o Governo do Amazonas",
      "Valor empenhado, liquidado e pago de cada nota",
      "Quanto ainda falta receber",
    ],
    fonte: "SGC e Portal da Transparência Fiscal (SEFAZ-AM)",
  },
  "/empenhos-federal": {
    busca: "CNPJ do fornecedor.",
    retorna: [
      "Notas de empenho do governo federal em favor do fornecedor",
      "Valor empenhado e pago de cada nota",
      "Quanto ainda falta receber",
    ],
    fonte: "Portal da Transparência (CGU)",
  },
  "/convenios": {
    busca: "Estado, município ou nome completo do convenente, com período de vigência.",
    retorna: ["Objeto e valor do convênio", "Quanto já foi liberado", "Vigência"],
    fonte: "Portal da Transparência (CGU)",
  },
  "/emendas": {
    busca: "Nome do autor (parlamentar, bancada ou comissão), ano, tipo ou código da emenda.",
    retorna: [
      "Quanto a emenda empenhou, liquidou e pagou",
      "Documentos: empenhos, liquidações e pagamentos",
      "Quem recebeu o dinheiro, por favorecido",
    ],
    fonte: "Portal da Transparência (CGU)",
  },
  "/cnpj": {
    busca: "CNPJ.",
    retorna: [
      "Cadastro na Receita Federal: razão social, endereço, sócios, CNAE, capital social, Simples Nacional e MEI",
      "Sanções (CEIS/CNEP) e certidão consolidada do TCU",
      "Relação com o governo federal: contratos, pagamentos e benefícios fiscais",
      "Contratos com o Governo do Amazonas",
      "Inscrição SUFRAMA e inscrições estaduais",
      "Registro como operadora de plano de saúde (ANS)",
      "Emendas parlamentares (\"PIX\") recebidas",
      "Quem registrou o domínio do e-mail corporativo",
      "Presença na lista suja do trabalho escravo",
    ],
    fonte: "Receita Federal, Portal da Transparência, TCU, SEFAZ-AM, CNPJá, CNPJ.ws, ANS, TransfereGov, registro.br e MTE",
  },
  "/cpf": {
    busca: "CPF.",
    retorna: [
      "Nome completo (CPF exibido parcialmente mascarado)",
      "Sanções: CEIS, CNEP e CEAF",
      "Se é pessoa politicamente exposta (PEP)",
      "Vínculo como servidor público federal",
      "Contratos federais",
    ],
    fonte: "Portal da Transparência (CGU)",
  },
  "/processos": {
    busca: "Tribunal e número completo do processo.",
    retorna: ["Classe e assuntos do processo", "Órgão julgador", "Andamentos (movimentações)"],
    fonte: "CNJ (DataJud)",
  },
  "/sancoes": {
    busca: "CNPJ ou CPF.",
    retorna: [
      "Sanções no CEIS e no CNEP",
      "Abrangência (onde o impedimento vale) e fundamentação legal",
      "Se a sanção impede contratar com a administração pública",
      "Certidão consolidada do TCU",
    ],
    fonte: "Portal da Transparência (CGU) e TCU",
  },
  "/rastros": {
    busca: "Um ou mais CNPJs e/ou códigos de emenda.",
    retorna: [
      "Mapa visual das relações entre as empresas e emendas adicionadas",
      "Cruzamentos em comum: sócio, órgão, benefício fiscal, endereço, telefone, e-mail ou dono de domínio",
      "Empresas sancionadas com contratos, ou com dinheiro de emenda",
    ],
    fonte: "Mesmas fontes da consulta de CNPJ e de Emendas",
  },
  "/cep": {
    busca: "CEP.",
    retorna: ["Logradouro, bairro, cidade, UF e código IBGE do município", "Coordenadas, quando disponíveis"],
    fonte: "BrasilAPI",
  },
  "/dominio": {
    busca: "Domínio terminado em .br.",
    retorna: ["Titular do domínio (CNPJ ou CPF)", "Data de registro, última alteração e expiração"],
    fonte: "registro.br (RDAP)",
  },
  "/ncm": {
    busca: "Código ou palavra-chave.",
    retorna: ["Descrição da classificação de mercadorias (Nomenclatura Comum do Mercosul)"],
    fonte: "BrasilAPI",
  },
  "/produtos-saude": {
    busca: "Nome do produto, número de registro, número de processo ou CNPJ da detentora.",
    retorna: [
      "Situação do registro: vigente, vencido ou cancelado",
      "Fabricante, modelos e classe de risco",
      "Códigos de barra (UDI)",
      "Certificados de boas práticas",
    ],
    fonte: "ANVISA",
  },
  "/nome-tecnico": {
    busca: "Palavra-chave, categoria ou classe de risco.",
    retorna: ["Definição, categoria e classe de risco da nomenclatura técnica oficial"],
    fonte: "ANVISA",
  },
};
