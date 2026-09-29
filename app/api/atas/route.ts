import { NextRequest, NextResponse } from "next/server";
import { ESTADOS } from "@/lib/data/estados";
import { descreverFalha } from "@/lib/server/erros";
import { buscarAtas } from "@/lib/server/pncp-atas-client";

/** Atas de registro de preço no PNCP, por texto e UF — ver lib/server/pncp-atas-client.ts. */
export const dynamic = "force-dynamic";

// O PNCP recusa páginas muito altas na busca; 1.000 páginas de 10 já é muito além do uso real.
const MAXIMO_PAGINA = 1000;

export async function GET(request: NextRequest) {
  const busca = request.nextUrl.searchParams;
  const q = busca.get("q")?.trim() || undefined;
  const uf = busca.get("uf")?.trim().toUpperCase() || undefined;
  const somenteVigentes = busca.get("todas") !== "1";
  const pagina = Number(busca.get("pagina") ?? "1");

  const erro =
    (q && q.length > 200 && "Texto da busca longo demais.") ||
    (uf && !ESTADOS.some((e) => e.sigla === uf) && "Estado inválido.") ||
    (!(Number.isInteger(pagina) && pagina >= 1 && pagina <= MAXIMO_PAGINA) && "Página inválida.");
  if (erro) return NextResponse.json({ erro }, { status: 400 });

  try {
    const resultado = await buscarAtas({ q, uf, somenteVigentes, pagina }, request.signal);
    return NextResponse.json(resultado);
  } catch (falha) {
    const detalhe = descreverFalha(falha);
    console.error(`[atas] ${detalhe}`);
    return NextResponse.json(
      { erro: "O PNCP não respondeu agora — ele anda instável. Tente de novo em instantes.", detalhe },
      { status: 502 },
    );
  }
}
