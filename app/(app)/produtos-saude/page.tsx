import type { Metadata } from "next";
import { ProdutosSaudeClient } from "@/components/ProdutosSaudeClient";

export const metadata: Metadata = {
  title: "Consultar Produtos para Saúde | Radar Licitações",
  description: "Verifique o registro de dispositivos médicos e materiais hospitalares na ANVISA.",
};

export default function ProdutosSaudePage() {
  return <ProdutosSaudeClient />;
}
