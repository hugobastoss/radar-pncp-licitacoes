import { NextRequest, NextResponse } from "next/server";
import { ehDominioBr } from "@/lib/dominio-email";
import { descreverFalha } from "@/lib/server/erros";
import { criarLimitePorIp, ipDaRequisicao } from "@/lib/server/limite-ip";
import { buscarDominio, LimiteRegistroBrError } from "@/lib/server/registro-br-client";

/**
 * Quem registrou um domínio .br (ver lib/server/registro-br-client.ts).
 * Domínio não registrado não é erro: responde `{ registro: null }`.
 *
 * O registro.br não publica o limite de consultas dele, então a rota tem o
 * seu próprio, por visitante.
 */
export const dynamic = "force-dynamic";

const CONSULTAS_POR_MINUTO = 20;
const excedeuLimite = criarLimitePorIp(CONSULTAS_POR_MINUTO);

export async function GET(request: NextRequest) {
  const dominio = (request.nextUrl.searchParams.get("dominio") ?? "").trim().toLowerCase();
  if (!ehDominioBr(dominio)) {
    return NextResponse.json({ erro: "Informe um domínio .br válido." }, { status: 400 });
  }

  if (excedeuLimite(ipDaRequisicao(request))) {
    return NextResponse.json(
      { erro: "Limite de consultas de domínio por minuto atingido. Tente de novo em instantes." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  try {
    return NextResponse.json({ registro: (await buscarDominio(dominio, request.signal)) ?? null });
  } catch (erro) {
    const detalhe = descreverFalha(erro);
    console.error(`[dominio] ${detalhe}`);
    if (erro instanceof LimiteRegistroBrError) {
      return NextResponse.json(
        { erro: "Limite de consultas do registro.br atingido — tente de novo em um minuto.", detalhe },
        { status: 429 },
      );
    }
    return NextResponse.json({ erro: "Não foi possível consultar o registro.br neste momento.", detalhe }, { status: 502 });
  }
}
