import { Suspense } from "react";
import type { Metadata } from "next";
import { CnpjClient } from "@/components/CnpjClient";

export const metadata: Metadata = {
  title: "Consultar CNPJ | QBuscado",
  description:
    "Consulte dados cadastrais de empresas na base da Receita Federal, com as sanções (CEIS/CNEP) e a relação com o governo federal.",
};

export default function CnpjPage() {
  return (
    <Suspense fallback={null}>
      <CnpjClient />
    </Suspense>
  );
}
