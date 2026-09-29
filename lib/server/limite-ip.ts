import type { NextRequest } from "next/server";

const MAXIMO_IPS = 5000;

/**
 * Limite de consultas por IP, numa janela deslizante de 1 minuto guardada na
 * memória da função. Cada instância tem a sua, então não é um limite exato —
 * segura uso automatizado, não um ataque distribuído. Usado nas rotas que
 * gastam muitas chamadas da chave da CGU (400/min pro app inteiro).
 */
export function criarLimitePorIp(consultasPorMinuto: number): (ip: string) => boolean {
  const consultasPorIp = new Map<string, number[]>();
  return function excedeuLimite(ip: string): boolean {
    const agora = Date.now();
    const recentes = (consultasPorIp.get(ip) ?? []).filter((t) => agora - t < 60_000);
    if (recentes.length >= consultasPorMinuto) return true;
    if (consultasPorIp.size >= MAXIMO_IPS) consultasPorIp.clear();
    consultasPorIp.set(ip, [...recentes, agora]);
    return false;
  };
}

export function ipDaRequisicao(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
