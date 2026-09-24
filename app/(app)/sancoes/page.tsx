import type { Metadata } from "next";
import { SancoesClient } from "@/components/SancoesClient";

export const metadata: Metadata = {
  title: "Consultar Sanções | Radar Licitações",
  description: "Verifique se uma empresa está impedida ou punida (CEIS/CNEP) diretamente no Portal da Transparência.",
};

export default function SancoesPage() {
  return <SancoesClient />;
}
