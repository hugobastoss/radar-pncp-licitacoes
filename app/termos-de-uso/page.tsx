import type { Metadata } from "next";
import { PaginaLegal, SecaoLegal } from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Termos de Uso | Radar Licitações",
  description: "Condições de uso do Radar Licitações, ferramenta independente de pesquisa de licitações públicas do PNCP.",
};

const ATUALIZADO_EM = "22 de setembro de 2026";

export default function TermosDeUsoPage() {
  return (
    <PaginaLegal titulo="Termos de Uso" atualizadoEm={ATUALIZADO_EM}>
      <SecaoLegal titulo="1. Sobre o Radar Licitações">
        <p>
          O Radar Licitações é uma ferramenta gratuita e independente para pesquisa de licitações e
          contratações públicas. Ele não é um serviço oficial do governo brasileiro e não possui qualquer
          vínculo institucional com o Portal Nacional de Contratações Públicas (PNCP) ou com qualquer órgão
          público.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="2. Origem e natureza dos dados">
        <p>
          Todas as licitações, contratações e informações de órgãos exibidas neste site são consultadas
          diretamente nas bases públicas do PNCP no momento da pesquisa. Não armazenamos nem alteramos o
          conteúdo dessas informações, apenas as organizamos para facilitar a busca.
        </p>
        <p>
          Não garantimos que os dados exibidos estejam completos, atualizados ou livres de erros, já que
          dependem da disponibilidade e da exatidão das fontes públicas consultadas. Antes de tomar qualquer
          decisão, participar de uma licitação ou contar com um prazo, sempre confirme as informações
          diretamente no PNCP através do link &quot;Abrir no PNCP&quot; disponível em cada resultado.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="3. Uso permitido">
        <p>
          O uso do site é livre e gratuito para fins de consulta e pesquisa. Não é permitido utilizar meios
          automatizados para extrair dados em volume que comprometam a disponibilidade do serviço para outros
          usuários.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="4. Isenção de responsabilidade">
        <p>
          O Radar Licitações é fornecido &quot;como está&quot;, sem garantias de qualquer tipo, incluindo
          disponibilidade contínua, ausência de erros ou adequação a uma finalidade específica. Não nos
          responsabilizamos por decisões tomadas, prazos perdidos ou prejuízos de qualquer natureza
          decorrentes do uso das informações exibidas neste site.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="5. Propriedade">
        <p>
          A interface, o design e o código do Radar Licitações pertencem ao projeto. Os dados de licitações,
          órgãos e contratações são informações públicas de titularidade da administração pública,
          disponibilizadas por meio do PNCP.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="6. Alterações">
        <p>
          Este serviço pode ser alterado, suspenso ou descontinuado a qualquer momento, sem aviso prévio.
          Estes termos também podem ser atualizados; a data no topo desta página indica a versão vigente.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="7. Contato">
        <p>
          Dúvidas sobre estes termos podem ser enviadas por meio do repositório do projeto no{" "}
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
