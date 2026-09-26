import type { Metadata } from "next";
import { NomeTecnicoClient } from "@/components/NomeTecnicoClient";

export const metadata: Metadata = {
  title: "Consultar Nomenclatura Técnica | Radar Licitações",
  description:
    "Consulte a nomenclatura técnica oficial de produtos para saúde na ANVISA — definição, categoria e classe de risco.",
};

export default function NomeTecnicoPage() {
  return <NomeTecnicoClient />;
}
