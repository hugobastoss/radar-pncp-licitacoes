import type { Metadata } from "next";
import Script from "next/script";
import { Header } from "@/components/Header";
import { SCRIPT_INICIALIZACAO_TEMA } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "RADAR PNCP — Pesquisa inteligente de licitações públicas",
  description:
    "Encontre oportunidades públicas de forma rápida e inteligente. Pesquise licitações e contratações diretamente no Portal Nacional de Contratações Públicas (PNCP).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Script id="tema-inicial" strategy="beforeInteractive">
          {SCRIPT_INICIALIZACAO_TEMA}
        </Script>
        <Header />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
