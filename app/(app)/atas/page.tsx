import type { Metadata } from "next";
import { AtasClient } from "@/components/AtasClient";

export const metadata: Metadata = {
  title: "Atas de Registro de Preço | QBuscado",
  description: "Atas de registro de preço vigentes no PNCP, por texto e estado: preços registrados e possibilidade de adesão.",
};

export default function AtasPage() {
  return <AtasClient />;
}
