import { NextRequest, NextResponse } from "next/server";
import { buscarArquivosLicitacao } from "@/lib/server/pncp-documentos-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const cnpj = params.get("cnpj") ?? "";
  const ano = params.get("ano") ?? "";
  const sequencial = params.get("sequencial") ?? "";

  if (!cnpj || !ano || !sequencial) {
    return NextResponse.json({ erro: "Parâmetros cnpj, ano e sequencial são obrigatórios." }, { status: 400 });
  }

  try {
    const documentos = await buscarArquivosLicitacao(cnpj, ano, sequencial, request.signal);
    return NextResponse.json({ documentos });
  } catch {
    return NextResponse.json({ erro: "Não foi possível consultar os documentos no PNCP." }, { status: 502 });
  }
}
