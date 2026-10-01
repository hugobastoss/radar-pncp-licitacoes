/**
 * Título e descrição (curta, uma linha) de cada tela — usado pelo cabeçalho
 * (components/Header.tsx) pra mostrar o título da ferramenta atual em vez do
 * nome genérico do site. O ícone do cabeçalho é sempre a logo do site; só o
 * texto muda por tela. É o que faz o cabeçalho de cada ferramenta existir só
 * aqui, em vez de duplicado dentro de cada *Client.tsx.
 */
export interface CabecalhoPagina {
  titulo: string;
  descricao: string;
  beta?: boolean;
}

export const CABECALHOS: Record<string, CabecalhoPagina> = {
  "/licitacoes": {
    titulo: "Licitações",
    descricao: "Busque licitações em aberto, direto nas fontes oficiais do PNCP.",
  },
  "/atas": {
    titulo: "Atas de registro de preço",
    descricao: "Atas vigentes publicadas no PNCP, com possibilidade de adesão.",
  },
  "/empenhos-am": {
    titulo: "Empenhos a receber: Governo do Amazonas",
    descricao: "Contratos e empenhos do fornecedor com o Governo do Amazonas.",
  },
  "/empenhos-federal": {
    titulo: "Empenhos a receber: Governo federal",
    descricao: "Notas de empenho do governo federal em favor do fornecedor.",
  },
  "/convenios": {
    titulo: "Convênios federais",
    descricao: "Repasses do governo federal a estados, municípios e entidades.",
  },
  "/emendas": {
    titulo: "Emendas parlamentares",
    descricao: "Quanto cada emenda empenhou, liquidou, pagou e para quem.",
  },
  "/cnpj": {
    titulo: "Consultar CNPJ",
    descricao: "Dados cadastrais, sanções e relação da empresa com o governo.",
  },
  "/cpf": {
    titulo: "Consultar CPF",
    descricao: "Relação da pessoa física com o governo federal.",
  },
  "/processos": {
    titulo: "Consultar processo judicial",
    descricao: "Metadados públicos de um processo, direto na base do CNJ.",
  },
  "/sancoes": {
    titulo: "Consultar sanções (CEIS/CNEP)",
    descricao: "Verifique se uma empresa está impedida ou punida de contratar.",
  },
  "/sinapse": {
    titulo: "Sinapse",
    descricao: "Mapa de relações entre empresas, sócios, órgãos e sanções.",
    beta: true,
  },
  "/cep": {
    titulo: "Consultar CEP",
    descricao: "Consulte o endereço correspondente a um CEP.",
  },
  "/dominio": {
    titulo: "Consultar domínio",
    descricao: "Consulte quem registrou um domínio .br, no registro.br.",
  },
  "/ncm": {
    titulo: "Consultar NCM",
    descricao: "Classificação de mercadorias (Nomenclatura Comum do Mercosul).",
  },
  "/produtos-saude": {
    titulo: "Consultar produtos para saúde",
    descricao: "Registro de dispositivos médicos e hospitalares na ANVISA.",
  },
  "/nome-tecnico": {
    titulo: "Consultar nomenclatura técnica",
    descricao: "Nomenclatura técnica oficial de produtos para saúde na ANVISA.",
  },
};
