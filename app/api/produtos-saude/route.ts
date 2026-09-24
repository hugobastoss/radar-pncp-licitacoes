import { NextRequest, NextResponse } from "next/server";
import { buscarProdutosSaude } from "@/lib/server/anvisa-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const termo = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (!termo) {
    return NextResponse.json({ erro: "Informe o nome do produto." }, { status: 400 });
  }

  const clientId = process.env.ANVISA_CLIENT_ID;
  const clientSecret = process.env.ANVISA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { erro: "Consulta de produtos para saúde ainda não configurada nesta instância." },
      { status: 501 },
    );
  }

  try {
    const resultado = await buscarProdutosSaude(termo, { clientId, clientSecret }, request.signal);
    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json({ erro: "Não foi possível consultar a ANVISA neste momento." }, { status: 502 });
  }
}
