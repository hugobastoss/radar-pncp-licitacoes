"use client";

import { useSyncExternalStore } from "react";
import type { NivelServico, StatusServicos } from "@/lib/server/status-servicos";

export type { NivelServico, StatusServicos };

const INTERVALO_MS = 90_000;

const TUDO_INDISPONIVEL: StatusServicos = {
  pncp: "indisponivel",
  comprasGovBr: "indisponivel",
  brasilApi: "indisponivel",
  portalTransparencia: "indisponivel",
  anvisa: "indisponivel",
};

// Uma checagem só pro site inteiro, dividida por todos os indicadores na tela
// (o da barra do topo e o da gaveta do menu). Cada checagem faz o servidor
// consultar as fontes — inclusive a CGU, que tem cota —, então abrir a gaveta
// não pode disparar outra.
let statusAtual: StatusServicos | null = null;
let intervalo: ReturnType<typeof setInterval> | undefined;
const ouvintes = new Set<() => void>();

async function verificar() {
  try {
    const resposta = await fetch("/api/status", { cache: "no-store" });
    if (!resposta.ok) throw new Error("status não-ok");
    statusAtual = (await resposta.json()) as StatusServicos;
  } catch {
    statusAtual = TUDO_INDISPONIVEL;
  }
  for (const ouvinte of ouvintes) ouvinte();
}

function inscrever(callback: () => void) {
  ouvintes.add(callback);
  if (ouvintes.size === 1) {
    void verificar();
    intervalo = setInterval(verificar, INTERVALO_MS);
  }
  return () => {
    ouvintes.delete(callback);
    if (ouvintes.size === 0) {
      clearInterval(intervalo);
      intervalo = undefined;
    }
  };
}

function lerStatus() {
  return statusAtual;
}

function lerStatusNoServidor() {
  return null;
}

/**
 * Status das fontes externas: consulta /api/status quando o primeiro
 * indicador aparece na tela e a cada 90 s enquanto houver algum. Devolve
 * `null` até a primeira checagem responder — o consumidor decide como exibir
 * esse estado de "verificando" transitório.
 */
export function useStatusServicos(): StatusServicos | null {
  return useSyncExternalStore(inscrever, lerStatus, lerStatusNoServidor);
}
