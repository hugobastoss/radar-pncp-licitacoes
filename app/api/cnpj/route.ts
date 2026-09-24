import { NextRequest, NextResponse } from "next/server";
import { buscarEmpresaPorCnpj, CnpjNaoEncontradoError } from "@/lib/server/cnpj-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cnpjParam = request.nextUrl.searchParams.get("cnpj") ?? "";
  const cnpjDigitos = cnpjParam.replace(/\D/g, "");

  if (cnpjDigitos.length !== 14) {
    return NextResponse.json({ erro: "CNPJ inválido. Informe os 14 dígitos." }, { status: 400 });
  }

  try {
    const empresa = await buscarEmpresaPorCnpj(cnpjDigitos, request.signal);
    return NextResponse.json({ empresa });
  } catch (erro) {
    if (erro instanceof CnpjNaoEncontradoError) {
      return NextResponse.json({ erro: "CNPJ não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ erro: "Não foi possível consultar o CNPJ neste momento." }, { status: 502 });
  }
}
