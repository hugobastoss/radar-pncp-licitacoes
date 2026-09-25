import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { buscarEmpresaPorCnpj, CnpjInvalidoError, CnpjNaoEncontradoError } from "@/lib/server/cnpj-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const validacao = validarCnpj(request.nextUrl.searchParams.get("cnpj") ?? "");

  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  try {
    const empresa = await buscarEmpresaPorCnpj(validacao.cnpj, request.signal);
    return NextResponse.json({ empresa });
  } catch (erro) {
    if (erro instanceof CnpjNaoEncontradoError) {
      return NextResponse.json({ erro: "CNPJ não encontrado." }, { status: 404 });
    }
    if (erro instanceof CnpjInvalidoError) {
      return NextResponse.json({ erro: "CNPJ inválido. Confira o número digitado." }, { status: 400 });
    }
    return NextResponse.json({ erro: "Não foi possível consultar o CNPJ neste momento." }, { status: 502 });
  }
}
