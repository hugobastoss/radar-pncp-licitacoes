import type { Metadata } from "next";
import { CpfClient } from "@/components/CpfClient";

export const metadata: Metadata = {
  title: "Consultar CPF | Radar Licitações",
  description:
    "Sanções, pessoa politicamente exposta (PEP), vínculo de servidor e contratos federais de um CPF, no Portal da Transparência.",
};

export default function CpfPage() {
  return <CpfClient />;
}
