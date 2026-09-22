"use client";

import { useEffect, useState } from "react";

export type NivelStatusPncp = "verificando" | "operacional" | "instavel" | "indisponivel";

interface RespostaStatus {
  primaria: boolean;
  fallback: boolean;
}

const INTERVALO_MS = 90_000;

function calcularNivel(resposta: RespostaStatus): NivelStatusPncp {
  if (resposta.primaria) return "operacional";
  if (resposta.fallback) return "instavel";
  return "indisponivel";
}

/** Consulta /api/status ao montar e a cada 90s, enquanto o componente estiver na tela. */
export function useStatusPncp(): NivelStatusPncp {
  const [nivel, setNivel] = useState<NivelStatusPncp>("verificando");

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      try {
        const resposta = await fetch("/api/status", { cache: "no-store" });
        if (!resposta.ok) throw new Error("status não-ok");
        const dados = (await resposta.json()) as RespostaStatus;
        if (!cancelado) setNivel(calcularNivel(dados));
      } catch {
        if (!cancelado) setNivel("indisponivel");
      }
    }

    verificar();
    const intervalo = setInterval(verificar, INTERVALO_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  return nivel;
}
