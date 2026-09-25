import { NextRequest, NextResponse } from "next/server";
import { buscarNomesTecnicos, ErroConsultaAnvisa, lerCredenciaisAnvisa } from "@/lib/server/anvisa-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const termo = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (!termo) {
    return NextResponse.json({ erro: "Informe um nome técnico." }, { status: 400 });
  }

  const credenciais = lerCredenciaisAnvisa();
  if (!credenciais) {
    return NextResponse.json(
      { erro: "Consulta de nomenclatura técnica ainda não configurada nesta instância." },
      { status: 501 },
    );
  }

  try {
    const resultado = await buscarNomesTecnicos(termo, credenciais, request.signal);
    return NextResponse.json(resultado);
  } catch (erro) {
    const mensagem = erro instanceof ErroConsultaAnvisa ? erro.mensagemAnvisa : undefined;
    return NextResponse.json(
      { erro: mensagem ?? "Não foi possível consultar a ANVISA neste momento." },
      { status: 502 },
    );
  }
}
