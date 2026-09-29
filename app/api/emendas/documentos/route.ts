import { NextRequest, NextResponse } from "next/server";
import { FORMATO_CODIGO_EMENDA } from "@/lib/emendas";
import { descreverFalha } from "@/lib/server/erros";
import { buscarDocumentosEmenda } from "@/lib/server/transparencia-client";

/**
 * Empenhos, liquidações e pagamentos de uma emenda parlamentar, com valor e
 * favorecido de cada um e a soma do que cada favorecido recebeu (ver
 * buscarDocumentosEmenda). Mesma chave das sanções — sem ela, 501.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const codigo = request.nextUrl.searchParams.get("codigo")?.trim() ?? "";
  if (!FORMATO_CODIGO_EMENDA.test(codigo)) {
    return NextResponse.json({ erro: "Código da emenda inválido: são 12 dígitos." }, { status: 400 });
  }

  const chave = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!chave) {
    return NextResponse.json({ erro: "Consulta de emendas ainda não configurada nesta instância." }, { status: 501 });
  }

  try {
    const documentos = await buscarDocumentosEmenda(codigo, chave, request.signal);
    return NextResponse.json(documentos);
  } catch (falha) {
    const detalhe = descreverFalha(falha);
    console.error(`[emendas/documentos] ${detalhe}`);
    return NextResponse.json(
      { erro: "Não foi possível consultar os documentos da emenda neste momento.", detalhe },
      { status: 502 },
    );
  }
}
