# Radar Licitações

Pesquisa rápida de licitações e contratações públicas brasileiras, com dados consultados em tempo real no [PNCP](https://pncp.gov.br) (Portal Nacional de Contratações Públicas).

**Demo:** [radar-pncp-licitacoes.vercel.app](https://radar-pncp-licitacoes.vercel.app/)

> Projeto independente, sem vínculo oficial com o governo. Veja o [aviso legal](https://radar-pncp-licitacoes.vercel.app/termos-de-uso) para mais detalhes.

## Funcionalidades

- Busca por texto livre (objeto da licitação e nome do órgão), estado, município e número da licitação
- Filtros avançados por período, modalidade, portal e situação
- Pesquisas rápidas pré-configuradas para categorias comuns (medicamentos, hospitalar, EPI, vacinas, etc.)
- Resultados com detalhamento expandido (órgão, objeto, prazos, valor, link direto para o PNCP)
- Modo claro/escuro com preferência salva no navegador

## Como a busca funciona

O PNCP não expõe uma API pública com busca por texto livre — apenas consultas por data, modalidade, UF e município. Para contornar isso, o app combina duas fontes:

1. **API de busca interna do PNCP** (não documentada, usada pelo próprio [pncp.gov.br/app/editais](https://pncp.gov.br/app/editais)) — fonte primária, rápida e com busca por texto livre.
2. **API de consulta oficial do PNCP** (documentada no Manual de Integração) — fallback, usado quando a primeira falha. Como essa API exige uma modalidade por chamada, o app consulta as 13 modalidades em paralelo e agrega o resultado.

Veja [`lib/server/pncp-search-client.ts`](lib/server/pncp-search-client.ts) e [`lib/server/pncp-client.ts`](lib/server/pncp-client.ts) para os detalhes de cada cliente.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com) para componentes acessíveis (ex.: painéis animados)
- [lucide-react](https://lucide.dev) para ícones

Sem banco de dados e sem variáveis de ambiente — os dados vêm direto do PNCP a cada consulta.

## Rodando localmente

Requer Node.js 20+.

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Scripts

| Comando         | Descrição                          |
| --------------- | ----------------------------------- |
| `npm run dev`   | Servidor de desenvolvimento         |
| `npm run build` | Build de produção                   |
| `npm run start` | Sobe o build de produção            |
| `npm run lint`  | Lint com ESLint                     |

## Deploy

O projeto está hospedado na [Vercel](https://vercel.com) e faz deploy automático a partir da branch `main`.

## Licença

[MIT](LICENSE)
