import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { descreverFalha } from "@/lib/server/erros";
import { buscarContratosDoFornecedor } from "@/lib/server/am-sgc-client";

/**
 * Contratos de um fornecedor com o Governo do Amazonas (SGC da SEFAZ-AM).
 * Varre todas as unidades gestoras — a primeira consulta de uma instância
 * leva alguns segundos; as seguintes usam o cache (ver am-sgc-client.ts).
 * Roda em São Paulo (vercel.json), junto das outras fontes do governo.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const validacao = validarCnpj(request.nextUrl.searchParams.get("cnpj") ?? "");
  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }

  try {
    return NextResponse.json(await buscarContratosDoFornecedor(validacao.cnpj));
  } catch (erro) {
    const detalhe = descreverFalha(erro);
    console.error(`[am/contratos] ${detalhe}`);
    return NextResponse.json(
      { erro: "Não foi possível consultar os contratos do Governo do Amazonas neste momento.", detalhe },
      { status: 502 },
    );
  }
}
