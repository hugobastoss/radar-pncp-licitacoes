import type { Metadata } from "next";
import { NcmClient } from "@/components/NcmClient";

export const metadata: Metadata = {
  title: "Consultar NCM | Radar Licitações",
  description: "Consulte a classificação de mercadorias (Nomenclatura Comum do Mercosul) por código ou palavra-chave.",
};

export default function NcmPage() {
  return <NcmClient />;
}
