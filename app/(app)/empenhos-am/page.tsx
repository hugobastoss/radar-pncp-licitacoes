import { Suspense } from "react";
import type { Metadata } from "next";
import { EmpenhosAmClient } from "@/components/EmpenhosAmClient";

export const metadata: Metadata = {
  title: "Empenhos a Receber — Governo do Amazonas | QBuscado",
  description:
    "Contratos do fornecedor com o Governo do Amazonas e quanto de cada nota de empenho já foi liquidado e pago.",
};

export default function EmpenhosAmPage() {
  return (
    <Suspense fallback={null}>
      <EmpenhosAmClient />
    </Suspense>
  );
}
