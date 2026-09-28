import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { buscarDadosGovernoFederal } from "@/lib/server/transparencia-client";

/**
 * Relação da empresa com o governo federal, pelo Portal da Transparência
 * (CGU): resumo, contratos e pagamentos recebidos nos últimos 12 meses.
 * Roda em São Paulo, como a rota de sanções (ver vercel.json) — a CGU recusa
 * os servidores da Vercel nos EUA. Mesma chave: PORTAL_TRANSPARENCIA_API_KEY.
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
      { erro: "Consulta ao Portal da Transparência ainda não configurada nesta instância." },
      { status: 501 },
    );
  }

  // Cada parte falha sozinha (vem `null`) — só é erro se as três falharem.
  const dados = await buscarDadosGovernoFederal(validacao.cnpj, chave, request.signal);
  if (!dados.resumo && !dados.contratos && !dados.pagamentos) {
    return NextResponse.json(
      { erro: "Não foi possível consultar o Portal da Transparência neste momento." },
      { status: 502 },
    );
  }
  return NextResponse.json(dados);
}
