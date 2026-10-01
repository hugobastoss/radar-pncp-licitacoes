import Link from "next/link";
import { Landmark, Network } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatarMoeda } from "@/lib/formatters";
import type { ResultadoTransferenciasEspeciais } from "@/lib/api-fontes-publicas";

export type EstadoTransferencias =
  | ResultadoTransferenciasEspeciais
  | { status: "carregando" }
  | { status: "nao_consultado" };

/**
 * Transferências especiais ("emendas PIX") que o CNPJ recebeu, pelo
 * TransfereGov. Só aparece quando há o que mostrar — quem recebe isso são
 * prefeituras, estados e entidades; pra uma empresa comum a seção some.
 */
export function TransferenciasEspeciaisSecao({
  estado,
  className,
}: {
  estado: EstadoTransferencias;
  className?: string;
}) {
  if (estado.status === "erro_servidor" || estado.status === "limite") {
    return (
      <div className={className}>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          {estado.mensagem ?? "Não foi possível consultar as transferências especiais neste momento."}
        </p>
      </div>
    );
  }
  if (estado.status !== "sucesso" || estado.transferencias.total === 0) return null;

  const { total, itens } = estado.transferencias;

  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
        <Landmark className="h-3.5 w-3.5" aria-hidden />
        Transferências especiais recebidas (emendas PIX)
      </p>
      <p className="mt-2 text-sm text-ink-700 dark:text-ink-200">
        {total === 1 ? "1 plano de ação" : `${total} planos de ação`}
        {total > itens.length && `, os ${itens.length} mais recentes abaixo`}.
      </p>

      <ul className="mt-3 space-y-3">
        {itens.map((t) => (
          <li key={t.codigo} className="text-sm">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium tabular-nums text-ink-900 dark:text-ink-50">{t.ano}</span>
              <span className="font-medium tabular-nums text-ink-900 dark:text-ink-50">{formatarMoeda(t.valor)}</span>
              <Badge tone={t.situacao === "Impedido" ? "warning" : "neutral"}>{t.situacao}</Badge>
              {t.parlamentar && <span className="text-ink-600 dark:text-ink-300">{t.parlamentar}</span>}
            </p>
            {t.area && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{t.area}</p>}
            {t.motivoImpedimento && (
              <p className="mt-0.5 text-xs text-warning-700 dark:text-warning-300">{t.motivoImpedimento}</p>
            )}
            {t.numeroEmenda && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="tabular-nums text-ink-500 dark:text-ink-400">Emenda {t.numeroEmenda}</span>
                <Link
                  href={`/emendas?codigo=${t.numeroEmenda}`}
                  className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  Ver a emenda
                </Link>
                <Link
                  href={`/sinapse?emenda=${t.numeroEmenda}`}
                  className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  <Network className="h-3 w-3" aria-hidden />
                  Ver no mapa Sinapse
                </Link>
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">Fonte: TransfereGov (dados abertos).</p>
    </div>
  );
}
