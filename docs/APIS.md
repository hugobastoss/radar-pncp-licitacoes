# APIs externas utilizadas

Este documento lista todas as APIs de terceiros que o Radar Licitações consome, o
que cada uma faz no app, e as particularidades (nem sempre documentadas) que
descobrimos integrando com elas. Todas as chamadas acontecem no **backend**
(rotas em `app/api/*`) — o navegador nunca fala diretamente com essas APIs.

## Licitações (busca principal)

Três fontes em cascata — a segunda e a terceira só são chamadas quando a
anterior falha. Ver `app/api/licitacoes/route.ts` para a lógica de cascata e
`lib/server/pncp-status.ts` para o health check que alimenta o indicador de
status no cabeçalho.

### 1. PNCP — Busca interna (fonte primária)

| | |
|---|---|
| **Base URL** | `https://pncp.gov.br/api/search/` |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/pncp-search-client.ts`](../lib/server/pncp-search-client.ts) |
| **Documentação oficial** | Nenhuma — é a API interna que sustenta [pncp.gov.br/app/editais](https://pncp.gov.br/app/editais), descoberta por engenharia reversa |

A única das três fontes com busca por texto livre e resposta rápida. Por não
ser um contrato público, pode mudar sem aviso.

**Particularidades descobertas:**
- O parâmetro `q` **vazio ou ausente retorna 400** — mandamos um espaço em
  branco quando não há termo de busca.
- Não filtra por data nenhuma (nem abertura, nem encerramento) — o filtro de
  período é sempre reforçado depois, em `route.ts`.
- Não devolve `linkSistemaOrigem` (portal de origem) nem o código IBGE real do
  município.
- O campo `item_url` retornado vem no formato `/compras/{cnpj}/{ano}/{seq}`,
  que **não existe mais no PNCP** (dá 404). Reconstruímos o link como
  `/app/editais/{cnpj}/{ano}/{seq}`, que funciona.
- Instável: falha por reset de conexão (`ECONNRESET`) com frequência,
  independente de enviar `User-Agent` ou não (testado).

### 2. PNCP — Consulta oficial (fallback 1)

| | |
|---|---|
| **Base URL** | `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta` |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/pncp-client.ts`](../lib/server/pncp-client.ts) |
| **Documentação oficial** | [Manual das APIs de Consulta do PNCP](https://www.gov.br/pncp/pt-br/central-de-conteudo/manuais) |

**Particularidades:**
- Exige `codigoModalidadeContratacao` e `dataFinal` obrigatórios — sem busca
  por texto. Quando o usuário não escolhe uma modalidade, consultamos as 13
  modalidades oficiais em paralelo.
- O endpoint (`.../proposta`) só lista propostas com prazo em aberto — não
  devolve licitações já encerradas, mesmo sem pedir isso explicitamente.
- Também instável, no mesmo padrão da fonte primária.

### 3. Compras.gov.br — Dados Abertos (fallback 2, último recurso)

| | |
|---|---|
| **Base URL** | `https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133` |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/compras-client.ts`](../lib/server/compras-client.ts) |
| **Documentação oficial** | Swagger em `dadosabertos.compras.gov.br/swagger-ui/index.html` |

Infraestrutura **independente** do pncp.gov.br, com os mesmos dados (Lei
14.133) — usada só quando as duas fontes acima falham juntas, algo que já
aconteceu várias vezes durante o desenvolvimento.

**Particularidades:**
- Exige `dataPublicacaoPncpInicial`/`dataPublicacaoPncpFinal` (período de
  **publicação**, não de encerramento da proposta) + `codigoModalidade`.
  Buscamos uma janela de 90 dias de publicação e deixamos o filtro de
  encerramento do `route.ts` fazer o corte fino.
- Só cerca de 44% dos registros vêm com `dataEncerramentoPropostaPncp`
  preenchida — o restante é descartado pelo mesmo filtro de data que já se
  aplica às outras fontes (não é regressão, é a mesma regra de sempre).
- `tamanhoPagina` precisa estar entre 10 e 500.

## Consulta de CNPJ (`/cnpj`)

| | |
|---|---|
| **Base URL** | `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/cnpj-client.ts`](../lib/server/cnpj-client.ts) |

Espelha o cadastro básico da Receita Federal (razão social, situação
cadastral, sócios, endereço, CNAE, capital social).

**Particularidade:** a BrasilAPI bloqueia (403) requisições sem header
`User-Agent` — o `fetch` do Node, ao contrário do navegador, não manda um por
padrão. Todos os clientes da BrasilAPI neste projeto mandam
`User-Agent: RadarLicitacoes/1.0` por causa disso.

## Consulta de CEP (`/cep`)

| | |
|---|---|
| **Base URL** | `https://brasilapi.com.br/api/cep/v2/{cep}` |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/cep-client.ts`](../lib/server/cep-client.ts) |

Agrega várias fontes (Correios, ViaCEP, WideNet) e devolve a primeira que
responder. Mesma pegadinha do `User-Agent` acima.

## Consulta de NCM (`/ncm`)

| | |
|---|---|
| **Base URL** | `https://brasilapi.com.br/api/ncm/v1` |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/ncm-client.ts`](../lib/server/ncm-client.ts) |

Classificação de mercadorias (Nomenclatura Comum do Mercosul).

**Particularidade:** o parâmetro `search` só casa com a **descrição**, nunca
com o código — buscar `search=3004.90.99` devolve vazio. Por isso a rota
detecta se o termo parece um código (`/v1/{codigo}`, busca exata) ou uma
palavra-chave (`/v1?search=`, busca por texto) e usa o endpoint certo.

## Consulta de sanções — CEIS/CNEP (`/sancoes`)

| | |
|---|---|
| **Base URL** | `https://api.portaldatransparencia.gov.br/api-de-dados` |
| **Autenticação** | Chave gratuita (cadastro em [portaldatransparencia.gov.br/api-de-dados](https://portaldatransparencia.gov.br/api-de-dados)), enviada no header `chave-api-dados` |
| **Variável de ambiente** | `PORTAL_TRANSPARENCIA_API_KEY` |
| **Arquivo** | [`lib/server/transparencia-client.ts`](../lib/server/transparencia-client.ts) |

Consulta o CEIS (empresas inidôneas/suspensas) e o CNEP (empresas punidas,
Lei Anticorrupção) da CGU.

**Particularidades descobertas testando com uma chave real:**
- A API **migrou de domínio**: `portaldatransparencia.gov.br` só devolve um
  redirecionamento em texto plano; o domínio certo é
  `api.portaldatransparencia.gov.br`.
- O parâmetro de filtro correto é **`codigoSancionado`**, não `cpfCnpj` (que
  seria o nome mais intuitivo) — usar o nome errado não dá erro, só ignora o
  filtro silenciosamente e devolve registros aleatórios.
- Tem proteção anti-bot (AWS WAF) que bloqueia requisições sem `User-Agent`
  de navegador, mesmo com uma chave de API válida.
- Sem a variável de ambiente configurada, `app/api/sancoes/route.ts` devolve
  **501** de propósito, em vez de tentar chamar a API sem chave.

## ANVISA — Consultas Externas (`/produtos-saude`, `/nome-tecnico`)

| | |
|---|---|
| **Base URL (token)** | `https://acesso.prd.apps.anvisa.gov.br/auth/realms/externo/protocol/openid-connect/token` |
| **Base URL (consultas)** | `https://api-gateway.prd.apps.anvisa.gov.br/consultas-externas-api/api/v1/` |
| **Autenticação** | OAuth2 `client_credentials` (Keycloak) — registre um app em [api.anvisa.gov.br](https://api.anvisa.gov.br) para obter `client_id`/`client_secret` |
| **Variáveis de ambiente** | `ANVISA_CLIENT_ID`, `ANVISA_CLIENT_SECRET` |
| **Arquivo** | [`lib/server/anvisa-client.ts`](../lib/server/anvisa-client.ts) |

Um único gateway autenticado com duas consultas integradas até agora:

- **`/produtos-saude`** — dispositivos médicos e materiais hospitalares
  registrados, por nome do produto (fabricante, registro, situação,
  vencimento). Endpoint `saude`.
- **`/nome-tecnico`** — nomenclatura técnica oficial de produtos para saúde
  (categoria, classe de risco). Endpoint `nomeTecnico`.

**Particularidades:**
- É um fluxo de dois passos: primeiro gera um token (`grant_type=client_credentials`,
  expira em ~29 min), depois usa esse token como `Bearer` na consulta —
  geramos um token novo a cada busca, dado o volume baixo esperado (não vale
  a complexidade de cachear entre invocações serverless). Ver `consultarPaginado`
  em `anvisa-client.ts`, compartilhado pelas duas consultas.
- As consultas são `POST` com corpo JSON (`{page, size/count, filter}`), não
  `GET` com query string — resposta vem paginada no formato padrão do Spring
  (`content`, `totalElements`, `totalPages`).
- Datas (`dataVencimento` etc., em `saude`) vêm como **epoch milissegundos**,
  não string ISO — convertidas com `new Date(ms).toISOString()`.
- Sem as variáveis de ambiente configuradas, as rotas devolvem **501**, mesmo
  padrão da consulta de sanções.
- **Nem todo endpoint documentado no Swagger está de fato roteado**: testamos
  `certificadoMedicamento` (busca de Certificado de Boas Práticas de
  Fabricação) e ele devolve **404** mesmo com o payload exato do exemplo da
  documentação — enquanto os endpoints de apoio dele (`/status`,
  `/classesCertificacao`) funcionam normalmente com a mesma credencial. Não
  integrado por não ser possível validar que funciona de verdade.

## IBGE — Localidades (só geração de dados, não roda em produção)

| | |
|---|---|
| **Base URL** | `https://servicodados.ibge.gov.br/api/v1/localidades/municipios` |
| **Autenticação** | Nenhuma |

Usada uma única vez para gerar [`lib/data/municipios.ts`](../lib/data/municipios.ts)
(os 5.571 municípios brasileiros, todos os 27 estados) como dado estático.
Não é chamada pelo app em tempo de execução — só re-execute a consulta se o
IBGE criar um novo município.
