import { NextResponse } from "next/server";
import { verificarStatusPncp } from "@/lib/server/pncp-status";

/**
 * Health check leve das fontes de dados do PNCP, consumido pelo indicador de
 * status do cabeçalho (lib/hooks/useStatusPncp.ts). Sem relação com a busca
 * real de licitações (app/api/licitacoes/route.ts).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await verificarStatusPncp();
  return NextResponse.json({
    ...status,
    verificadoEm: new Date().toISOString(),
  });
}
