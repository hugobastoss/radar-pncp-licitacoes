import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { buscarInscricoesEstaduais, LimiteCnpjWsError } from "@/lib/server/cnpjws-client";
import { descreverFalha } from "@/lib/server/erros";
import { criarLimitePorIp, ipDaRequisicao } from "@/lib/server/limite-ip";

/**
 * Inscrições estaduais de um CNPJ, pela CNPJ.ws (ver
 * lib/server/cnpjws-client.ts). A fonte aceita 3 consultas por minuto por
 * IP, então a rota também limita por visitante — um só visitante não gasta
 * a cota de todos.
 */
export const dynamic = "force-dynamic";

const CONSULTAS_POR_MINUTO = 6;
const excedeuLimite = criarLimitePorIp(CONSULTAS_POR_MINUTO);

export async function GET(request: NextRequest) {
  const validacao = validarCnpj(request.nextUrl.searchParams.get("cnpj") ?? "");
  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  if (excedeuLimite(ipDaRequisicao(request))) {
    return NextResponse.json(
      { erro: "Limite de consultas de inscrições por minuto atingido. Tente de novo em instantes." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  try {
    return NextResponse.json({ inscricoes: await buscarInscricoesEstaduais(validacao.cnpj, request.signal) });
  } catch (erro) {
    const detalhe = descreverFalha(erro);
    console.error(`[cnpj/inscricoes-estaduais] ${detalhe}`);
    if (erro instanceof LimiteCnpjWsError) {
      return NextResponse.json(
        { erro: "Limite de consultas da fonte atingido — tente de novo em um minuto.", detalhe },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { erro: "Não foi possível consultar as inscrições estaduais neste momento.", detalhe },
      { status: 502 },
    );
  }
}
