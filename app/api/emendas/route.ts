import { NextRequest, NextResponse } from "next/server";
import { FORMATO_CODIGO_EMENDA, PRIMEIRO_ANO_EMENDAS, TIPOS_EMENDA } from "@/lib/emendas";
import { descreverFalha } from "@/lib/server/erros";
import { buscarEmendas } from "@/lib/server/transparencia-client";

/**
 * Emendas parlamentares no Portal da Transparência (CGU), com filtro por
 * autor, ano, tipo, número ou código. Mesma chave das sanções
 * (PORTAL_TRANSPARENCIA_API_KEY) — sem ela, 501.
 */
export const dynamic = "force-dynamic";

const MAXIMO_PAGINA = 1000;

export async function GET(request: NextRequest) {
  const busca = request.nextUrl.searchParams;
  const texto = (nome: string) => busca.get(nome)?.trim() || undefined;

  const codigo = texto("codigo");
  const ano = texto("ano");
  const autor = texto("autor");
  const numero = texto("numero");
  const tipo = texto("tipo");
  const pagina = Number(texto("pagina") ?? "1");
  const anoAtual = new Date().getUTCFullYear();

  const erro =
    (codigo && !FORMATO_CODIGO_EMENDA.test(codigo) && "Código da emenda inválido: são 12 dígitos.") ||
    (ano &&
      !(/^\d{4}$/.test(ano) && Number(ano) >= PRIMEIRO_ANO_EMENDAS && Number(ano) <= anoAtual + 1) &&
      `Ano inválido: o Portal tem emendas de ${PRIMEIRO_ANO_EMENDAS} em diante.`) ||
    (autor && autor.length > 100 && "Nome do autor longo demais.") ||
    (numero && !/^\d{1,4}$/.test(numero) && "Número da emenda inválido: até 4 dígitos.") ||
    (tipo && !TIPOS_EMENDA.some((t) => t.valor === tipo) && "Tipo de emenda desconhecido.") ||
    (!(Number.isInteger(pagina) && pagina >= 1 && pagina <= MAXIMO_PAGINA) && "Página inválida.");
  if (erro) return NextResponse.json({ erro }, { status: 400 });

  const chave = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!chave) {
    return NextResponse.json({ erro: "Consulta de emendas ainda não configurada nesta instância." }, { status: 501 });
  }

  try {
    const resultado = await buscarEmendas(
      { codigo, ano: ano ? Number(ano) : undefined, autor, numero, tipo, pagina },
      chave,
      request.signal,
    );
    return NextResponse.json(resultado);
  } catch (falha) {
    const detalhe = descreverFalha(falha);
    console.error(`[emendas] ${detalhe}`);
    return NextResponse.json({ erro: "Não foi possível consultar as emendas neste momento.", detalhe }, { status: 502 });
  }
}
