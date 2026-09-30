import type { Metadata } from "next";
import { ProcessoJudicialClient } from "@/components/ProcessoJudicialClient";

export const metadata: Metadata = {
  title: "Consultar processo judicial | QBuscado",
  description: "Consulte os metadados públicos de um processo judicial (classe, assuntos, órgão julgador e andamentos) na base do CNJ.",
};

export default function ProcessosPage() {
  return <ProcessoJudicialClient />;
}
