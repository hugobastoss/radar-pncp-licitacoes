import { NextRequest, NextResponse } from "next/server";
import { validarCnpj } from "@/lib/cnpj";
import { descreverFalha } from "@/lib/server/erros";
import { baixarCertidaoTcuPdf, buscarCertidaoTcu, CnpjRecusadoTcuError } from "@/lib/server/tcu-client";

/**
 * Consulta consolidada de pessoa jurídica do TCU (inidôneos TCU, CNIA/CNJ,
 * CEIS e CNEP). Com `pdf=1`, devolve o PDF oficial da certidão pra baixar.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const validacao = validarCnpj(request.nextUrl.searchParams.get("cnpj") ?? "");
  if (!validacao.valido) {
    return NextResponse.json({ erro: validacao.mensagem }, { status: 400 });
  }
  const pdf = request.nextUrl.searchParams.get("pdf") === "1";

  try {
    if (pdf) {
      const arquivo = await baixarCertidaoTcuPdf(validacao.cnpj, request.signal);
      return new NextResponse(new Uint8Array(arquivo), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="certidao-tcu-${validacao.cnpj}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const certidao = await buscarCertidaoTcu(validacao.cnpj, request.signal);
    return NextResponse.json(certidao);
  } catch (erro) {
    if (erro instanceof CnpjRecusadoTcuError) {
      return NextResponse.json({ erro: `O TCU não aceitou este CNPJ: ${erro.message}.` }, { status: 400 });
    }
    const detalhe = descreverFalha(erro);
    console.error(`[tcu/certidao] ${detalhe}`);
    return NextResponse.json({ erro: "Não foi possível consultar o TCU neste momento.", detalhe }, { status: 502 });
  }
}
