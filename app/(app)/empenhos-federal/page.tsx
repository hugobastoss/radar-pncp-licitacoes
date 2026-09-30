import { Suspense } from "react";
import type { Metadata } from "next";
import { EmpenhosFederaisClient } from "@/components/EmpenhosFederaisClient";

export const metadata: Metadata = {
  title: "Empenhos a Receber — Governo Federal | QBuscado",
  description: "Notas de empenho do governo federal em favor do fornecedor e quanto de cada uma já foi pago.",
};

export default function EmpenhosFederalPage() {
  return (
    <Suspense fallback={null}>
      <EmpenhosFederaisClient />
    </Suspense>
  );
}
