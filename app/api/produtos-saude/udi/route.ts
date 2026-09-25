import { NextRequest, NextResponse } from "next/server";
import { buscarCaracteristicasUdi, ErroConsultaAnvisa, lerCredenciaisAnvisa } from "@/lib/server/anvisa-client";

/**
 * Características de um modelo no cadastro UDI da ANVISA (estéril, uso
 * único, látex…). Consultada sob demanda, um modelo por vez — cada uma é
 * uma requisição à ANVISA.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get("id") ?? "";

  if (!/^\d+$/.test(idParam)) {
    return NextResponse.json({ erro: "Identificador de UDI inválido." }, { status: 400 });
  }

  const credenciais = lerCredenciaisAnvisa();
  if (!credenciais) {
    return NextResponse.json(
      { erro: "Consulta de produtos para saúde ainda não configurada nesta instância." },
      { status: 501 },
    );
  }

  try {
    const caracteristicas = await buscarCaracteristicasUdi(Number(idParam), credenciais, request.signal);
    if (!caracteristicas) {
      return NextResponse.json({ erro: "Cadastro UDI não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ caracteristicas });
  } catch (erro) {
    const mensagem = erro instanceof ErroConsultaAnvisa ? erro.mensagemAnvisa : undefined;
    return NextResponse.json(
      { erro: mensagem ?? "Não foi possível consultar a ANVISA neste momento." },
      { status: 502 },
    );
  }
}
