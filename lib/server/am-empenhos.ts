import { buscarContratosDoFornecedor, buscarEmpenhosDoContrato } from "@/lib/server/am-sgc-client";
import type { EmpenhoDoContrato } from "@/lib/server/am-sgc-client";
import { buscarNotasDaUg, linkDaNota } from "@/lib/server/am-sefaz-despesa-client";
import type { ValoresNota } from "@/lib/server/am-sefaz-despesa-client";
import { emParalelo } from "@/lib/server/paralelo";
import type {
  ContratoComEmpenhos,
  NotaEmpenhoContrato,
  ResultadoEmpenhosAm,
  TotaisEmpenhos,
} from "@/types/am";

/**
 * Empenhos a receber de um fornecedor com o Governo do Amazonas, juntando
 * as duas fontes:
 * - o SGC diz QUAIS notas de empenho pertencem a cada contrato;
 * - o portal da SEFAZ diz QUANTO de cada nota foi empenhado, liquidado e
 *   pago — já com reforços e anulações, que o SGC não soma.
 *
 * Regra do "a receber" (ver docs/SEFAZ-AM-TRANSPARENCIA.md):
 * - nota do ano: empenhado − pago (e liquidado − pago é o que já foi
 *   atestado e só falta pagar);
 * - nota de ano anterior (resto a pagar): o saldo "A Pagar Exercício
 *   Anterior" da lista do ano atual.
 */

const PARALELO = 6;

const ZERO: TotaisEmpenhos = {
  empenhado: 0,
  liquidado: 0,
  pago: 0,
  aReceber: 0,
  liquidadoAPagar: 0,
  restosAPagar: 0,
  pagoRestosAPagar: 0,
};

/** Soma de valores com centavos em ponto flutuante gera ruído (0,1 + 0,2 = 0,30000000000000004). */
function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function somar(a: TotaisEmpenhos, b: TotaisEmpenhos): TotaisEmpenhos {
  return {
    empenhado: centavos(a.empenhado + b.empenhado),
    liquidado: centavos(a.liquidado + b.liquidado),
    pago: centavos(a.pago + b.pago),
    aReceber: centavos(a.aReceber + b.aReceber),
    liquidadoAPagar: centavos(a.liquidadoAPagar + b.liquidadoAPagar),
    restosAPagar: centavos(a.restosAPagar + b.restosAPagar),
    pagoRestosAPagar: centavos(a.pagoRestosAPagar + b.pagoRestosAPagar),
  };
}

function anoAtualBrasilia(): number {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCFullYear();
}

function montarNota(
  empenho: EmpenhoDoContrato,
  notasDaUg: Map<string, ValoresNota> | undefined,
  anoExercicio: number,
): NotaEmpenhoContrato {
  const valores = notasDaUg?.get(empenho.numero);
  const doAno = Number(empenho.ano) === anoExercicio;
  const base = {
    numero: empenho.numero,
    ano: empenho.ano,
    ug: empenho.ug,
    valorNoContrato: empenho.valor,
    dataEmissao: empenho.dataEmissao,
    link: linkDaNota(empenho.ug, empenho.numero, anoExercicio),
  };

  if (!notasDaUg) return { ...base, situacao: "indisponivel" };
  if (!valores) return { ...base, situacao: doAno ? "nao_encontrada" : "sem_saldo" };

  return {
    ...base,
    situacao: "encontrada",
    valores: doAno
      ? {
          ...ZERO,
          empenhado: valores.empenhado,
          liquidado: valores.liquidado,
          pago: valores.pago,
          aReceber: centavos(Math.max(0, valores.empenhado - valores.pago)),
          liquidadoAPagar: centavos(Math.max(0, valores.liquidado - valores.pago)),
        }
      : {
          // Resto a pagar: a SEFAZ zera empenhado/liquidado/pago e informa só o pago no ano e o saldo.
          ...ZERO,
          aReceber: valores.aPagarExercicioAnterior,
          restosAPagar: valores.aPagarExercicioAnterior,
          pagoRestosAPagar: valores.pagoExercicioAnterior,
        },
  };
}

/**
 * O SGC às vezes lista a mesma nota mais de uma vez no contrato (ex.: CT
 * 15/2026 da FESP, com a 2026NE0000071 duas vezes). Os valores da SEFAZ são
 * por nota, então cada uma entra uma vez; o valor no contrato é a soma.
 */
function unirRepetidas(empenhos: EmpenhoDoContrato[]): EmpenhoDoContrato[] {
  const porNota = new Map<string, EmpenhoDoContrato>();
  for (const e of empenhos) {
    const chave = `${e.ug}:${e.numero}`;
    const atual = porNota.get(chave);
    porNota.set(chave, atual ? { ...atual, valor: centavos(atual.valor + e.valor) } : e);
  }
  return [...porNota.values()];
}

function totalizar(notas: NotaEmpenhoContrato[]): TotaisEmpenhos {
  return notas.reduce((soma, n) => (n.valores ? somar(soma, n.valores) : soma), ZERO);
}

export async function buscarEmpenhosAReceber(cnpj: string): Promise<ResultadoEmpenhosAm> {
  const anoExercicio = anoAtualBrasilia();
  const { contratos, completo: contratosCompletos } = await buscarContratosDoFornecedor(cnpj);
  let completo = contratosCompletos;

  const empenhosPorContrato = await emParalelo(contratos, PARALELO, (c) =>
    buscarEmpenhosDoContrato(c).catch(() => {
      completo = false;
      return [] as EmpenhoDoContrato[];
    }),
  );

  // Uma página da SEFAZ por UG traz todas as notas dela no ano — inclusive
  // os restos a pagar de anos anteriores.
  const ugs = [...new Set(empenhosPorContrato.flat().map((e) => e.ug))];
  const notasPorUg = new Map<string, Map<string, ValoresNota> | undefined>();
  await emParalelo(ugs, PARALELO, async (ug) => {
    notasPorUg.set(
      ug,
      await buscarNotasDaUg(ug, anoExercicio).catch(() => {
        completo = false;
        return undefined;
      }),
    );
  });

  const comEmpenhos: ContratoComEmpenhos[] = contratos.map((contrato, i) => {
    const notas = unirRepetidas(empenhosPorContrato[i])
      .map((e) => montarNota(e, notasPorUg.get(e.ug), anoExercicio))
      .sort((a, b) => b.numero.localeCompare(a.numero));
    return { ...contrato, notas, totais: totalizar(notas) };
  });

  // Uma nota pode (raramente) aparecer em mais de um contrato — no total geral, cada uma conta uma vez.
  const notasUnicas = new Map<string, NotaEmpenhoContrato>();
  for (const c of comEmpenhos) for (const n of c.notas) notasUnicas.set(`${n.ug}:${n.numero}`, n);

  // Contratos com saldo a receber primeiro; depois vigentes; depois os mais recentes.
  comEmpenhos.sort(
    (a, b) =>
      Number(b.totais.aReceber > 0) - Number(a.totais.aReceber > 0) ||
      b.totais.aReceber - a.totais.aReceber ||
      Number(b.vigente) - Number(a.vigente),
  );

  return {
    contratos: comEmpenhos,
    totais: totalizar([...notasUnicas.values()]),
    anoExercicio,
    completo,
  };
}
