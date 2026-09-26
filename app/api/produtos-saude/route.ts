import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { interpretarBuscaProdutoSaude } from "@/lib/produtos-saude";
import { buscarProdutosSaude, ErroConsultaAnvisa, lerCredenciaisAnvisa } from "@/lib/server/anvisa-client";

export const dynamic = "force-dynamic";

const TAMANHOS_PAGINA = [25, 50, 100];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const termo = (params.get("q") ?? "").trim();
  const cnpjParam = (params.get("cnpj") ?? "").trim();

  if (!termo && !cnpjParam) {
    return NextResponse.json({ erro: "Informe o nome do produto, o número de registro ou o CNPJ." }, { status: 400 });
  }

  let cnpjEmpresa: string | undefined;
  if (cnpjParam) {
    const validacao = validarCnpj(cnpjParam);
    if (!validacao.valido) return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
    cnpjEmpresa = validacao.cnpj;
  }

  // Sem termo, é a busca de todos os produtos da empresa — o mesmo que digitar o CNPJ no campo principal.
  const interpretacao = termo
    ? interpretarBuscaProdutoSaude(termo)
    : { tipo: "cnpj" as const, valor: cnpjEmpresa ?? "" };
  if (interpretacao.tipo === "cnpj" && cnpjEmpresa && interpretacao.valor !== cnpjEmpresa) {
    return NextResponse.json(
      { erro: "Foram informados dois CNPJs diferentes. Deixe o CNPJ só no campo da empresa." },
      { status: 400 },
    );
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
      {
        ...interpretacao,
        // Quando o próprio termo já é o CNPJ, não há o que combinar.
        cnpjEmpresa: interpretacao.tipo === "cnpj" ? undefined : cnpjEmpresa,
        apenasValidos: params.get("validos") !== "0",
        pagina,
        tamanhoPagina,
      },
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
