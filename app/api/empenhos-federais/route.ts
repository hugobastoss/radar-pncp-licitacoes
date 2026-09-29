import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { descreverFalha } from "@/lib/server/erros";
import { criarLimitePorIp, ipDaRequisicao } from "@/lib/server/limite-ip";
import { buscarEmpenhosFederais } from "@/lib/server/transparencia-client";

/**
 * Empenhos a receber do governo federal: os empenhos da empresa no ano atual
 * e no anterior, com o que já foi pago de cada um (ver
 * buscarEmpenhosFederais). Mesma chave das sanções — sem ela, 501.
 *
 * Cada empenho custa de 2 a ~15 chamadas à CGU (itens, pagamentos e, quando
 * a lista e os itens discordam, o histórico de cada item) — a Dell, com 97
 * empenhos, passa de 250. A cota da chave é de 400/min pro app inteiro, daí
 * o limite por IP. Tudo fica 6 h no cache, então repetir a mesma empresa sai
 * barato.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CONSULTAS_POR_MINUTO = 3;
const excedeuLimite = criarLimitePorIp(CONSULTAS_POR_MINUTO);

export async function GET(request: NextRequest) {
  const validacao = validarCnpj(request.nextUrl.searchParams.get("cnpj") ?? "");
  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  const chave = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!chave) {
    return NextResponse.json({ erro: "Consulta de empenhos federais ainda não configurada nesta instância." }, { status: 501 });
  }

  if (excedeuLimite(ipDaRequisicao(request))) {
    return NextResponse.json(
      { erro: `Limite de ${CONSULTAS_POR_MINUTO} consultas de empenhos por minuto atingido. Tente de novo em instantes.` },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  try {
    const resultado = await buscarEmpenhosFederais(validacao.cnpj, chave, request.signal);
    return NextResponse.json(resultado);
  } catch (erro) {
    const detalhe = descreverFalha(erro);
    console.error(`[empenhos-federais] ${detalhe}`);
    return NextResponse.json(
      { erro: "Não foi possível consultar os empenhos federais neste momento.", detalhe },
      { status: 502 },
    );
  }
}
