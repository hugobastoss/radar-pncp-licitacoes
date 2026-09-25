import { Suspense } from "react";
import type { Metadata } from "next";
import { CnpjClient } from "@/components/CnpjClient";

export const metadata: Metadata = {
  title: "Consultar CNPJ | Radar Licitações",
  description: "Consulte dados cadastrais de empresas na base da Receita Federal, junto com as sanções do CEIS e do CNEP.",
};

export default function CnpjPage() {
  return (
    <Suspense fallback={null}>
      <CnpjClient />
    </Suspense>
  );
}
