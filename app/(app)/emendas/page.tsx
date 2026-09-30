import type { Metadata } from "next";
import { EmendasClient } from "@/components/EmendasClient";
import { FORMATO_CODIGO_EMENDA } from "@/lib/emendas";

export const metadata: Metadata = {
  title: "Emendas Parlamentares | QBuscado",
  description:
    "Quanto cada emenda parlamentar já empenhou, liquidou e pagou, e quem recebeu o dinheiro — no Portal da Transparência.",
};

/**
 * `/emendas?codigo=202640680005` abre já consultando essa emenda — é o link
 * que as transferências especiais da ficha do CNPJ usam.
 */
export default async function EmendasPage(props: PageProps<"/emendas">) {
  const { codigo } = await props.searchParams;
  const codigoInicial = typeof codigo === "string" && FORMATO_CODIGO_EMENDA.test(codigo) ? codigo : undefined;
  // A `key` remonta a tela quando o código muda com ela já aberta.
  return <EmendasClient key={codigoInicial ?? "sem-codigo"} codigoInicial={codigoInicial} />;
}
