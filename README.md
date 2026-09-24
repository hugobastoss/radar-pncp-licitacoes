# Radar Licitações

Pesquisa rápida de licitações e contratações públicas brasileiras, com dados consultados em tempo real no [PNCP](https://pncp.gov.br) (Portal Nacional de Contratações Públicas).

**Demo:** [radar-pncp-licitacoes.vercel.app](https://radar-pncp-licitacoes.vercel.app/)

> Projeto independente, sem vínculo oficial com o governo. Veja o [aviso legal](https://radar-pncp-licitacoes.vercel.app/termos-de-uso) para mais detalhes.

## Funcionalidades

- Busca de licitações por texto livre (objeto e nome do órgão), estado, município e número
- Filtros avançados por período, modalidade, portal e situação
- Pesquisas rápidas pré-configuradas para categorias comuns (medicamentos, hospitalar, EPI, vacinas, etc.)
- Consulta de CNPJ, CEP, NCM, sanções (CEIS/CNEP), produtos para saúde e nomenclatura técnica (ANVISA), cada uma em sua própria tela
- Modo claro/escuro com preferência salva no navegador

## Como a busca de licitações funciona

O PNCP não expõe uma API pública com busca por texto livre — apenas consultas por data, modalidade, UF e município. Para contornar isso, e para não depender de uma única fonte, o app combina três APIs em cascata (cada uma só é chamada se a anterior falhar):

1. **API de busca interna do PNCP** (não documentada) — fonte primária, rápida e com busca por texto livre.
2. **API de consulta oficial do PNCP** (documentada no Manual de Integração) — exige modalidade e data, sem busca por texto; consulta as 13 modalidades em paralelo.
3. **API de Dados Abertos do Compras.gov.br** — último recurso, infraestrutura independente do pncp.gov.br, usada quando as duas fontes acima falham juntas.

Veja [`docs/APIS.md`](docs/APIS.md) para o detalhamento de todas as APIs externas usadas no projeto (licitações, CNPJ, CEP, NCM e sanções), incluindo particularidades e pegadinhas descobertas em cada uma.

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

Só as telas de sanções e produtos para saúde precisam delas — as demais funcionam sem nenhuma configuração.

| Variável | Obrigatória? | Descrição |
| --- | --- | --- |
| `PORTAL_TRANSPARENCIA_API_KEY` | Não (sem ela, `/sancoes` mostra "não configurado") | Chave gratuita, cadastro em [portaldatransparencia.gov.br/api-de-dados](https://portaldatransparencia.gov.br/api-de-dados) |
| `ANVISA_CLIENT_ID` / `ANVISA_CLIENT_SECRET` | Não (sem elas, `/produtos-saude` mostra "não configurado") | Registre um app em [api.anvisa.gov.br](https://api.anvisa.gov.br) |

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

## Licença

[MIT](LICENSE)
