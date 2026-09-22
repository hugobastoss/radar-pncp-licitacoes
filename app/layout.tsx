import type { Metadata } from "next";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "RADAR PNCP — Pesquisa inteligente de licitações públicas",
  description:
    "Encontre oportunidades públicas de forma rápida e inteligente. Pesquise licitações e contratações diretamente no Portal Nacional de Contratações Públicas (PNCP).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-ink-50">
        <Header />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
