import { indexarListaSuja, lerListaSuja } from "@/lib/lista-suja";
import type { RegistroListaSuja } from "@/types/fontes-publicas";

/**
 * Cadastro de Empregadores que submeteram trabalhadores a condições análogas
 * à de escravo (a "lista suja"), do Ministério do Trabalho e Emprego.
 *
 * A fonte não tem consulta por documento: publica um CSV inteiro (~90 KB,
 * ~600 linhas, Latin-1), atualizado a cada semestre. Então baixamos o
 * arquivo, montamos um índice por CNPJ/CPF e consultamos na memória. O
 * índice vale 24 h; se a renovação falhar, a lista vencida continua valendo
 * — melhor que responder "fora da lista" sem ter conferido.
 */
const URL_CSV =
  "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/areas-de-atuacao/cadastro_de_empregadores.csv";
const TIMEOUT_MS = 15000;
const VALIDADE_MS = 24 * 60 * 60 * 1000;

type Indice = Map<string, RegistroListaSuja[]>;

let cache: { indice: Indice; expiraEm: number } | undefined;
let emAndamento: Promise<Indice> | undefined;

async function baixarIndice(): Promise<Indice> {
  const resposta = await fetch(URL_CSV, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "QBuscado/1.0" },
    next: { revalidate: VALIDADE_MS / 1000 },
  });
  if (!resposta.ok) throw new Error(`MTE (lista suja) respondeu ${resposta.status}`);
  const texto = new TextDecoder("windows-1252").decode(await resposta.arrayBuffer());
  return indexarListaSuja(lerListaSuja(texto));
}

/** Registros do CNPJ (14 dígitos) ou CPF (11) na lista. Vazio quando não está nela. */
export async function buscarNaListaSuja(documento: string): Promise<RegistroListaSuja[]> {
  if (!cache || cache.expiraEm < Date.now()) {
    emAndamento ??= baixarIndice()
      .then((indice) => {
        cache = { indice, expiraEm: Date.now() + VALIDADE_MS };
        return indice;
      })
      .finally(() => {
        emAndamento = undefined;
      });
    try {
      await emAndamento;
    } catch (erro) {
      if (!cache) throw erro;
    }
  }
  return cache!.indice.get(documento.replace(/\D/g, "")) ?? [];
}
