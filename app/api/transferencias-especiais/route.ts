import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { descreverFalha } from "@/lib/server/erros";
import { buscarTransferenciasEspeciais } from "@/lib/server/transferegov-client";

/**
 * Transferências especiais ("emendas PIX") recebidas por um CNPJ, pelo
 * TransfereGov (ver lib/server/transferegov-client.ts). Quem não recebeu
 * nenhuma responde `{ total: 0, itens: [] }`.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const validacao = validarCnpj(request.nextUrl.searchParams.get("cnpj") ?? "");
  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  try {
    return NextResponse.json(await buscarTransferenciasEspeciais(validacao.cnpj, request.signal));
  } catch (erro) {
    const detalhe = descreverFalha(erro);
    console.error(`[transferencias-especiais] ${detalhe}`);
    return NextResponse.json(
      { erro: "Não foi possível consultar as transferências especiais neste momento.", detalhe },
      { status: 502 },
    );
  }
}
