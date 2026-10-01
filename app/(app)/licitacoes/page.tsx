import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardClient } from "@/components/DashboardClient";

export const metadata: Metadata = {
  title: "Licitações | QBuscado",
  description:
    "Busque licitações em aberto por estado, município, modalidade, órgão e valor, direto nas fontes oficiais do PNCP.",
};

export default function LicitacoesPage() {
  return (
    <Suspense fallback={null}>
      <DashboardClient />
    </Suspense>
  );
}
