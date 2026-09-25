import { NextRequest, NextResponse } from "next/server";
import { buscarDetalheProdutoSaude, ErroConsultaAnvisa, lerCredenciaisAnvisa } from "@/lib/server/anvisa-client";

/**
 * Detalhe de um registro de produto para saúde (pelo número do processo),
 * com os códigos UDI do registro e os certificados de boas práticas da
 * empresa detentora.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const processo = (request.nextUrl.searchParams.get("processo") ?? "").replace(/\D/g, "");

  if (processo.length !== 17) {
    return NextResponse.json({ erro: "Número de processo inválido." }, { status: 400 });
  }

  const credenciais = lerCredenciaisAnvisa();
  if (!credenciais) {
    return NextResponse.json(
      { erro: "Consulta de produtos para saúde ainda não configurada nesta instância." },
      { status: 501 },
    );
  }

  try {
    const resultado = await buscarDetalheProdutoSaude(processo, credenciais, request.signal);
    if (!resultado) {
      return NextResponse.json({ erro: "Registro não encontrado na ANVISA." }, { status: 404 });
    }
    return NextResponse.json(resultado);
  } catch (erro) {
    const mensagem = erro instanceof ErroConsultaAnvisa ? erro.mensagemAnvisa : undefined;
    return NextResponse.json(
      { erro: mensagem ?? "Não foi possível consultar a ANVISA neste momento." },
      { status: 502 },
    );
  }
}
