"use client";

import { useEffect, useState } from "react";
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

/**
 * Consulta /api/status ao montar e a cada 90s, enquanto o componente estiver
 * na tela. Devolve `null` até a primeira checagem responder — o consumidor
 * decide como exibir esse estado de "verificando" transitório.
 */
export function useStatusServicos(): StatusServicos | null {
  const [status, setStatus] = useState<StatusServicos | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      try {
        const resposta = await fetch("/api/status", { cache: "no-store" });
        if (!resposta.ok) throw new Error("status não-ok");
        const dados = (await resposta.json()) as StatusServicos;
        if (!cancelado) setStatus(dados);
      } catch {
        if (!cancelado) setStatus(TUDO_INDISPONIVEL);
      }
    }

    verificar();
    const intervalo = setInterval(verificar, INTERVALO_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  return status;
}
