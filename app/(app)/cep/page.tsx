import type { Metadata } from "next";
import { CepClient } from "@/components/CepClient";

export const metadata: Metadata = {
  title: "Consultar CEP | QBuscado",
  description: "Consulte o endereço correspondente a um CEP.",
};

export default function CepPage() {
  return <CepClient />;
}
