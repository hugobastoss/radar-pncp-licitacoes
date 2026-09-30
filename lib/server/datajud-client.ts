import type { MovimentoProcesso, ProcessoJudicial } from "@/types/processo-judicial";

/**
 * API pública do DataJud (CNJ) — metadados processuais de todos os
 * tribunais brasileiros, a partir da Base Nacional de Dados do Poder
 * Judiciário (Resolução CNJ 331/2020). Um índice Elasticsearch por
 * tribunal, em `api_publica_{alias}` (ver lib/data/tribunais.ts pros
 * aliases — 91 tribunais, todos exceto o STF, que não integra o DataJud).
 *
 * Não existe busca por nome de parte, CPF/CNPJ ou advogado — só por
 * `numeroProcesso` e outros metadados (classe, assunto, órgão julgador,
 * datas), que é o que a API expõe. Processos judiciais são públicos por lei
 * (princípio da publicidade processual), exceto sob segredo de justiça — daí
 * o campo `nivelSigilo` (0 = público).
 *
 * Testado em 2026-09-30, contra TJAM e TJSP:
 * - Autenticação por uma "chave pública" — não é secreta, é a mesma pra
 *   qualquer consumidor da API, divulgada pelo próprio CNJ na Wiki do
 *   DataJud (datajud-wiki.cnj.jus.br/api-publica/acesso) e trocada por eles
 *   de tempos em tempos. Se parar de autenticar, é isso.
 * - `query: {match: {numeroProcesso}}` devolve exatamente 1 resultado pro
 *   número exato (`hits.total: {value: 1, relation: "eq"}`) — não tokeniza
 *   o número em pedaços soltos. Processo inexistente volta 200 com
 *   `hits.total.value: 0`, não 404.
 * - Latência bem variável e independente da chave: de ~3 s a mais de 30 s
 *   pra mesma consulta, sem relação óbvia com o tamanho do índice.
 * - `dataAjuizamento` vem como "AAAAMMDDHHmmss" (sem separadores);
 *   `dataHoraUltimaAtualizacao` já vem ISO 8601 normal.
 */

const BASE_URL = "https://api-publica.datajud.cnj.jus.br";
// Chave pública do CNJ — ver datajud-wiki.cnj.jus.br/api-publica/acesso se parar de funcionar.
const CHAVE_PUBLICA = "APIKey cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const TIMEOUT_MS = 35000;

interface ComplementoBruto {
  nome?: string;
}

interface MovimentoBruto {
  codigo: number;
  nome?: string;
  dataHora: string;
  complementosTabelados?: ComplementoBruto[];
}

interface ProcessoBruto {
  numeroProcesso: string;
  tribunal: string;
  grau?: string;
  nivelSigilo?: number;
  classe?: { nome?: string };
  assuntos?: { nome?: string }[];
  orgaoJulgador?: { nome?: string };
  sistema?: { nome?: string };
  dataAjuizamento?: string;
  dataHoraUltimaAtualizacao?: string;
  movimentos?: MovimentoBruto[];
}

interface RespostaBusca {
  hits?: { hits?: { _source?: ProcessoBruto }[] };
}

/** "20260604135118" → "2026-06-04T13:51:18Z". Já vindo em ISO (tem "-"), devolve como está. */
function converterDataAjuizamento(bruta: string | undefined): string | undefined {
  if (!bruta) return undefined;
  if (bruta.includes("-")) return bruta;
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(bruta);
  if (!m) return undefined;
  const [, ano, mes, dia, hora, min, seg] = m;
  return `${ano}-${mes}-${dia}T${hora}:${min}:${seg}Z`;
}

function mapearMovimento(bruto: MovimentoBruto): MovimentoProcesso {
  return {
    codigo: bruto.codigo,
    nome: bruto.nome,
    dataHora: bruto.dataHora,
    complemento: bruto.complementosTabelados?.map((c) => c.nome).filter(Boolean).join(", ") || undefined,
  };
}

function mapearProcesso(bruto: ProcessoBruto): ProcessoJudicial {
  const movimentos = (bruto.movimentos ?? [])
    .map(mapearMovimento)
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

  return {
    numeroProcesso: bruto.numeroProcesso,
    tribunal: bruto.tribunal,
    grau: bruto.grau,
    classe: bruto.classe?.nome,
    assuntos: (bruto.assuntos ?? []).map((a) => a.nome).filter((n): n is string => !!n),
    orgaoJulgador: bruto.orgaoJulgador?.nome,
    sistema: bruto.sistema?.nome,
    nivelSigilo: bruto.nivelSigilo ?? 0,
    dataAjuizamento: converterDataAjuizamento(bruto.dataAjuizamento),
    dataUltimaAtualizacao: bruto.dataHoraUltimaAtualizacao,
    movimentos,
  };
}

export async function buscarProcessoJudicial(
  aliasTribunal: string,
  numeroProcesso: string,
  signal?: AbortSignal,
): Promise<ProcessoJudicial | undefined> {
  const sinais = [AbortSignal.timeout(TIMEOUT_MS)];
  if (signal) sinais.push(signal);

  const resposta = await fetch(`${BASE_URL}/api_publica_${aliasTribunal}/_search`, {
    method: "POST",
    signal: AbortSignal.any(sinais),
    headers: { "Content-Type": "application/json", Authorization: CHAVE_PUBLICA },
    body: JSON.stringify({ size: 1, query: { match: { numeroProcesso } } }),
  });

  if (!resposta.ok) {
    throw new Error(`DataJud (${aliasTribunal}) respondeu ${resposta.status}`);
  }

  const corpo = (await resposta.json()) as RespostaBusca;
  const bruto = corpo.hits?.hits?.[0]?._source;
  return bruto ? mapearProcesso(bruto) : undefined;
}
