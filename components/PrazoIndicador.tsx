import { AlarmClock, CalendarX2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { calcularUrgenciaPrazo, formatarData, type UrgenciaPrazo } from "@/lib/formatters";

const TONE_POR_URGENCIA: Record<UrgenciaPrazo, "neutral" | "danger" | "warning" | "success"> = {
  encerrada: "neutral",
  critico: "danger",
  atencao: "warning",
  confortavel: "success",
  indefinido: "neutral",
};

interface PrazoIndicadorProps {
  dataEncerramento?: string;
  comData?: boolean;
  className?: string;
}

/**
 * Reforça a urgência do prazo com cor E texto (nunca só cor), para não
 * depender de percepção de cor para uma informação prioritária no fluxo.
 */
export function PrazoIndicador({ dataEncerramento, comData = true, className }: PrazoIndicadorProps) {
  const { urgencia, rotulo } = calcularUrgenciaPrazo(dataEncerramento);
  const tone = TONE_POR_URGENCIA[urgencia];

  return (
    <div className={className}>
      <Badge
        tone={tone}
        icon={
          urgencia === "encerrada" ? (
            <CalendarX2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <AlarmClock className="h-3.5 w-3.5" aria-hidden />
          )
        }
      >
        {rotulo}
      </Badge>
      {comData && <div className="mt-1 text-xs text-ink-500">{formatarData(dataEncerramento)}</div>}
    </div>
  );
}
