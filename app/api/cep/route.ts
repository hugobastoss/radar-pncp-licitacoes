import { NextRequest, NextResponse } from "next/server";
import { buscarEnderecoPorCep, CepNaoEncontradoError } from "@/lib/server/cep-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cepParam = request.nextUrl.searchParams.get("cep") ?? "";
  const cepDigitos = cepParam.replace(/\D/g, "");

  if (cepDigitos.length !== 8) {
    return NextResponse.json({ erro: "CEP inválido. Informe os 8 dígitos." }, { status: 400 });
  }

  try {
    const endereco = await buscarEnderecoPorCep(cepDigitos, request.signal);
    return NextResponse.json({ endereco });
  } catch (erro) {
    if (erro instanceof CepNaoEncontradoError) {
      return NextResponse.json({ erro: "CEP não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ erro: "Não foi possível consultar o CEP neste momento." }, { status: 502 });
  }
}
