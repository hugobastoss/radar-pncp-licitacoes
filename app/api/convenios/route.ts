import { NextRequest, NextResponse } from "next/server";
import { ESTADOS } from "@/lib/data/estados";
import { descreverFalha } from "@/lib/server/erros";
import { buscarConvenios } from "@/lib/server/transparencia-client";

/**
 * Convênios do governo federal no Portal da Transparência (CGU), por UF,
 * município ou nome do convenente. Mesma chave das sanções
 * (PORTAL_TRANSPARENCIA_API_KEY) — sem ela, 501.
 */
export const dynamic = "force-dynamic";

const MAXIMO_PAGINA = 1000;

export async function GET(request: NextRequest) {
  const busca = request.nextUrl.searchParams;
  const texto = (nome: string) => busca.get(nome)?.trim() || undefined;

  const uf = texto("uf")?.toUpperCase();
  const municipio = texto("municipio");
  const convenente = texto("convenente");
  const somenteVigentes = texto("vigentes") === "1";
  const pagina = Number(texto("pagina") ?? "1");

  const erro =
    (!uf && !municipio && !convenente && "Escolha um estado, um município ou o nome do convenente.") ||
    (uf && !ESTADOS.some((e) => e.sigla === uf) && "Estado inválido.") ||
    (municipio && !/^\d{7}$/.test(municipio) && "Município inválido: use o código IBGE de 7 dígitos.") ||
    (convenente &&
      (convenente.length < 3 || convenente.length > 100) &&
      "Nome do convenente: de 3 a 100 caracteres.") ||
    (!(Number.isInteger(pagina) && pagina >= 1 && pagina <= MAXIMO_PAGINA) && "Página inválida.");
  if (erro) return NextResponse.json({ erro }, { status: 400 });

  const chave = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!chave) {
    return NextResponse.json({ erro: "Consulta de convênios ainda não configurada nesta instância." }, { status: 501 });
  }

  try {
    const resultado = await buscarConvenios(
      { uf, codigoIbge: municipio, convenente, somenteVigentes, pagina },
      chave,
      request.signal,
    );
    return NextResponse.json(resultado);
  } catch (falha) {
    const detalhe = descreverFalha(falha);
    console.error(`[convenios] ${detalhe}`);
    return NextResponse.json(
      { erro: "Não foi possível consultar os convênios neste momento.", detalhe },
      { status: 502 },
    );
  }
}
