# Radar Licitações

Pesquisa rápida de licitações e contratações públicas brasileiras, com dados consultados em tempo real no [PNCP](https://pncp.gov.br) (Portal Nacional de Contratações Públicas).

**Demo:** [radar-pncp-licitacoes.vercel.app](https://radar-pncp-licitacoes.vercel.app/)

> Projeto independente, sem vínculo oficial com o governo. Veja o [aviso legal](https://radar-pncp-licitacoes.vercel.app/termos-de-uso) para mais detalhes.

## Funcionalidades

- Busca de licitações por texto livre (objeto e nome do órgão), estado, município e número, com acesso aos documentos do edital
- Filtros avançados por período, modalidade, portal e situação
- Pesquisas rápidas pré-configuradas para categorias comuns (medicamentos, hospitalar, EPI, vacinas, etc.)
- Consulta de CNPJ com cadastro da Receita Federal, sanções (CEIS/CNEP), relação com o governo federal (contratos e pagamentos), contratos com o Governo do Amazonas e inscrição SUFRAMA
- Empenhos a receber do Governo do Amazonas: contratos do fornecedor e quanto de cada nota de empenho já foi liquidado e pago
- Consulta de CPF: nome, sanções (CEIS, CNEP e CEAF), pessoa politicamente exposta (PEP), vínculo de servidor federal e contratos federais
- Consulta de sanções (CEIS/CNEP) com abrangência, fundamentação legal e se a sanção impede contratar
- Consulta de produtos para saúde na ANVISA (registro, fabricante, modelos, códigos de barras UDI e certificados de boas práticas) e da nomenclatura técnica
- Consulta de CEP e NCM
- Indicador de status das fontes de dados no cabeçalho
- Modo claro/escuro com preferência salva no navegador

## APIs utilizadas

Todas as chamadas acontecem no servidor (rotas em `app/api/*`) — o navegador nunca fala direto com as APIs externas.

| API | Para que serve no app | Autenticação |
| --- | --- | --- |
| [PNCP](https://pncp.gov.br) — busca interna (`/api/search`) | Busca de licitações — fonte primária, com texto livre | Nenhuma |
| [PNCP](https://pncp.gov.br/api/consulta/swagger-ui/index.html) — consulta oficial (`/api/consulta/v1`) | Busca de licitações — primeira reserva | Nenhuma |
| [PNCP](https://pncp.gov.br/api/pncp/swagger-ui/index.html) — arquivos (`/api/pncp/v1`) | Documentos do edital de cada licitação | Nenhuma |
| [Compras.gov.br — Dados Abertos](https://dadosabertos.compras.gov.br) | Busca de licitações — segunda reserva | Nenhuma |
| [BrasilAPI](https://brasilapi.com.br) — CNPJ | Cadastro da empresa (Receita Federal) | Nenhuma |
| [Minha Receita](https://minhareceita.org) | Reserva da BrasilAPI no CNPJ (mesmo formato de resposta) | Nenhuma |
| [CNPJá](https://cnpja.com/api/open) — API aberta | Inscrição SUFRAMA (situação e incentivos fiscais) e e-mail corporativo | Nenhuma (5 consultas/min por IP) |
| [Portal da Transparência (CGU)](https://portaldatransparencia.gov.br/api-de-dados) | Sanções CEIS/CNEP; resumo, contratos e pagamentos federais da empresa; consulta de CPF (nome, sanções, CEAF, PEP, servidor, contratos) | Chave gratuita |
| [SGC — Sistema de Gestão de Contratos (SEFAZ-AM)](https://www.transparencia.am.gov.br/dados-abertos-2/) | Contratos da empresa com o Governo do Amazonas e as notas de empenho de cada contrato | Nenhuma |
| [Portal da Transparência Fiscal (SEFAZ-AM)](https://sistemas.sefaz.am.gov.br/transpprd/mnt/despesa/execDespAno.do?method=Pesquisar&filter=&anoexercicio=2026&grupo=1&consulta=1&mes=00&detNatureza=N) — sem API, lido do HTML | Empenhado, liquidado e pago de cada nota de empenho (empenhos a receber) | Nenhuma |
| [BrasilAPI](https://brasilapi.com.br) — CEP | Consulta de CEP | Nenhuma |
| [BrasilAPI](https://brasilapi.com.br) — NCM | Consulta de NCM | Nenhuma |
| [ANVISA — Consultas Externas](https://api.anvisa.gov.br) | Produtos para saúde (busca, detalhe, UDI, certificados) e nomenclatura técnica | OAuth2 (client ID e secret) |
| [IBGE — Localidades](https://servicodados.ibge.gov.br/api/docs/localidades) | Gerou a lista estática de municípios (`lib/data/municipios.ts`) — não é chamada pelo app | Nenhuma |

### Como a busca de licitações funciona

O PNCP não expõe uma API pública com busca por texto livre — apenas consultas por data, modalidade, UF e município. Para contornar isso, e para não depender de uma única fonte, o app combina três APIs em cascata (cada uma só é chamada se a anterior falhar):

1. **API de busca interna do PNCP** (não documentada) — fonte primária, rápida e com busca por texto livre.
2. **API de consulta oficial do PNCP** (documentada no Manual de Integração) — exige modalidade e data, sem busca por texto; consulta as 13 modalidades em paralelo.
3. **API de Dados Abertos do Compras.gov.br** — último recurso, infraestrutura independente do pncp.gov.br, usada quando as duas fontes acima falham juntas.

Quando uma fonte falha, o motivo vai pro log e pro campo `meta.falhas` da resposta.

Veja [`docs/APIS.md`](docs/APIS.md) para o detalhamento de cada API — parâmetros, limites e as particularidades e pegadinhas descobertas testando cada uma.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com) para componentes acessíveis (ex.: painéis animados)
- [lucide-react](https://lucide.dev) para ícones

Sem banco de dados — os dados vêm direto das APIs externas a cada consulta (ver [`docs/APIS.md`](docs/APIS.md)).

## Rodando localmente

Requer Node.js 20+.

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Variáveis de ambiente

Só as consultas à CGU e à ANVISA precisam delas — o resto funciona sem nenhuma configuração.

| Variável | Obrigatória? | Descrição |
| --- | --- | --- |
| `PORTAL_TRANSPARENCIA_API_KEY` | Não (sem ela, `/sancoes`, `/cpf` e as seções de sanções e governo federal do `/cnpj` mostram "não configurado") | Chave gratuita, cadastro em [portaldatransparencia.gov.br/api-de-dados](https://portaldatransparencia.gov.br/api-de-dados) |
| `ANVISA_CLIENT_ID` / `ANVISA_CLIENT_SECRET` | Não (sem elas, `/produtos-saude` e `/nome-tecnico` mostram "não configurado") | Registre um app em [api.anvisa.gov.br](https://api.anvisa.gov.br) |

Crie um `.env.local` na raiz do projeto (já está no `.gitignore`) com:

```
PORTAL_TRANSPARENCIA_API_KEY=sua-chave-aqui
ANVISA_CLIENT_ID=seu-client-id
ANVISA_CLIENT_SECRET=seu-client-secret
```

### Scripts

| Comando         | Descrição                          |
| --------------- | ----------------------------------- |
| `npm run dev`   | Servidor de desenvolvimento         |
| `npm run build` | Build de produção                   |
| `npm run start` | Sobe o build de produção            |
| `npm run lint`  | Lint com ESLint                     |

## Deploy

O projeto está hospedado na [Vercel](https://vercel.com) e faz deploy automático a partir da branch `main`.

As funções rodam em Washington (`iad1`, o padrão da Vercel), exceto as rotas que consultam o Portal da Transparência (`/api/sancoes`, `/api/governo-federal` e `/api/cpf`) e a SEFAZ-AM (`/api/am/contratos` e `/api/am/empenhos`), que rodam em São Paulo (`gru1`). A CGU recusa chamadas vindas dos servidores da Vercel nos EUA. As consultas à SEFAZ-AM fazem cerca de mil chamadas por CNPJ, e ficam mais rápidas perto do Brasil. A configuração fica em [`vercel.json`](vercel.json).

## Licença

[MIT](LICENSE)
