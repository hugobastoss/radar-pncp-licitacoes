import { NextRequest, NextResponse } from "next/server";
import { verificarStatusServicos } from "@/lib/server/status-servicos";

/**
 * Health check leve de todas as fontes de dados externas do app, consumido
 * pelo indicador de status do cabeçalho (lib/hooks/useStatusServicos.ts).
 * Sem relação com as buscas reais (app/api/licitacoes/route.ts e as demais
 * rotas /api/*) — com uma exceção: o Portal da Transparência é verificado
 * pela própria rota de sanções (ver lib/server/status-servicos.ts).
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const status = await verificarStatusServicos(request.nextUrl.origin);
  return NextResponse.json({
    ...status,
    verificadoEm: new Date().toISOString(),
  });
}
