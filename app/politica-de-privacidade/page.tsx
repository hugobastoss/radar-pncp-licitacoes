import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, SecaoLegal } from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Política de Privacidade | QBuscado",
  description: "Como o QBuscado trata dados ao pesquisar licitações públicas do PNCP.",
};

const ATUALIZADO_EM = "2 de outubro de 2026";

export default function PoliticaDePrivacidadePage() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizadoEm={ATUALIZADO_EM}>
      <SecaoLegal titulo="1. Resumo">
        <p>
          O QBuscado não exige cadastro, login ou qualquer dado pessoal para ser usado. Esta página
          explica, de forma direta, o pouco que precisamos saber para o site funcionar.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="2. Dados que não coletamos">
        <p>
          Não pedimos nome, e-mail, telefone ou qualquer outro dado pessoal. As pesquisas que você faz
          (palavras-chave, estado, município, filtros) são enviadas ao nosso servidor apenas para buscar os
          resultados no PNCP e não ficam armazenadas vinculadas a você.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="3. Armazenamento local no seu navegador">
        <p>
          Três informações podem ficar guardadas no armazenamento local do seu navegador (localStorage), só no
          seu dispositivo: a escolha entre modo claro e escuro, se o menu lateral está recolhido e as últimas
          5 empresas consultadas na tela de CNPJ (CNPJ e nome da empresa), para você voltar a elas pelo menu.
          CPFs consultados nunca são guardados. Essas informações nunca são enviadas aos nossos servidores. A
          lista de empresas pode ser apagada pelo botão &quot;Limpar&quot; no menu, e tudo pode ser apagado a
          qualquer momento limpando os dados do site no navegador.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="4. Cookies">
        <p>
          Não utilizamos cookies de rastreamento, publicidade ou análise de comportamento. Tudo o que fica
          guardado no seu navegador é o que está descrito acima.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="5. Hospedagem e infraestrutura">
        <p>
          O site é hospedado na Vercel. Como em qualquer serviço de hospedagem, informações técnicas de
          acesso (como endereço IP e horário da requisição) podem ser processadas pela infraestrutura para
          garantir segurança e funcionamento do serviço, conforme a{" "}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            política de privacidade da Vercel
          </a>
          . Não temos acesso a esses registros para fins de identificação de usuários.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="6. Dados exibidos nos resultados de pesquisa">
        <p>
          As informações exibidas nos resultados (licitações, empresas, sócios, sanções, emendas e as demais)
          são dados públicos obtidos de fontes oficiais no momento da consulta: PNCP, Receita Federal, Portal da
          Transparência (CGU), TCU, Ministério do Trabalho e Emprego, ANS, TransfereGov e registro.br, entre
          outras. Algumas dessas fontes publicam dados de pessoas físicas, como os cadastros de sanções e o
          cadastro de empregadores do Ministério do Trabalho; o site os exibe como publicados e não os guarda.
          Não são dados coletados de quem visita o site.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="7. Compartilhamento com terceiros">
        <p>
          Não vendemos, alugamos ou compartilhamos dados de visitantes com terceiros, pelo simples fato de
          não coletarmos dados pessoais além do descrito acima. O rodapé do site traz um link para um quadro
          de sugestões e relatos de bugs, hospedado na UserJot. Esse link leva a um site de terceiro,
          independente do QBuscado: qualquer informação enviada por lá (inclusive e-mail, se você optar por
          se identificar) é tratada conforme a{" "}
          <a
            href="https://userjot.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            política de privacidade da UserJot
          </a>
          , não por nós.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="8. Seus direitos (LGPD)">
        <p>
          Como não processamos dados pessoais além de informações técnicas de infraestrutura, a maior parte
          dos direitos previstos na Lei Geral de Proteção de Dados (LGPD) não se aplica operacionalmente ao
          uso deste site. Ainda assim, se quiser exercer algum direito ou tirar dúvidas, entre em contato
          pelos canais indicados abaixo. Veja a página de{" "}
          <Link href="/lgpd" className="font-medium text-primary-600 hover:underline dark:text-primary-400">
            LGPD
          </Link>{" "}
          para o detalhamento da base legal e dos seus direitos como titular.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="9. Alterações desta política">
        <p>
          Esta política pode ser atualizada conforme o site evolui. A data no topo desta página indica a
          versão vigente.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="10. Contato">
        <p>
          Dúvidas sobre privacidade podem ser enviadas por meio do repositório do projeto no{" "}
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
