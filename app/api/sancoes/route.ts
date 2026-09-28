import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { buscarSancoes } from "@/lib/server/transparencia-client";

/**
 * Consulta CEIS/CNEP (empresas inidôneas/punidas) no Portal da
 * Transparência. Exige a variável de ambiente PORTAL_TRANSPARENCIA_API_KEY
 * — sem ela, devolve 501 em vez de tentar chamar a API sem chave.
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
      { erro: "Consulta de sanções ainda não configurada nesta instância." },
      { status: 501 },
    );
  }

  try {
    const sancoes = await buscarSancoes(validacao.cnpj, chave, request.signal);
    return NextResponse.json(sancoes);
  } catch (erro) {
    // O motivo real (ex.: "Portal da Transparência (ceis) respondeu 403") vai
    // pro log e pro campo `detalhe` — sem ele, uma chave errada e um bloqueio
    // de IP aparecem iguais do lado de fora. A tela só mostra `erro`.
    const detalhe = descreverFalha(erro);
    console.error(`[sancoes] ${detalhe}`);
    return NextResponse.json(
      { erro: "Não foi possível consultar sanções neste momento.", detalhe },
      { status: 502 },
    );
  }
}

function descreverFalha(erro: unknown): string {
  if (!(erro instanceof Error)) return String(erro);
  // `fetch` falha com "fetch failed" e deixa o motivo de rede (ECONNRESET, timeout…) em `cause`.
  const causa = erro.cause instanceof Error ? (erro.cause as Error & { code?: string }) : undefined;
  return causa ? `${erro.message} (${causa.code ?? causa.message})` : erro.message;
}
