import { NextResponse } from "next/server";
import { verificarStatusServicos } from "@/lib/server/status-servicos";

/**
 * Health check leve de todas as fontes de dados externas do app, consumido
 * pelo indicador de status do cabeçalho (lib/hooks/useStatusServicos.ts).
 * Sem relação com as buscas reais (app/api/licitacoes/route.ts e as demais
 * rotas /api/*).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await verificarStatusServicos();
  return NextResponse.json({
    ...status,
    verificadoEm: new Date().toISOString(),
  });
}
