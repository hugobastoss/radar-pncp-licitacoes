/**
 * Lê a lista de notas de empenho de uma unidade gestora no Portal da
 * Transparência Fiscal da SEFAZ-AM — é de onde sai quanto de cada nota já
 * foi liquidado e pago. Não é uma API: são páginas HTML (Struts), lidas por
 * scraping. Levantamento completo em docs/SEFAZ-AM-TRANSPARENCIA.md.
 *
 * O que importa aqui:
 * - Uma página traz TODAS as notas da UG no ano, sem paginação (1 a 5 MB —
 *   a SEDUC passa de 7 mil notas). Fica em memória por 1 h.
 * - Notas do ano preenchem Empenhado/Liquidado/Pago; notas de anos
 *   anteriores (restos a pagar) só preenchem Pago/A Pagar Exercício Anterior.
 * - Reforços de empenho são somados na nota original — por isso uma nota
 *   que o SGC lista à parte pode não existir aqui.
 * - Encoding ISO-8859-1; o formato dos números depende do idioma pedido
 *   (ver `numero`); parâmetro faltando devolve 200 com a página cortada no
 *   meio (conferimos o `</form>` do fim).
 */

const BASE_URL = "https://sistemas.sefaz.am.gov.br/transpprd/mnt/despesa";
const TIMEOUT_MS = 30000;
const VALIDADE_CACHE_MS = 60 * 60 * 1000;

export interface ValoresNota {
  empenhado: number;
  liquidado: number;
  pago: number;
  pagoExercicioAnterior: number;
  aPagarExercicioAnterior: number;
}

const cache = new Map<string, { notas: Map<string, ValoresNota>; expiraEm: number }>();
const emAndamento = new Map<string, Promise<Map<string, ValoresNota>>>();

/**
 * O servidor formata os números pelo idioma da requisição: "123.600,00" com
 * `Accept-Language: pt-BR`, mas "123,600.00" com o `*` que o fetch do Node
 * manda por padrão. Mandamos pt-BR e, por garantia, o último separador é
 * sempre o decimal.
 */
function numero(texto: string): number {
  const limpo = texto.trim();
  const decimal = Math.max(limpo.lastIndexOf(","), limpo.lastIndexOf("."));
  const normalizado =
    decimal >= 0
      ? `${limpo.slice(0, decimal).replace(/[.,]/g, "")}.${limpo.slice(decimal + 1)}`
      : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

/** Página pública da nota no portal (o `mes=00` é obrigatório — sem ele a página vem cortada). */
export function linkDaNota(ug: string, numeroNota: string, anoExercicio: number): string {
  const params = new URLSearchParams({
    method: "Pesquisar",
    nune: numeroNota,
    counidadegestora: ug,
    copoder: "0",
    anoexercicio: String(anoExercicio),
    grupo: "1",
    consulta: "1",
    mes: "00",
    filter: "",
  });
  return `${BASE_URL}/execDespAnoPoderUgCredorNe.do?${params}`;
}

async function baixarNotas(ug: string, anoExercicio: number): Promise<Map<string, ValoresNota>> {
  // `copoder=0` (Executivo) serve pra todas: o SGC só tem UGs do Executivo.
  const params = new URLSearchParams({
    method: "Pesquisar",
    counidadegestora: ug,
    copoder: "0",
    anoexercicio: String(anoExercicio),
    grupo: "1",
    consulta: "1",
    mes: "00",
    filter: "",
    detNatureza: "N",
  });
  const resposta = await fetch(`${BASE_URL}/execDespAnoPoderUg.do?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RadarLicitacoes/1.0)", "Accept-Language": "pt-BR" },
  });
  if (!resposta.ok) throw new Error(`SEFAZ-AM (notas da UG ${ug}) respondeu ${resposta.status}`);

  const html = new TextDecoder("latin1").decode(await resposta.arrayBuffer());
  if (!html.includes("</form>")) throw new Error(`SEFAZ-AM (notas da UG ${ug}): página incompleta`);

  const corpo = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const notas = new Map<string, ValoresNota>();
  for (const linha of corpo.split("</tr>")) {
    const numeroNota = /'(\d{4}NE\d+)'/.exec(linha)?.[1];
    if (!numeroNota) continue;
    const celulas = [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
    // Colunas: nota, credor, empenhado, liquidado, pago, pago exerc. anterior, a pagar exerc. anterior.
    if (celulas.length < 7) continue;
    notas.set(numeroNota, {
      empenhado: numero(celulas[2]),
      liquidado: numero(celulas[3]),
      pago: numero(celulas[4]),
      pagoExercicioAnterior: numero(celulas[5]),
      aPagarExercicioAnterior: numero(celulas[6]),
    });
  }
  return notas;
}

/** Todas as notas da UG no exercício, por número ("2026NE0001718"). */
export async function buscarNotasDaUg(ug: string, anoExercicio: number): Promise<Map<string, ValoresNota>> {
  const chave = `${ug}:${anoExercicio}`;
  const guardado = cache.get(chave);
  if (guardado && guardado.expiraEm > Date.now()) return guardado.notas;

  const pendente = emAndamento.get(chave);
  if (pendente) return pendente;

  const promessa = baixarNotas(ug, anoExercicio)
    .then((notas) => {
      cache.set(chave, { notas, expiraEm: Date.now() + VALIDADE_CACHE_MS });
      return notas;
    })
    .finally(() => emAndamento.delete(chave));
  emAndamento.set(chave, promessa);
  return promessa;
}
