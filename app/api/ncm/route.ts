import { NextRequest, NextResponse } from "next/server";
import { buscarNcm } from "@/lib/server/ncm-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const termo = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (!termo) {
    return NextResponse.json({ erro: "Informe um código ou palavra-chave." }, { status: 400 });
  }

  try {
    const itens = await buscarNcm(termo, request.signal);
    return NextResponse.json({ itens });
  } catch {
    return NextResponse.json({ erro: "Não foi possível consultar o NCM neste momento." }, { status: 502 });
  }
}
