import type { Metadata } from "next";
import { DominioClient } from "@/components/DominioClient";

export const metadata: Metadata = {
  title: "Consultar domínio | QBuscado",
  description: "Consulte quem registrou um domínio .br, direto no registro.br.",
};

export default function DominioPage() {
  return <DominioClient />;
}
