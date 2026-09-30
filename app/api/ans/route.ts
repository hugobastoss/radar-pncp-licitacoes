import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { buscarOperadoraAns } from "@/lib/server/ans-client";
import { descreverFalha } from "@/lib/server/erros";

/**
 * Operadora de plano de saúde registrada na ANS, pelo CNPJ (ver
 * lib/server/ans-client.ts). Não ser operadora é o caso normal, não um
 * erro: responde `{ operadora: null }`.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const validacao = validarCnpj(request.nextUrl.searchParams.get("cnpj") ?? "");
  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  try {
    return NextResponse.json({ operadora: (await buscarOperadoraAns(validacao.cnpj, request.signal)) ?? null });
  } catch (erro) {
    const detalhe = descreverFalha(erro);
    console.error(`[ans] ${detalhe}`);
    return NextResponse.json({ erro: "Não foi possível consultar a ANS neste momento.", detalhe }, { status: 502 });
  }
}
