import { Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { identificarPortal, type PortalInfo } from "@/lib/portal";

const TONALIDADE_PARA_TONE: Record<PortalInfo["tonalidade"], "primary" | "success" | "accent" | "warning" | "neutral"> = {
  azul: "primary",
  verde: "success",
  roxo: "accent",
  ambar: "warning",
  neutro: "neutral",
};

/**
 * Sempre deriva a exibição a partir de `linkSistemaOrigem` usando a mesma
 * função (lib/portal.ts) que o backend usa para popular `item.portal` —
 * uma única fonte de verdade para o reconhecimento de portal.
 */
export function PortalBadge({ linkSistemaOrigem }: { linkSistemaOrigem?: string }) {
  const info = identificarPortal(linkSistemaOrigem);
  const tone = TONALIDADE_PARA_TONE[info.tonalidade];
  const texto = info.nome === "Outro portal" && info.dominio ? `Outro portal · ${info.dominio}` : info.nome;

  return (
    <Badge tone={tone} icon={<Globe2 className="h-3.5 w-3.5" aria-hidden />}>
      {texto}
    </Badge>
  );
}
