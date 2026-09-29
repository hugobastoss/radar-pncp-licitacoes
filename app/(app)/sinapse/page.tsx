import { Suspense } from "react";
import type { Metadata } from "next";
import { SinapseClient } from "@/components/SinapseClient";

export const metadata: Metadata = {
  title: "Sinapse — Mapa de Relações | Radar Licitações",
  description:
    "Mapa de relações entre empresas, sócios, órgãos que contratam e sanções, com os cruzamentos entre elas (versão beta).",
};

export default function SinapsePage() {
  return (
    <Suspense fallback={null}>
      <SinapseClient />
    </Suspense>
  );
}
