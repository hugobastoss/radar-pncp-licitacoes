import type { Metadata } from "next";
import { ConveniosClient } from "@/components/ConveniosClient";

export const metadata: Metadata = {
  title: "Convênios Federais | Radar Licitações",
  description:
    "Repasses do governo federal a estados, municípios e entidades: objeto, valor, quanto já foi liberado e a vigência.",
};

export default function ConveniosPage() {
  return <ConveniosClient />;
}
