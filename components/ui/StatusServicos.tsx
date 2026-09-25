"use client";

import { useRef, useState } from "react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { useStatusServicos } from "@/lib/hooks/useStatusServicos";
import type { NivelServico, StatusServicos as StatusServicosType } from "@/lib/hooks/useStatusServicos";
import { cn } from "@/lib/cn";

type NivelExibicao = NivelServico | "verificando";

const ROTULO: Record<NivelExibicao, string> = {
  verificando: "Verificando…",
  operacional: "Operacional",
  instavel: "Instável",
  indisponivel: "Indisponível",
  nao_configurado: "Não configurado",
};

const COR_PONTO: Record<NivelExibicao, string> = {
  verificando: "bg-ink-300 dark:bg-ink-600",
  operacional: "bg-success-600",
  instavel: "bg-warning-600",
  indisponivel: "bg-danger-600",
  nao_configurado: "bg-ink-300 dark:bg-ink-600",
};

interface Servico {
  chave: keyof StatusServicosType;
  nome: string;
  descricao: string;
}

const SERVICOS: Servico[] = [
  { chave: "pncp", nome: "PNCP", descricao: "Busca de licitações — fontes primária e oficial." },
  { chave: "comprasGovBr", nome: "Compras.gov.br", descricao: "Último fallback da busca de licitações." },
  { chave: "brasilApi", nome: "BrasilAPI", descricao: "Consultas de CNPJ, CEP e NCM." },
  { chave: "portalTransparencia", nome: "Portal da Transparência", descricao: "Sanções (CEIS/CNEP)." },
  { chave: "anvisa", nome: "ANVISA", descricao: "Produtos para saúde e nomenclatura técnica." },
];

// "nao_configurado" nunca decide o agregado abaixo (ver o `!==` no loop) —
// o peso só existe pra satisfazer o Record<NivelServico, number>.
const PESO: Record<NivelServico, number> = {
  operacional: 0,
  instavel: 1,
  indisponivel: 2,
  nao_configurado: -1,
};

function calcularAgregado(status: StatusServicosType | null): NivelExibicao {
  if (!status) return "verificando";
  let pior: NivelServico = "operacional";
  for (const { chave } of SERVICOS) {
    const nivel = status[chave];
    if (nivel !== "nao_configurado" && PESO[nivel] > PESO[pior]) pior = nivel;
  }
  return pior;
}

function LinhaServico({ nome, descricao, nivel }: { nome: string; descricao: string; nivel: NivelExibicao }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-ink-600 dark:text-ink-300" title={descricao}>
        {nome}
      </span>
      <span className="flex items-center gap-1.5 font-medium text-ink-900 dark:text-ink-50">
        <span className={cn("h-2 w-2 rounded-full", COR_PONTO[nivel])} aria-hidden />
        {ROTULO[nivel]}
      </span>
    </div>
  );
}

interface StatusServicosProps {
  variante?: "compacta" | "linha";
}

export function StatusServicos({ variante = "compacta" }: StatusServicosProps) {
  const status = useStatusServicos();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setAberto(false), aberto);

  if (variante === "linha") {
    return (
      <div className="text-sm">
        <p className="mb-1 text-ink-600 dark:text-ink-300">Status dos serviços</p>
        {SERVICOS.map(({ chave, nome, descricao }) => (
          <LinhaServico
            key={chave}
            nome={nome}
            descricao={descricao}
            nivel={status ? status[chave] : "verificando"}
          />
        ))}
      </div>
    );
  }

  const agregado = calcularAgregado(status);

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label="Status dos serviços"
        title="Status dos serviços externos usados pelo Radar Licitações."
        className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-500 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800"
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", COR_PONTO[agregado])} aria-hidden />
        Serviços
      </button>
      {aberto && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-ink-200 bg-white p-4 shadow-popover dark:border-ink-700 dark:bg-ink-900">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Status dos serviços</h3>
          <div className="mt-2">
            {SERVICOS.map(({ chave, nome, descricao }) => (
              <LinhaServico
                key={chave}
                nome={nome}
                descricao={descricao}
                nivel={status ? status[chave] : "verificando"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
