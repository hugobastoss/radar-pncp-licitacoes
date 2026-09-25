import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { buscarSancoes } from "@/lib/server/transparencia-client";

/**
 * Consulta CEIS/CNEP (empresas inidôneas/punidas) no Portal da
 * Transparência. Exige a variável de ambiente PORTAL_TRANSPARENCIA_API_KEY
 * — sem ela, devolve 501 em vez de tentar chamar a API sem chave.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const validacao = validarCnpj(request.nextUrl.searchParams.get("cnpj") ?? "");

  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  const chave = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!chave) {
    return NextResponse.json(
      { erro: "Consulta de sanções ainda não configurada nesta instância." },
      { status: 501 },
    );
  }

  try {
    const sancoes = await buscarSancoes(validacao.cnpj, chave, request.signal);
    return NextResponse.json(sancoes);
  } catch {
    return NextResponse.json({ erro: "Não foi possível consultar sanções neste momento." }, { status: 502 });
  }
}
