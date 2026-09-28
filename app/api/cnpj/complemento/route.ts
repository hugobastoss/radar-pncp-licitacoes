import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { descreverFalha } from "@/lib/server/erros";
import { buscarComplementoCnpj, LimiteCnpjaError } from "@/lib/server/cnpja-client";

/**
 * Complemento do cadastro pela CNPJá: inscrição SUFRAMA e e-mail
 * corporativo (ver lib/server/cnpja-client.ts). Separado de /api/cnpj de
 * propósito: essa fonte tem limite apertado, e uma falha aqui não pode
 * derrubar a consulta principal.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const validacao = validarCnpj(request.nextUrl.searchParams.get("cnpj") ?? "");
  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  try {
    const complemento = await buscarComplementoCnpj(validacao.cnpj, request.signal);
    if (!complemento) return NextResponse.json({ erro: "CNPJ não encontrado na CNPJá." }, { status: 404 });
    return NextResponse.json({ complemento });
  } catch (erro) {
    const detalhe = descreverFalha(erro);
    console.error(`[cnpj/complemento] ${detalhe}`);
    if (erro instanceof LimiteCnpjaError) {
      return NextResponse.json(
        { erro: "Limite de consultas da fonte atingido — tente de novo em um minuto.", detalhe },
        { status: 429 },
      );
    }
    return NextResponse.json({ erro: "Não foi possível consultar a SUFRAMA neste momento.", detalhe }, { status: 502 });
  }
}
