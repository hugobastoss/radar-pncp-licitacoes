import type { Metadata } from "next";
import Script from "next/script";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SCRIPT_INICIALIZACAO_TEMA } from "@/lib/theme";
import { SCRIPT_INICIALIZACAO_MENU } from "@/lib/menu-lateral";
import "./globals.css";

// Endereço de produção, usado nos links das imagens de compartilhamento. Na Vercel vem do
// domínio de produção do projeto (hoje qbuscado.vercel.app); quando qbuscado.com for
// configurado como domínio de produção, passa a ser ele, sem mexer aqui.
const URL_DO_SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://qbuscado.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(URL_DO_SITE),
  title: "QBuscado — Consulta inteligente de dados públicos",
  description:
    "Consulte licitações, empresas, sanções, emendas parlamentares, convênios e outros dados públicos num só lugar, direto das fontes oficiais: PNCP, Receita Federal, Portal da Transparência, TCU e outras.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Script id="tema-inicial" strategy="beforeInteractive">
          {SCRIPT_INICIALIZACAO_TEMA + SCRIPT_INICIALIZACAO_MENU}
        </Script>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
