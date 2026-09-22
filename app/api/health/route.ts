import { NextResponse } from "next/server";

/**
 * Health-check leve usado apenas pelo indicador "Consulta online" do header.
 * Sem latência artificial nem relação com os dados de licitações.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
