import type { Metadata } from "next";
import { EmendasClient } from "@/components/EmendasClient";

export const metadata: Metadata = {
  title: "Emendas Parlamentares | QBuscado",
  description:
    "Quanto cada emenda parlamentar já empenhou, liquidou e pagou, e quem recebeu o dinheiro — no Portal da Transparência.",
};

export default function EmendasPage() {
  return <EmendasClient />;
}
