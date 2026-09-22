import { MUNICIPIOS_POR_UF } from "@/lib/data/municipios";
import { MODALIDADES } from "@/lib/data/dominio";
import type { Licitacao } from "@/types/licitacao";

/**
 * Gerador de DADOS DE DEMONSTRAÇÃO.
 *
 * Nada aqui é uma licitação real. Os nomes de município e de alguns órgãos
 * genéricos (prefeituras, secretarias estaduais) usam nomenclatura pública
 * plausível apenas para que a interface pareça um sistema real durante o
 * desenvolvimento visual — números de licitação, CNPJs, datas e valores são
 * sintéticos. Quando o backend real for implementado, este arquivo inteiro
 * é substituído pela integração com a API do PNCP e deixa de ser importado.
 *
 * A geração é determinística (seed fixa) apenas para que a navegação entre
 * páginas e filtros pareça consistente durante uma mesma sessão de uso —
 * os dados são recriados em memória a cada início do servidor, nunca
 * persistidos em disco ou banco de dados.
 */

// --- PRNG determinística (mulberry32) -------------------------------------
function criarGeradorAleatorio(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = criarGeradorAleatorio(20260922);

function escolher<T>(lista: readonly T[]): T {
  return lista[Math.floor(rnd() * lista.length)];
}

function inteiroEntre(min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}

function talvez(probabilidade: number): boolean {
  return rnd() < probabilidade;
}

// --- Vocabulário para os objetos das licitações ---------------------------
const OBJETOS: { texto: string; palavrasChave: string[] }[] = [
  {
    texto:
      "Aquisição de medicamentos e materiais hospitalares destinados ao abastecimento da rede municipal de saúde, incluindo unidades básicas e pronto-atendimentos, pelo período de 12 (doze) meses.",
    palavrasChave: ["medicamentos", "hospitalar"],
  },
  {
    texto: "Registro de preços para futura e eventual aquisição de medicamentos da farmácia básica.",
    palavrasChave: ["medicamentos"],
  },
  {
    texto:
      "Contratação de empresa especializada no fornecimento de materiais e insumos hospitalares (curativos, seringas, luvas e correlatos) para atendimento das unidades de saúde do município.",
    palavrasChave: ["hospitalar", "material hospitalar"],
  },
  {
    texto: "Aquisição de materiais e equipamentos odontológicos para as Unidades Básicas de Saúde.",
    palavrasChave: ["odontológico", "odontologico"],
  },
  {
    texto:
      "Registro de preços para aquisição de materiais odontológicos de consumo (resinas, anestésicos e instrumental) destinados à rede de atenção primária.",
    palavrasChave: ["odontológico", "odontologico"],
  },
  {
    texto: "Aquisição de reagentes e materiais de consumo laboratorial para o laboratório municipal de análises clínicas.",
    palavrasChave: ["laboratório", "laboratorio", "reagentes"],
  },
  {
    texto:
      "Contratação de serviços de manutenção preventiva e corretiva em equipamentos laboratoriais, com fornecimento de peças e reagentes.",
    palavrasChave: ["laboratório", "laboratorio"],
  },
  {
    texto: "Aquisição de gêneros alimentícios destinados à merenda escolar da rede municipal de ensino.",
    palavrasChave: ["alimentação", "merenda"],
  },
  {
    texto: "Contratação de empresa para prestação de serviços de limpeza, conservação e higienização predial.",
    palavrasChave: ["limpeza", "conservação"],
  },
  {
    texto:
      "Aquisição de equipamentos de informática (computadores, monitores e nobreaks) para modernização do parque tecnológico da administração.",
    palavrasChave: ["informática", "informatica", "equipamentos"],
  },
  {
    texto: "Contratação de serviços de engenharia para pavimentação asfáltica de vias urbanas.",
    palavrasChave: ["obras", "pavimentação", "engenharia"],
  },
  {
    texto: "Aquisição de combustíveis (gasolina, diesel e etanol) para abastecimento da frota municipal.",
    palavrasChave: ["combustível", "combustivel", "frota"],
  },
  {
    texto: "Contratação de serviços de transporte escolar para atendimento de estudantes da zona rural.",
    palavrasChave: ["transporte", "escolar"],
  },
  {
    texto: "Aquisição de material de expediente e suprimentos de escritório para os órgãos da administração direta.",
    palavrasChave: ["expediente", "escritório", "escritorio"],
  },
  {
    texto: "Contratação de empresa especializada em vigilância patrimonial armada e desarmada.",
    palavrasChave: ["vigilância", "vigilancia", "segurança"],
  },
  {
    texto:
      "Registro de preços para eventual aquisição de fraldas geriátricas e infantis, complementos alimentares e materiais de higiene destinados aos programas assistenciais.",
    palavrasChave: ["hospitalar", "saúde"],
  },
  {
    texto: "Aquisição de equipamentos médico-hospitalares (camas hospitalares, monitores multiparâmetros e desfibriladores) para o hospital regional.",
    palavrasChave: ["hospitalar", "equipamentos"],
  },
  {
    texto: "Contratação de serviço médico veterinário e aquisição de insumos para o programa de castração de animais.",
    palavrasChave: ["veterinário", "veterinario"],
  },
  {
    texto: "Aquisição de kits de testes rápidos e imunobiológicos para a vigilância epidemiológica.",
    palavrasChave: ["laboratório", "saúde"],
  },
  {
    texto: "Contratação de empresa para fornecimento de oxigênio medicinal e gases hospitalares.",
    palavrasChave: ["hospitalar", "medicamentos"],
  },
];

const NOMES_FICTICIOS_UNIDADE = [
  "Fundo Municipal de Saúde",
  "Secretaria Municipal de Saúde",
  "Secretaria Municipal de Educação",
  "Secretaria Municipal de Administração",
  "Secretaria Municipal de Obras e Infraestrutura",
  "Fundo Municipal de Assistência Social",
];

const ORGAOS_ESTADUAIS_FEDERAIS: Record<string, string[]> = {
  AM: ["Secretaria de Estado de Saúde do Amazonas", "Universidade Federal do Amazonas", "Governo do Estado do Amazonas"],
  RR: ["Secretaria de Estado da Saúde de Roraima", "Universidade Federal de Roraima", "Governo do Estado de Roraima"],
  AC: ["Secretaria de Estado de Saúde do Acre", "Universidade Federal do Acre", "Governo do Estado do Acre"],
  PA: ["Secretaria de Estado de Saúde Pública do Pará", "Universidade Federal do Pará", "Governo do Estado do Pará"],
  RO: ["Secretaria de Estado da Saúde de Rondônia", "Universidade Federal de Rondônia", "Governo do Estado de Rondônia"],
};

const DOMINIOS_PORTAL = [
  "licitanet.com.br",
  "compras.gov.br",
  "portaldecompraspublicas.com.br",
  "bll.org.br",
  "comprasbr.com.br",
  // domínio propositalmente fora do registro conhecido, para testar o
  // fallback "Outro portal" em lib/portal.ts.
  "portalexemplo-municipal.com.br",
];

const UFS = ["AM", "RR", "AC", "PA", "RO"] as const;

function gerarCnpjFicticio(): string {
  const bloco = () => inteiroEntre(0, 999).toString().padStart(3, "0");
  const dv = () => inteiroEntre(10, 99);
  return `${bloco()}.${bloco()}.${bloco()}/0001-${dv()}`;
}

function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

function gerarItem(indice: number): Licitacao {
  const uf = escolher(UFS);
  const municipios = MUNICIPIOS_POR_UF[uf];
  const municipio = escolher(municipios);
  const modalidade = escolher(MODALIDADES);
  const objeto = escolher(OBJETOS);
  const dominioPortal = escolher(DOMINIOS_PORTAL);

  const usaOrgaoEstadualOuFederal = talvez(0.22);
  const orgao = usaOrgaoEstadualOuFederal
    ? escolher(ORGAOS_ESTADUAIS_FEDERAIS[uf])
    : `Prefeitura Municipal de ${municipio.nome}${talvez(0.35) ? ` — ${escolher(NOMES_FICTICIOS_UNIDADE)}` : ""}`;

  const hoje = new Date();
  const diasParaEncerrar = inteiroEntre(-5, 95);
  const dataEncerramento = new Date(hoje);
  dataEncerramento.setDate(dataEncerramento.getDate() + diasParaEncerrar);
  dataEncerramento.setHours(inteiroEntre(9, 18), escolher([0, 15, 30, 45]), 0, 0);

  const dataAbertura = new Date(dataEncerramento);
  dataAbertura.setDate(dataAbertura.getDate() - inteiroEntre(5, 25));

  const ano = dataAbertura.getFullYear();
  const sequencial = inteiroEntre(1, 999).toString().padStart(5, "0");
  const cnpj = gerarCnpjFicticio();
  const cnpjDigitos = apenasDigitos(cnpj);

  const situacao =
    diasParaEncerrar < 0
      ? escolher(["Encerrada", "Homologada", "Revogada"] as const)
      : escolher(["Recebendo propostas", "Recebendo propostas", "Recebendo propostas", "Em julgamento"] as const);

  // Casos-limite propositais: número ausente, valor ausente/sigiloso,
  // link ausente, objeto sem truncamento, CNPJ ausente — para validar os
  // estados de fallback definidos em lib/formatters.ts.
  const semNumero = talvez(0.06);
  const semValor = talvez(0.05);
  const valorSigiloso = !semValor && talvez(0.04);
  const semLink = talvez(0.05);
  const semCnpj = talvez(0.03);
  const semSituacao = talvez(0.03);

  const valorBase = modalidade.grupo === "dispensa" ? inteiroEntre(8000, 60000) : inteiroEntre(35000, 3500000);

  const item: Licitacao = {
    id: `demo-${indice}`,
    numeroLicitacao: semNumero ? undefined : `${sequencial}/${ano}`,
    numeroControlePNCP: `${cnpjDigitos}-1-${sequencial}/${ano}`,
    orgao,
    cnpjOrgao: semCnpj ? undefined : cnpj,
    objeto: objeto.texto,
    modalidade: modalidade.nome,
    modoDisputa: talvez(0.5) ? "Aberto" : "Aberto e fechado",
    municipio: municipio.nome,
    uf,
    codigoMunicipioIbge: municipio.codigoIbge,
    valorEstimado: semValor || valorSigiloso ? undefined : valorBase,
    valorSigiloso: valorSigiloso || undefined,
    dataAbertura: dataAbertura.toISOString(),
    dataEncerramento: dataEncerramento.toISOString(),
    situacao: semSituacao ? undefined : situacao,
    linkSistemaOrigem: semLink
      ? undefined
      : `https://${dominioPortal}/editais/${cnpjDigitos}/${ano}/${sequencial}`,
    linkPNCP: `https://pncp.gov.br/app/editais/${cnpjDigitos}/${ano}/${sequencial}`,
  };

  return item;
}

const TOTAL_ITENS_DEMO = 148;

let cache: Licitacao[] | null = null;

/** Retorna o conjunto completo de dados fictícios (gerado uma única vez por processo). */
export function obterLicitacoesDemo(): Licitacao[] {
  if (!cache) {
    cache = Array.from({ length: TOTAL_ITENS_DEMO }, (_, i) => gerarItem(i + 1));
  }
  return cache;
}

export { OBJETOS as PALAVRAS_CHAVE_DEMO };
