import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { descreverFalha } from "@/lib/server/erros";
import { buscarNaListaSuja } from "@/lib/server/lista-suja-client";

/**
 * Registros de um CNPJ na "lista suja" do trabalho escravo (ver
 * lib/server/lista-suja-client.ts). Só CNPJ aqui: o CPF é conferido dentro
 * de /api/cpf, que recebe o documento no corpo do POST e não na URL.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const validacao = validarCnpj(request.nextUrl.searchParams.get("cnpj") ?? "");
  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  try {
    return NextResponse.json({ registros: await buscarNaListaSuja(validacao.cnpj) });
  } catch (erro) {
    const detalhe = descreverFalha(erro);
    console.error(`[lista-suja] ${detalhe}`);
    return NextResponse.json({ erro: "Não foi possível consultar a lista suja neste momento.", detalhe }, { status: 502 });
  }
}
