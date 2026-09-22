import type { Metadata } from "next";
import { PaginaLegal, SecaoLegal } from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Política de Privacidade | Radar Licitações",
  description: "Como o Radar Licitações trata dados ao pesquisar licitações públicas do PNCP.",
};

const ATUALIZADO_EM = "22 de setembro de 2026";

export default function PoliticaDePrivacidadePage() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizadoEm={ATUALIZADO_EM}>
      <SecaoLegal titulo="1. Resumo">
        <p>
          O Radar Licitações não exige cadastro, login ou qualquer dado pessoal para ser usado. Esta página
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

      <SecaoLegal titulo="3. Preferência de tema (armazenamento local)">
        <p>
          A escolha entre modo claro e escuro é salva apenas no armazenamento local do seu navegador
          (localStorage), no seu próprio dispositivo. Essa informação nunca é enviada aos nossos servidores e
          pode ser apagada a qualquer momento limpando os dados do site no navegador.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="4. Cookies">
        <p>
          Não utilizamos cookies de rastreamento, publicidade ou análise de comportamento. O único dado
          guardado no seu navegador é a preferência de tema descrita acima.
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
          As informações de licitações, órgãos e CNPJs exibidas nos resultados são dados públicos obtidos
          diretamente do PNCP. Não são dados pessoais coletados de quem visita o site.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="7. Compartilhamento com terceiros">
        <p>
          Não vendemos, alugamos ou compartilhamos dados de visitantes com terceiros, pelo simples fato de
          não coletarmos dados pessoais além do descrito acima.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="8. Seus direitos (LGPD)">
        <p>
          Como não processamos dados pessoais além de informações técnicas de infraestrutura, a maior parte
          dos direitos previstos na Lei Geral de Proteção de Dados (LGPD) não se aplica operacionalmente ao
          uso deste site. Ainda assim, se quiser exercer algum direito ou tirar dúvidas, entre em contato
          pelos canais indicados abaixo.
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
            href="https://github.com/hugobastoss/radar-pncp-licitacoes"
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
