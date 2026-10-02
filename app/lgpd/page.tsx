import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, SecaoLegal } from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "LGPD | QBuscado",
  description: "Como o QBuscado trata dados pessoais à luz da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).",
};

const ATUALIZADO_EM = "2 de outubro de 2026";

export default function LgpdPage() {
  return (
    <PaginaLegal titulo="LGPD" atualizadoEm={ATUALIZADO_EM}>
      <SecaoLegal titulo="1. O que é a LGPD">
        <p>
          A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) regula o tratamento de dados pessoais no
          Brasil, por pessoas físicas ou jurídicas, de direito público ou privado. Esta página complementa a{" "}
          <Link href="/politica-de-privacidade" className="font-medium text-primary-600 hover:underline dark:text-primary-400">
            Política de Privacidade
          </Link>
          , detalhando especificamente como a LGPD se aplica ao QBuscado.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="2. Base legal do tratamento">
        <p>
          O QBuscado não exige cadastro e não coleta dados pessoais de quem visita o site. As poucas
          informações guardadas (tema claro/escuro, menu recolhido, últimas empresas consultadas) ficam só
          no seu navegador, nunca em nossos servidores, e não identificam ninguém.
        </p>
        <p>
          Os dados pessoais que aparecem nos <strong>resultados de consulta</strong> (sócios de empresas,
          sancionados, servidores públicos, parlamentares e outros) são publicados pelos próprios órgãos
          responsáveis (PNCP, Receita Federal, Portal da Transparência, TCU, Ministério do Trabalho e
          Emprego, entre outros), com base nos fundamentos legais de cada um deles, principalmente o
          princípio da publicidade administrativa (Art. 37 da Constituição) e a Lei de Acesso à Informação
          (Lei nº 12.527/2011). O QBuscado apenas organiza e exibe o que essas fontes já publicam
          oficialmente, sob a base legal de <strong>interesse público</strong> e{" "}
          <strong>legítimo interesse</strong> (Art. 7º, IX, e Art. 23 da LGPD), sem tratamento adicional,
          cruzamento com outras bases de identificação ou qualquer finalidade além da transparência pública
          que já rege a publicação original.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="3. Dados sensíveis">
        <p>
          Algumas fontes públicas consultadas podem conter dados de natureza mais sensível, como a lista de
          empregadores flagrados em trabalho análogo ao escravo (Ministério do Trabalho e Emprego) ou
          registros de produtos para saúde (ANVISA). O QBuscado exibe esses dados exatamente como
          publicados pelo órgão responsável, sem agregá-los a um perfil da pessoa ou empresa além do que a
          própria fonte já disponibiliza.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="4. Seus direitos como titular de dados">
        <p>A LGPD (Art. 18) garante a quem tem dados pessoais tratados o direito de, mediante requisição:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>confirmar a existência de tratamento;</li>
          <li>acessar os dados;</li>
          <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
          <li>solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
          <li>solicitar a portabilidade dos dados a outro fornecedor;</li>
          <li>obter informação sobre com quem os dados são compartilhados;</li>
          <li>revogar o consentimento, quando o tratamento se basear nele.</li>
        </ul>
        <p>
          Como o QBuscado não coleta dados pessoais dos visitantes, a maior parte desses direitos não se
          aplica operacionalmente ao uso do site. Para dados exibidos nos resultados de consulta (publicados
          por terceiros), o canal correto para solicitar correção ou remoção é o próprio órgão que publicou a
          informação original, já que o QBuscado não é a fonte nem o controlador desses dados.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="5. Como exercer seus direitos">
        <p>
          Para dúvidas, solicitações ou para exercer algum direito previsto na LGPD em relação ao QBuscado,
          entre em contato pelos canais indicados na seção 7 abaixo.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="6. Autoridade Nacional de Proteção de Dados (ANPD)">
        <p>
          Caso não fique satisfeito com a resposta recebida, você pode registrar uma reclamação junto à{" "}
          <a
            href="https://www.gov.br/anpd/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            Autoridade Nacional de Proteção de Dados (ANPD)
          </a>
          , o órgão responsável por fiscalizar o cumprimento da LGPD no Brasil.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="7. Contato">
        <p>
          Dúvidas sobre esta página podem ser enviadas por meio do repositório do projeto no{" "}
          <a
            href="https://github.com/hugobastoss/site-qbuscado"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            GitHub
          </a>
          .
        </p>
      </SecaoLegal>
    </PaginaLegal>
  );
}
