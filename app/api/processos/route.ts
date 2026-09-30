import { NextRequest, NextResponse } from "next/server";
import { descreverFalha } from "@/lib/server/erros";
import { buscarProcessoJudicial } from "@/lib/server/datajud-client";
import { criarLimitePorIp, ipDaRequisicao } from "@/lib/server/limite-ip";
import { tribunalPorAlias } from "@/lib/data/tribunais";
import { validarNumeroProcesso } from "@/lib/processo-judicial";

export const dynamic = "force-dynamic";

// A chave do DataJud é pública e compartilhada por qualquer consumidor — o
// limite aqui não é sobre uma cota nossa, é pra esta tela não virar um jeito
// fácil de martelar um recurso público compartilhado.
const CONSULTAS_POR_MINUTO = 20;
const excedeuLimite = criarLimitePorIp(CONSULTAS_POR_MINUTO);

export async function GET(request: NextRequest) {
  const tribunalAlias = request.nextUrl.searchParams.get("tribunal") ?? "";
  const tribunal = tribunalPorAlias(tribunalAlias);
  if (!tribunal) {
    return NextResponse.json({ erro: "Selecione um tribunal." }, { status: 400 });
  }

  const validacao = validarNumeroProcesso(request.nextUrl.searchParams.get("numero") ?? "");
  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  if (excedeuLimite(ipDaRequisicao(request))) {
    return NextResponse.json(
      { erro: `Limite de ${CONSULTAS_POR_MINUTO} consultas por minuto atingido. Tente de novo em instantes.` },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  try {
    const processo = await buscarProcessoJudicial(tribunal.alias, validacao.numero, request.signal);
    return NextResponse.json({ processo: processo ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    const detalhe = descreverFalha(erro);
    console.error(`[processos] ${detalhe}`);
    return NextResponse.json({ erro: "Não foi possível consultar o processo neste momento.", detalhe }, { status: 502 });
  }
}
