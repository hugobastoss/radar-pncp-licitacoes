import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { descreverFalha } from "@/lib/server/erros";
import { buscarEmpenhosAReceber } from "@/lib/server/am-empenhos";

/**
 * Empenhos a receber de um fornecedor com o Governo do Amazonas: contratos
 * (SGC) → notas de empenho de cada um → quanto de cada nota foi pago
 * (portal da SEFAZ-AM). Ver lib/server/am-empenhos.ts. Roda em São Paulo
 * (vercel.json).
 */
export const dynamic = "force-dynamic";

// Fornecedor grande: varredura de contratos + uma página da SEFAZ por UG (até 5 MB cada).
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const validacao = validarCnpj(request.nextUrl.searchParams.get("cnpj") ?? "");
  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  try {
    return NextResponse.json(await buscarEmpenhosAReceber(validacao.cnpj));
  } catch (erro) {
    const detalhe = descreverFalha(erro);
    console.error(`[am/empenhos] ${detalhe}`);
    return NextResponse.json(
      { erro: "Não foi possível consultar os empenhos do Governo do Amazonas neste momento.", detalhe },
      { status: 502 },
    );
  }
}
