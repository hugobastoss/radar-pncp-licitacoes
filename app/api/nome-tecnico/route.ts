import { NextRequest, NextResponse } from "next/server";
import { ehCategoriaNomeTecnico, ehFiltroClasseRisco } from "@/lib/nome-tecnico";
import { buscarNomesTecnicos, ErroConsultaAnvisa, lerCredenciaisAnvisa } from "@/lib/server/anvisa-client";

export const dynamic = "force-dynamic";

const TAMANHOS_PAGINA = [25, 50, 100];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const termo = (params.get("q") ?? "").trim();
  const categoriaParam = params.get("categoria") ?? "";
  const classeParam = params.get("classe") ?? "";
  const categoria = ehCategoriaNomeTecnico(categoriaParam) ? categoriaParam : undefined;
  const classeRisco = ehFiltroClasseRisco(classeParam) ? classeParam : undefined;

  // Sem termo vale, desde que haja filtro — ex.: todos os nomes de classe IV.
  if (!termo && !categoria && !classeRisco) {
    return NextResponse.json({ erro: "Informe um nome técnico ou um código, ou escolha um filtro." }, { status: 400 });
  }

  const credenciais = lerCredenciaisAnvisa();
  if (!credenciais) {
    return NextResponse.json(
      { erro: "Consulta de nomenclatura técnica ainda não configurada nesta instância." },
      { status: 501 },
    );
  }

  const pagina = Math.max(1, Math.floor(Number(params.get("pagina")) || 1));
  const tamanhoPedido = Number(params.get("tamanho"));
  const tamanhoPagina = TAMANHOS_PAGINA.includes(tamanhoPedido) ? tamanhoPedido : TAMANHOS_PAGINA[0];

  try {
    const resultado = await buscarNomesTecnicos({ termo, categoria, classeRisco, pagina, tamanhoPagina }, credenciais);
    return NextResponse.json(resultado);
  } catch (erro) {
    const mensagem = erro instanceof ErroConsultaAnvisa ? erro.mensagemAnvisa : undefined;
    return NextResponse.json(
      { erro: mensagem ?? "Não foi possível consultar a ANVISA neste momento." },
      { status: 502 },
    );
  }
}
