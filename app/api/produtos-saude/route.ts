import { NextRequest, NextResponse } from "next/server";
import { interpretarBuscaProdutoSaude } from "@/lib/produtos-saude";
import { buscarProdutosSaude, ErroConsultaAnvisa, lerCredenciaisAnvisa } from "@/lib/server/anvisa-client";

export const dynamic = "force-dynamic";

const TAMANHOS_PAGINA = [25, 50, 100];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const termo = (params.get("q") ?? "").trim();

  if (!termo) {
    return NextResponse.json({ erro: "Informe o nome do produto, o número de registro ou o CNPJ." }, { status: 400 });
  }

  const credenciais = lerCredenciaisAnvisa();
  if (!credenciais) {
    return NextResponse.json(
      { erro: "Consulta de produtos para saúde ainda não configurada nesta instância." },
      { status: 501 },
    );
  }

  const pagina = Math.max(1, Math.floor(Number(params.get("pagina")) || 1));
  const tamanhoPedido = Number(params.get("tamanho"));
  const tamanhoPagina = TAMANHOS_PAGINA.includes(tamanhoPedido) ? tamanhoPedido : TAMANHOS_PAGINA[0];

  try {
    const resultado = await buscarProdutosSaude(
      { ...interpretarBuscaProdutoSaude(termo), apenasValidos: params.get("validos") !== "0", pagina, tamanhoPagina },
      credenciais,
      request.signal,
    );
    return NextResponse.json(resultado);
  } catch (erro) {
    const mensagem = erro instanceof ErroConsultaAnvisa ? erro.mensagemAnvisa : undefined;
    return NextResponse.json(
      { erro: mensagem ?? "Não foi possível consultar a ANVISA neste momento." },
      { status: 502 },
    );
  }
}
