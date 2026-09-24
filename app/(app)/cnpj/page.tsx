import type { Metadata } from "next";
import { CnpjClient } from "@/components/CnpjClient";

export const metadata: Metadata = {
  title: "Consultar CNPJ | Radar Licitações",
  description: "Consulte dados cadastrais de empresas diretamente na base da Receita Federal.",
};

export default function CnpjPage() {
  return <CnpjClient />;
}
