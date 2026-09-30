import type { RegistroListaSuja } from "@/types/fontes-publicas";

/**
 * Leitor do CSV do Cadastro de Empregadores do MTE (a "lista suja"). Sem
 * nada do Next aqui: recebe o texto já convertido de Latin-1 e devolve os
 * registros. Quem baixa e guarda é lib/server/lista-suja-client.ts.
 */

/** A página do MTE que publica a lista — o link de "fonte" das telas. */
export const URL_PAGINA_LISTA_SUJA =
  "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/areas-de-atuacao/combate-ao-trabalho-escravo-e-analogo-ao-de-escravo";

/** Separa uma linha em campos por `;`, respeitando aspas (um endereço pode ter `;` dentro). */
function separarCampos(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (entreAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else entreAspas = !entreAspas;
    } else if (c === ";" && !entreAspas) {
      campos.push(atual);
      atual = "";
    } else atual += c;
  }
  campos.push(atual);
  return campos.map((campo) => campo.trim());
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function numero(texto: string | undefined): number | undefined {
  const n = Number((texto ?? "").replace(/\D/g, ""));
  return texto && Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Lança erro quando o arquivo não tem a coluna "CNPJ/CPF": um HTML de erro
 * ou um formato novo não pode virar "ninguém está na lista".
 */
export function lerListaSuja(csv: string): RegistroListaSuja[] {
  const linhas = csv.replace(/^﻿/, "").split(/\r?\n/).filter((linha) => linha.trim() !== "");
  const cabecalho = separarCampos(linhas[0] ?? "").map(semAcento);
  const coluna = (trecho: string) => cabecalho.findIndex((nome) => nome.includes(trecho));

  const iDocumento = coluna("cnpj/cpf");
  if (iDocumento < 0) throw new Error('Lista suja: o arquivo não tem a coluna "CNPJ/CPF"');
  const iAno = coluna("ano");
  const iUf = cabecalho.indexOf("uf");
  const iEmpregador = coluna("empregador");
  const iEstabelecimento = coluna("estabelecimento");
  const iTrabalhadores = coluna("trabalhadores");
  const iCnae = coluna("cnae");
  const iDecisao = coluna("decisao");
  const iInclusao = coluna("inclusao");

  return linhas.slice(1).map((linha) => {
    const campos = separarCampos(linha);
    const texto = (i: number) => (i >= 0 && campos[i] ? campos[i] : undefined);
    const registro: RegistroListaSuja = {
      anoAcaoFiscal: numero(texto(iAno)),
      uf: texto(iUf),
      empregador: texto(iEmpregador) ?? "",
      documento: (campos[iDocumento] ?? "").replace(/\D/g, ""),
      estabelecimento: texto(iEstabelecimento),
      trabalhadores: numero(texto(iTrabalhadores)),
      cnae: texto(iCnae),
      decisaoEm: texto(iDecisao),
      inclusaoEm: texto(iInclusao),
    };
    // Sem chaves `undefined`: o registro viaja em JSON e é comparado nos testes.
    return JSON.parse(JSON.stringify(registro)) as RegistroListaSuja;
  });
}

/** Índice por documento só com dígitos. Fica de fora o que não for CPF (11) ou CNPJ (14) completo. */
export function indexarListaSuja(registros: RegistroListaSuja[]): Map<string, RegistroListaSuja[]> {
  const indice = new Map<string, RegistroListaSuja[]>();
  for (const registro of registros) {
    if (registro.documento.length !== 11 && registro.documento.length !== 14) continue;
    indice.set(registro.documento, [...(indice.get(registro.documento) ?? []), registro]);
  }
  return indice;
}
