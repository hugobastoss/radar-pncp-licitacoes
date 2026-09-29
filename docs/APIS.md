# APIs externas utilizadas

Este documento lista todas as APIs de terceiros que o Radar Licitações consome, o
que cada uma faz no app, e as particularidades (nem sempre documentadas) que
descobrimos integrando com elas. Todas as chamadas acontecem no **backend**
(rotas em `app/api/*`) — o navegador nunca fala diretamente com essas APIs.

## Licitações (busca principal)

Três fontes em cascata — a segunda e a terceira só são chamadas quando a
anterior falha. Quando alguma falha, o motivo vai pro log e pra
`meta.falhas` da resposta (ex.: "Busca interna do PNCP: fetch failed
(ECONNRESET)") — é o que dá pra olhar quando a busca fica lenta e parcial. Ver `app/api/licitacoes/route.ts` para a lógica de cascata e
`lib/server/status-servicos.ts` para o health check (de todas as APIs
externas do app, não só o PNCP) que alimenta o indicador de status no
cabeçalho.

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
  independente de enviar `User-Agent` ou não (testado). Em 2026-09-29, de
  casa: 1 de 10 chamadas passou de primeira, 9 de 10 com até 3 tentativas —
  e não é a palavra buscada (o mesmo termo falha e passa em seguida). A busca
  de atas tenta até 4 vezes; esta de licitações ainda não tenta de novo.

### PNCP — atas de registro de preço (`/atas`)

| | |
|---|---|
| **Base URL** | `https://pncp.gov.br/api/search/?tipos_documento=ata` (a mesma busca interna) |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/pncp-atas-client.ts`](../lib/server/pncp-atas-client.ts) (rota `/api/atas`) |

- `status=vigente` traz só as atas em vigência (7.070 no AM em 2026-09-29).
  Sem texto, o status é obrigatório; com texto, dá pra incluir as
  encerradas.
- `item_url` vem `/atas/{cnpj}/{ano}/{sequencial}/{sequencialAta}`, que é a
  rota da página da ata em `pncp.gov.br/app` — lá estão os itens, os
  fornecedores e os preços registrados. `valor_global` e `permite_adesao`
  vieram nulos em todas as atas vistas.
- A API oficial de consulta (`/api/consulta/v1/atas`) não serve de reserva:
  só filtra por período e devolve todas as atas do país (529 mil num mês),
  sem texto nem UF.
- Por causa dos `ECONNRESET`, a rota tenta até 4 vezes (espera 250, 500 e
  750 ms entre elas) antes de desistir.

### 2. PNCP — Consulta oficial (fallback 1)

| | |
|---|---|
| **Base URL** | `https://pncp.gov.br/api/consulta/v1/contratacoes/proposta` |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/pncp-client.ts`](../lib/server/pncp-client.ts) |
| **Documentação oficial** | [Swagger da API de Consulta do PNCP](https://pncp.gov.br/api/consulta/swagger-ui/index.html) (a página de manuais em gov.br/pncp passou a exigir login em 2026) |

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
| **Base URL** | `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` (primária) e `https://minhareceita.org/{cnpj}` (fallback) |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/cnpj-client.ts`](../lib/server/cnpj-client.ts) |

Espelha o cadastro da Receita Federal (razão social, situação cadastral,
sócios, endereço, CNAE, capital social, Simples/MEI, regime tributário). A
tela também consulta as sanções (CEIS/CNEP, ver abaixo) em paralelo e mostra
tudo no mesmo resultado. Aceita `/cnpj?cnpj=...` — é assim que o "CNPJ do
órgão" das licitações abre a consulta já preenchida.

Duas fontes em cascata: a Minha Receita só é chamada quando a BrasilAPI
falha por instabilidade (rede, timeout, 5xx, 429…). As duas devolvem
**exatamente o mesmo JSON** (conferido campo a campo), então um único
mapeamento serve pras duas. Ficam em hospedagens diferentes (Vercel e
fly.io), mas é provável que a BrasilAPI repasse os dados da própria Minha
Receita — o fallback cobre queda ou bloqueio da BrasilAPI, não
necessariamente da origem dos dados.

**Particularidades:**
- A BrasilAPI bloqueia (403) requisições sem header `User-Agent` — o `fetch`
  do Node, ao contrário do navegador, não manda um por padrão. Todos os
  clientes da BrasilAPI neste projeto mandam `User-Agent: RadarLicitacoes/1.0`
  por causa disso.
- As duas fontes validam o dígito verificador: CNPJ inválido volta **400**,
  inexistente volta **404**. Os dois são respostas definitivas — não caem pro
  fallback.
- As duas já aceitam o **CNPJ alfanumérico** que a Receita emite desde julho
  de 2026 (letras nas 12 primeiras posições). O app valida e normaliza os
  dois formatos em [`lib/cnpj.ts`](../lib/cnpj.ts) — nunca descarte letras
  com `replace(/\D/g, "")` num CNPJ.
- Respostas 200 ficam **24 h no cache do Next** (`next: { revalidate }` no
  `fetch`); 404 e falhas não são guardados.
- `opcao_pelo_simples`/`opcao_pelo_mei` vêm `null` quando a empresa nunca
  optou, e `false` com `data_exclusao_*` quando já optou e saiu.
- O código do CNAE vem como número (`3514000`), sem o zero à esquerda de
  códigos como `0111-3/01`; o tipo de logradouro ("AVENIDA") vem num campo
  separado (`descricao_tipo_de_logradouro`).

### Complemento: SUFRAMA e e-mail (CNPJá)

| | |
|---|---|
| **Base URL** | `https://open.cnpja.com/office/{cnpj}` |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/cnpja-client.ts`](../lib/server/cnpja-client.ts) (rota `/api/cnpj/complemento`) |
| **Documentação oficial** | [cnpja.com/api/open](https://cnpja.com/api/open) (a página tem verificação anti-robô; abre em navegador) |

Completa o cadastro da BrasilAPI com o que ela não tem: a **inscrição
SUFRAMA** (número, situação, data e incentivos fiscais — ex.: isenção de
ICMS e IPI) e o **e-mail corporativo** (a BrasilAPI muitas vezes vem sem
e-mail; e-mails marcados como pessoais pela CNPJá ficam de fora).

**Particularidades:**
- **5 consultas por minuto por IP**, e as funções da Vercel saem por IPs
  compartilhados com outros clientes. Por isso: rota separada (falha aqui
  não derruba o cadastro), cache de 24 h, e a tela só consulta quando pode
  ganhar algo — empresa na área da SUFRAMA (AM, RO, RR, AC, AP) ou sem
  e-mail na Receita.
- Dados com **até 45 dias de atraso** (pela própria documentação); a
  resposta traz a data da última atualização (`updated`), que a tela mostra.
- Empresa sem inscrição vem com `suframa: []`.

**Fontes de SUFRAMA avaliadas antes (2026-09-28):**

| Fonte | Por que não |
|---|---|
| Consulta oficial ([www4.suframa.gov.br/cadsuf](https://www4.suframa.gov.br/cadsuf/#/menu-externo)) | reCAPTCHA conferido no servidor — não automatizável |
| Dados abertos da SUFRAMA ("Relatório de Cadastro e Credenciamento de Pessoas Jurídicas") | Parou em **31/12/2023**; só inscrição e contato, sem situação nem incentivos |
| API pública da CNPJws (`POST publica.cnpj.ws/suframa`) | Só confirma uma inscrição que você já sabe (3/min); útil pra conferir situação atual |
| SintegraWS, Infosimples, Netrin | Tempo real, mas pagas (token) |

A API pública da CNPJws (`GET publica.cnpj.ws/cnpj/{cnpj}`, 3/min) traz
**inscrições estaduais** (IE, com situação) — não usada ainda.

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

## Portal da Transparência — sanções, governo federal, CPF, emendas, convênios e empenhos (`/sancoes`, `/cnpj`, `/cpf`, `/emendas`, `/convenios`, `/empenhos-federal`)

| | |
|---|---|
| **Base URL** | `https://api.portaldatransparencia.gov.br/api-de-dados` |
| **Autenticação** | Chave gratuita (cadastro em [portaldatransparencia.gov.br/api-de-dados](https://portaldatransparencia.gov.br/api-de-dados)), enviada no header `chave-api-dados` |
| **Variável de ambiente** | `PORTAL_TRANSPARENCIA_API_KEY` |
| **Arquivo** | [`lib/server/transparencia-client.ts`](../lib/server/transparencia-client.ts) |
| **Documentação oficial** | Especificação em `api.portaldatransparencia.gov.br/v3/api-docs` (só abre com `User-Agent` de navegador) |

Oito rotas, todas em São Paulo (ver abaixo):

- **`/api/sancoes`** — CEIS (empresas inidôneas/suspensas) e CNEP (empresas
  punidas, Lei Anticorrupção), com todos os campos úteis: abrangência ("onde
  vale" o impedimento — 5 valores, de "No órgão sancionador" a "Todas as
  Esferas em todos os Poderes"), fundamentação legal, UF/esfera/poder e
  contato do órgão, multa, processo, publicação e trânsito em julgado.
  "Multa" e "Publicação extraordinária da decisão condenatória" são marcadas
  como **não impeditivas**; qualquer outro tipo (inclusive um novo) conta
  como impeditivo.
- **`/api/governo-federal`** — relação da empresa com o governo federal:
  `pessoa-juridica` (resumo de sim/não: contratos, licitações, pagamentos,
  NF-e, convênios, CEPIM…), `contratos/cpf-cnpj` e
  `despesas/recursos-recebidos` (últimos 12 meses, somados por órgão).
  Contratos e pagamentos só são consultados quando o resumo diz que existem,
  e ficam 6 h no cache do Next. Só Poder Executivo federal — não inclui
  estados e municípios. Traz também os benefícios fiscais (abaixo).
- **`/api/cpf`** (POST) — consulta de pessoa física, detalhada abaixo.
- **`/api/emendas`** e **`/api/emendas/documentos`** — emendas parlamentares e
  seus documentos, detalhados abaixo.
- **`/api/convenios`** e **`/api/empenhos-federais`** — detalhados abaixo.

### Consulta de CPF (`/api/cpf`)

Não existe API gratuita com o cadastro de um CPF na Receita (situação,
nascimento, endereço) — a consulta oficial exige data de nascimento e
captcha, e as APIs que trazem isso são pagas (Serpro e revendedores). O que
a CGU publica de graça, com a mesma chave:

| Endpoint | Parâmetro | Para quê |
|---|---|---|
| `pessoa-fisica` | `cpf` | Nome e ~30 indicadores de sim/não da relação da pessoa com o governo federal |
| `ceis`, `cnep` | `codigoSancionado` | Sanções — os mesmos endpoints da consulta de CNPJ aceitam CPF |
| `ceaf` | `cpfSancionado` | Expulsos da administração federal (demissão, destituição, cassação de aposentadoria) |
| `peps` | `cpf` | Pessoas politicamente expostas — campos em `snake_case`, diferente do resto da API |
| `servidores` | `cpf` | Vínculo de servidor, militar, aposentado ou pensionista (só quando o resumo indica) |
| `contratos/cpf-cnpj` | `cpfCnpj` | Contratos federais (só quando o resumo indica) |

**Particularidades (testado em 2026-09-28):**
- `pessoa-fisica` aceita o CPF com ou sem pontuação. CPF sem registro ou
  inválido volta **200 com corpo vazio**, igual ao `pessoa-juridica`.
- A resposta traz o **CPF já mascarado** (`***.444.777-**`) e o **nome
  completo**, em maiúsculas.
- A lista de PEPs **não tem indicador** no `pessoa-fisica` — por isso é
  consultada sempre, junto com CEIS, CNEP e CEAF (4 chamadas em paralelo
  com o resumo, ~0,8 s no total).
- O resumo também diz se a pessoa recebeu **benefícios sociais** (Bolsa
  Família, BPC, auxílio emergencial, seguro-defeso…). O app **descarta**
  esses campos: não têm a ver com contratações e são o dado mais sensível
  da resposta.
- `favorecidoCPGF`/`CPDC`/`CPCC` quer dizer que a pessoa **recebeu**
  pagamento feito com cartão do governo (entra como "recebeu pagamentos");
  `portadorCPGF`/`CPDC`, que ela **tem** o cartão.
- Os mapeamentos de CEAF, PEP e servidor foram feitos pela especificação:
  nos testes, nenhum CPF usado tinha esses registros.

**Cuidados de LGPD na rota:**
- É **POST com o CPF no corpo** — num GET o CPF ficaria na URL, e a URL vai
  pros logs da Vercel e pro histórico do navegador. A tela também não põe o
  CPF no endereço.
- **Nada é guardado:** as chamadas não usam o cache do Next (que grava a
  resposta usando a URL, com o CPF, como chave), a resposta sai com
  `Cache-Control: no-store`, e os logs de erro só têm o endpoint e o status.
- **Limite de 10 consultas por minuto por IP**, na memória da função. Sem
  isso, a rota viraria um jeito de descobrir nomes de CPFs em massa com a
  cota da nossa chave (400 chamadas/min, e cada CPF gasta de 5 a 16). Como
  cada instância da função tem o seu contador, o limite segura uso
  automatizado, não um ataque distribuído.

### Emendas parlamentares (`/api/emendas`, `/api/emendas/documentos`)

| Endpoint | Parâmetros | Para quê |
|---|---|---|
| `emendas` | `nomeAutor`, `ano`, `tipoEmenda`, `numeroEmenda`, `codigoEmenda`, `pagina` | Emendas com autor, tipo, localidade, função e os valores empenhado, liquidado, pago e de restos a pagar |
| `emendas/documentos/{codigo}` | `pagina` | Empenhos, liquidações e pagamentos da emenda — **sem valor nem favorecido** |
| `despesas/documentos/{codigo}` | — | Detalhe de um documento: valor, favorecido (CNPJ, nome, UF), órgão e observação |

A tela mostra, pra cada emenda, **quem recebeu o dinheiro**: a soma dos
pagamentos por favorecido. Conferido na `202541840004` (LUIS CARLOS
HEINZE, 2025): os três favorecidos somam 223.998,00, exatamente o pago no
ano (12.599,10) mais os restos a pagar pagos (211.398,90).

**Particularidades (testado em 2026-09-29):**
- **`nomeAutor` só casa com maiúsculas e sem acento** ("heinze" e
  "GUIMARÃES" voltam vazio), mas aceita parte do nome ("HEINZE", "BANCADA
  DO AMAZONAS", "COM. DA SAUDE"). A rota converte antes de chamar.
- `tipoEmenda` precisa do texto exato: "Emenda Individual - Transferências
  com Finalidade Definida", "Emenda Individual - Transferências Especiais"
  (a "emenda Pix"), "Emenda de Bancada", "Emenda de Comissão" ou "Emenda de
  Relator" (vazio em 2025). "Emenda Individual" sozinho traz os dois
  individuais. A lista fica em [`lib/emendas.ts`](../lib/emendas.ts).
- `numeroEmenda` aceita com ou sem zeros à esquerda ("4" = "0004"). Sem
  filtro nenhum, a API devolve todos os anos misturados; há dados de 2014 em
  diante.
- Valores vêm como texto no formato brasileiro, e **negativo com espaço**
  depois do sinal (`"- 35.865,08"`) — o empenhado de uma emenda pode ser
  negativo quando as anulações passam dos empenhos do ano. No detalhe do
  documento, a liquidação vem com valor `"-"` (a CGU não informa) e o estorno
  de pagamento, negativo.
- A lista de documentos também vem de 15 em 15 e sem ordem. Pra cada
  emenda, a rota busca até 10 páginas e o detalhe de até 40 documentos (5 de
  cada vez), pagamentos primeiro e depois empenhos. Liquidação não vale a
  chamada, porque vem sem valor. Tudo fica 6 h no cache do Next (dados
  públicos, atualizados uma vez por dia).
- Links pro Portal: `portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda=`
  e `/despesas/documento/{empenho|liquidacao|pagamento}/{codigo}`. A página
  do documento responde 202 (desafio anti-robô) pra `curl`, mas abre
  normalmente num navegador.

### Benefícios fiscais (em `/api/governo-federal`)

| Endpoint | Para quê |
|---|---|
| `renuncias-fiscais-empresas-habilitadas-beneficios-fiscais?cnpj=` | Regimes especiais em que a empresa foi habilitada (REIDI, RECAP, PADIS…), com vigência e fundamento legal |
| `renuncias-fiscais-empresas-imunes-isentas?cnpj=` | Imunidades e isenções (entidades sem fins lucrativos etc.) |
| `renuncias-valor?cnpj=` | Quanto de tributo federal a empresa deixou de pagar, por ano, tributo e tipo de renúncia |

- O indicador `beneficiadoRenunciaFiscal` do `pessoa-juridica` só cobre os
  valores: a PECEM ENERGIA é habilitada no REIDI com o indicador `false`. Por
  isso regimes e imunidades são consultados sempre (2 chamadas) e os
  valores, só com o indicador `true`.
- `renuncias-valor` tem muitas linhas por empresa da Zona Franca (Moto
  Honda: 161 linhas em 11 páginas, de 2015 a 2024; R$ 453,75 milhões em
  2024). Busca até 20 páginas. Os dados mais recentes eram de 2024 em
  setembro de 2026.
- `fruicaoVigente` vem "Sim"/"Não"; datas em DD/MM/AAAA.

### Convênios (`/api/convenios`)

- `convenios` exige um filtro de peso — período de até 1 mês, convenente,
  órgão ou localidade (`uf` ou `codigoIBGE`); sem isso, 400 com a mensagem
  "Para usar filtros em convênios, escolha…".
- **`convenente` não aceita CNPJ** (volta vazio, com ou sem pontuação) e
  só casa com o **nome completo e exato**: "MUNICIPIO DE MANAUS" acha;
  "MANAUS", "MUNICIPIO DE MAN" e "SECRETARIA DE ESTADO DE EDUCACAO" (o nome
  certo continua "…E DESPORTO ESCOLAR") não. Por isso a tela sugere o
  município.
- `dataVigenciaInicial`/`dataVigenciaFinal` filtram pelo **fim** da vigência
  e são obrigatórias em par. De hoje a 31/12/2099 = só os convênios em
  vigência (é o filtro "Só convênios em vigência" da tela). Sem ele, a CGU
  mistura convênios de 1997 com os de 2026, sem ordem.
- No `municipioConvenente.uf`, os campos vêm **trocados**: `sigla` =
  "AMAZONAS" e `nome` = "AM".
- A página do convênio no Portal é `portaldatransparencia.gov.br/convenios/{codigo}`,
  com `dimConvenio.codigo` (ex.: 999870). Com o `id` da API dá 404.

### Empenhos a receber do governo federal (`/api/empenhos-federais`, `/empenhos-federal`)

Não há endpoint com o saldo de um empenho. A rota monta o saldo assim
(testado em 2026-09-29 com a Dell, 97 empenhos, e com a I F Instalações):

1. `despesas/documentos-por-favorecido` (`fase=1`) lista os empenhos da
   empresa no ano atual e no anterior.
2. **Valor atual do empenho:** o `valor` da lista e a soma do `valorAtual`
   dos itens (`despesas/itens-de-empenho`) costumam bater, mas cada um erra
   em casos diferentes:
   - a lista não pega reforços recentes (2026NE000072: 225.239,76 na lista,
     807.743,76 de fato) nem anulações (2026NE000214, anulado inteiro,
     segue com 118.943,26);
   - os itens **somam** a "ANULAÇÃO POR BAIXA DE SALDO" em vez de subtrair
     (2025NE000284: inclusão e baixa de 73.917,60 cada, itens 147.835,20).

   Quando os dois concordam, vale; quando não, o valor sai do histórico de
   cada item (`itens-de-empenho/historico`): inclusão + reforços −
   anulações. Empenho sem itens (2025NE002012) fica com o valor da lista.
3. **Pagamentos:** `despesas/documentos-relacionados` (`fase=1`) de cada
   empenho, de qualquer ano, com data e estorno negativo. A liquidação vem
   com valor 0,00 — a CGU não informa o liquidado.
4. **Pagamento dividido:** um pagamento pode quitar mais de um empenho, e a
   relação traz o valor cheio em cada um. A divisão vem de
   `despesas/empenhos-impactados` (2024OB000219, de 146.968,15, foi
   134.582,33 pro 2023NE000559 e 12.385,82 pro 2023NE000560). É buscada
   quando o pagamento aparece em mais de um empenho da lista ou quando os
   pagamentos passam do valor do empenho.
5. **Restos a pagar:** empenho de ano anterior às vezes aparece também na
   lista de um ano seguinte, com o saldo que sobrou depois de cancelamentos
   (2024NE004989: 341.873,00, aparece em 2025 com 177.493,99 e a nota
   "CANCELAMENTO DE RESTOS A PAGAR"; 2024NE000452, cancelado inteiro, com
   0,00). Aí o saldo é esse valor menos os pagamentos feitos depois do ano
   de emissão. O histórico dos itens não mostra esse cancelamento.
6. A receber = valor atual − pagamentos (ou a regra do item 5). Resíduo de
   até R$ 1,00 conta como quitado. O que não foi pago nem está a receber
   aparece como **cancelado**.

**Limites conhecidos:**
- Um pagamento dividido com um empenho de fora da lista, que não estoure o
  valor do empenho, passa despercebido e reduz o saldo a receber.
- Custo: 2 chamadas por empenho, mais o histórico de cada item quando lista
  e itens discordam — a Dell passa de 250 chamadas na primeira consulta
  (~7 s). Por isso: até 120 empenhos analisados, cache de 6 h e limite de
  3 consultas por minuto por IP (a cota da chave é de 400/min pro app
  inteiro).
- Conferido: I F Instalações — 2025NE005117 quitado (209.999,00 empenhado e
  pago, com estorno), 2025NE000455 com 7.500,43 a receber; Dell — os 9
  casos acima batem com o histórico de cada empenho.

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
- **Recusa chamadas vindas dos servidores da Vercel nos EUA** (região
  `iad1`, a padrão): em produção a rota falhava em todas as chamadas,
  enquanto localmente funcionava. Por isso só esta rota roda em São Paulo
  (`gru1`), configurado em [`vercel.json`](../vercel.json) — vale pras oito
  rotas da CGU (`/api/sancoes`, `/api/governo-federal`, `/api/cpf`,
  `/api/emendas`, `/api/emendas/documentos`, `/api/convenios` e
  `/api/empenhos-federais`). O resto do
  projeto continua na região padrão (`iad1`): mudar tudo pra `gru1` não
  ajudou o PNCP, que em 2026-09-28 falhou a partir da Vercel nas duas regiões
  (`gru1` 11 de 11, `iad1` 5 de 5 logo depois) enquanto respondia normalmente
  de uma conexão residencial no Brasil.
- Em caso de falha, a rota devolve no campo `detalhe` o que a CGU respondeu
  (ex.: "Portal da Transparência (ceis) respondeu 401" = chave inválida) e
  registra o mesmo no log.
- Pelo mesmo motivo, o indicador de status não chama a CGU direto (a
  verificação roda nos EUA e sempre daria "indisponível"): ele testa a
  própria rota `/api/sancoes`, que é o caminho real do usuário.
- Aceita CNPJ alfanumérico em `codigoSancionado` sem erro (testado com o
  exemplo fictício da Receita, que volta vazio). Ainda não deu pra conferir
  com uma empresa alfanumérica sancionada de verdade.
- Pode demorar: chegou a ~4,5 s nos testes (outras chamadas levaram
  ~0,5 s). Por isso, na tela de CNPJ, as sanções aparecem depois do
  cadastro, com indicador de carregamento próprio.
- **Listas vêm em páginas de 15, sem ordem por data e sem informar o
  total** — só dá pra saber que acabou quando uma página vem com menos de
  15. Contratos e pagamentos buscam até 10 páginas (150 itens) em lotes
  paralelos; fornecedores grandes (ex.: Dell) passam disso e a tela avisa
  que a lista está incompleta. As sanções leem só a primeira página.
- Campo não preenchido vem como `"Sem informação"` (com ou sem maiúscula)
  ou string vazia; `dataFimSancao` sem data = sem prazo determinado (37%
  numa amostra de 75). Nenhuma sanção já encerrada apareceu na amostra — o
  cadastro parece manter só as vigentes.
- `pessoa-juridica` de um CNPJ sem registro volta **200 com corpo vazio**.
- `contratos/cpf-cnpj` exige o CNPJ **sem pontuação** (com pontuação, 400).
  Em 130 de 150 contratos da Dell, `compra.numeroProcesso` veio com lixo
  (ex.: `"-3"`) — só exibimos números com 5 dígitos ou mais.
- Limite de 400 chamadas/minuto no horário comercial (700 de madrugada).

## TCU — Consulta consolidada de pessoa jurídica (`/cnpj`, `/sancoes`)

| | |
|---|---|
| **Base URL** | `https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/{cnpj}?seEmitirPDF=false` |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/tcu-client.ts`](../lib/server/tcu-client.ts) (rota `/api/tcu/certidao`) |
| **Página oficial** | [certidoes-apf.apps.tcu.gov.br](https://certidoes-apf.apps.tcu.gov.br/) |

Numa chamada só, quatro cadastros: Licitantes Inidôneos (TCU), CNIA —
improbidade administrativa (CNJ), CEIS e CNEP (CGU). É a certidão que os
órgãos pedem na habilitação.

**Particularidades (testado em 2026-09-29):**
- `situacao` vem `NADA_CONSTA` ou `CONSTAM_REGISTROS`; quando consta,
  `observacao` resume o registro ("Impedimento/proibição de contratar com
  prazo determinado (14/05/2027) - EPA-ESTADO DO PARÁ").
- A primeira consulta de um CNPJ leva ~6 s (o TCU consulta os cadastros na
  hora); as seguintes, ~0,2 s — o TCU guarda a certidão emitida.
- `seEmitirPDF=true` traz o PDF oficial em base64 em `certidaoPDF` (~15 KB).
  A rota devolve esse PDF com `pdf=1`, pro botão "Baixar certidão".
- CNPJ com dígito errado volta **412** com `violacoes`.
- A rota roda em São Paulo por precaução, como as da CGU; não testamos se o
  TCU recusa IPs dos EUA.

## ANVISA — Consultas Externas (`/produtos-saude`, `/nome-tecnico`)

| | |
|---|---|
| **Base URL (token)** | `https://acesso.prd.apps.anvisa.gov.br/auth/realms/externo/protocol/openid-connect/token` |
| **Base URL (consultas)** | `https://api-gateway.prd.apps.anvisa.gov.br/consultas-externas-api/api/v1/` |
| **Autenticação** | OAuth2 `client_credentials` (Keycloak) — registre um app em [api.anvisa.gov.br](https://api.anvisa.gov.br) para obter `client_id`/`client_secret` |
| **Variáveis de ambiente** | `ANVISA_CLIENT_ID`, `ANVISA_CLIENT_SECRET` |
| **Arquivo** | [`lib/server/anvisa-client.ts`](../lib/server/anvisa-client.ts) |
| **Documentação oficial** | Swagger em `api-gateway.prd.apps.anvisa.gov.br/consultas-externas-api/swagger-ui/index.html` (especificação em `.../consultas-externas-api/v3/api-docs`) |

Um único gateway autenticado, usado por duas telas:

- **`/produtos-saude`** — dispositivos médicos e materiais hospitalares
  registrados. Busca por nome do produto, número de registro (11 dígitos),
  número de processo (17 dígitos) ou CNPJ da detentora — o tipo é detectado
  pelo formato em [`lib/produtos-saude.ts`](../lib/produtos-saude.ts). Um
  campo opcional de CNPJ da empresa combina com qualquer um desses (ex.: nome
  + CNPJ traz só os produtos daquela empresa). O painel de detalhe junta
  quatro endpoints:
  - `POST saude` — a busca paginada;
  - `POST saude/{processo}` — detalhe: nome técnico, classe de risco,
    fabricantes, modelos, AFE da empresa, anexos, medida cautelar;
  - `POST udi` (filtro `nuRegistro`) e `GET udi/{id}` — códigos de barras
    (GTIN) por modelo e as características de cada um (estéril, uso único,
    látex, uso leigo, ressonância). As características são buscadas sob
    demanda, uma requisição por código;
  - `POST certificado/` (filtros `cnpjCertificada` + `contexto: "certificado"`)
    — certificados de boas práticas (CBPF, CBPDA…) da empresa detentora.
- **`/nome-tecnico`** — nomenclatura técnica oficial de produtos para saúde
  (definição, categoria, classe de risco). Endpoint `nomeTecnico`. A base
  inteira é pequena (~2,7 mil nomes, ~860 KB): o servidor carrega tudo (10
  páginas em paralelo, ~0,7 s), guarda em memória por 24 h e **busca
  localmente** — palavras em qualquer ordem, sem acento, plural e singular
  equivalentes, também na definição e no código, com filtro por categoria e
  por classe de risco (que a API não filtra). Quando nenhum nome tem todas as
  palavras, a busca vira parcial e avisa na tela. Ver "Nomenclatura técnica"
  em `anvisa-client.ts`.

**Particularidades:**
- É um fluxo de dois passos: primeiro gera um token (`grant_type=client_credentials`,
  `expires_in` = 1740 s), depois usa esse token como `Bearer` na consulta. O
  token fica **guardado em memória** enquanto a instância do servidor está
  viva (economiza ~350 ms por busca); se a ANVISA recusar um token guardado
  (401), gera outro e tenta de novo, uma vez. Ver `requisitar` em
  `anvisa-client.ts`, compartilhado por todas as consultas.
- As consultas são `POST` com corpo JSON (`{page, size, filter}`), não `GET`
  com query string — resposta vem paginada no formato padrão do Spring
  (`content`, `totalElements`, `totalPages`). **O tamanho da página é
  `size`**: o `count` que aparece nos exemplos da documentação é ignorado e a
  API devolve sempre 10.
- **404 quer dizer "nenhum resultado"** (busca vazia, página além do fim,
  processo ou UDI inexistente) — não é erro. Tratar como erro fazia as telas
  mostrarem "não foi possível consultar" pra qualquer busca sem resultado.
- Filtros de `saude` conferidos ao vivo: `nomeProduto`, `numeroRegistro`,
  `numeroProcesso`, `cnpj` e `situacaoNotificacaoRegistro` (`"1"` = válidos,
  `"2"` = inválidos) — e **se combinam (E)** numa consulta só. Já `nomeProduto`
  procura o texto como **frase exata** dentro do nome: "cateter balão" traz
  674, "balão cateter" traz 1, e vários termos separados por vírgula não
  funcionam. **`registro` (sem o "numero"), `nomeTecnico`,
  `razaoSocial` e a ordenação (`sorting`, `column`) são ignorados em
  silêncio** — devolvem a base inteira (~192 mil registros) em vez de filtrar.
- "Inválido" costuma ser registro vencido (`vencimento.vencido: true`, com a
  data). E o contrário também acontece: 39 de 100 registros válidos numa
  amostra tinham `dataVencimento` no passado, mas `vencimento.descricao:
  "VIGENTE"` — nesses casos a data é descartada no mapeamento e a tela mostra
  "Vigente".
- No detalhe, os modelos vêm dentro de `apresentacoesPage` (paginado, aceita
  `size` no corpo — usamos 100). O `totalElements` dessa página conta
  **apresentações**, não modelos: uma apresentação pode ter dezenas de
  modelos.
- A base de UDI ainda é parcial (o cadastro é obrigatório aos poucos) — a
  maioria dos registros ainda não tem código.
- `nomeTecnico`: a página vai **no máximo até 300** — pedir `size: 3000`
  devolve 300 sem avisar. A busca da própria API também é por **frase
  exata** ("balão cateter" traz 0), por isso a busca é feita localmente. A
  API filtra por `categoriaProduto` (`8` = Equipamento ou Material, `12` =
  Diagnóstico in vitro; lista em `GET nomeTecnico/categorias`) e por
  `codigo` (aceita trecho), mas não por classe de risco — e a classe vem
  vazia em ~55% dos nomes; a definição (`descricao`), em ~74%.
- `nomeTecnico/download` gera um `.xls` de verdade (código, nome técnico,
  descrição, classe de risco vinculada) — não usado no app.
- Datas (`dataVencimento` etc.) vêm como **epoch milissegundos**, não string
  ISO — convertidas com `new Date(ms).toISOString()`.
- O Swagger e a especificação ficam atrás do Cloudflare e só respondem com
  `User-Agent` de navegador (403 com `RadarLicitacoes/1.0`). O portal
  `consultas.anvisa.gov.br` bloqueia navegador automatizado — por isso não
  conferimos o formato do link público de um registro e a tela não o oferece.
- Sem as variáveis de ambiente configuradas, as rotas devolvem **501**, mesmo
  padrão da consulta de sanções.
- **Nem todo endpoint documentado no Swagger funciona de verdade:**
  - `certificadoMedicamento` (Certificado de Boas Práticas de Fabricação de
    medicamentos) devolve **404** mesmo com o payload exato do exemplo da
    documentação — enquanto os endpoints de apoio dele (`/status`,
    `/classesCertificacao`) funcionam normalmente com a mesma credencial.
  - `saude/downloadPDF/{processo}` responde 200 com um PDF, mas com todos os
    campos "sem dados cadastrados".
  - Nenhum endpoint baixa os anexos do registro (instruções de uso etc.) — a
    tela só lista quais documentos existem.

## Governo do Amazonas — contratos e empenhos (`/cnpj`, `/empenhos-am`)

Duas fontes da SEFAZ-AM, usadas juntas:

1. **SGC** (contratos): quais contratos o fornecedor tem com o estado e quais
   notas de empenho pertencem a cada um. Alimenta a seção "Contratos com o
   Governo do Amazonas" da consulta de CNPJ.
2. **Portal da Transparência Fiscal** (despesa): quanto de cada nota já foi
   empenhado, liquidado e pago. Junto com o SGC, alimenta a tela
   `/empenhos-am` (empenhos a receber).

As duas rotas (`/api/am/contratos` e `/api/am/empenhos`) rodam em São
Paulo (`gru1`, ver [`vercel.json`](../vercel.json)). A varredura faz cerca de
1.000 chamadas ao SGC por CNPJ, e cada ida e volta até os EUA soma tempo. Não
testamos se a SEFAZ-AM recusa IPs dos EUA, como a CGU faz.

### SGC — Sistema de Gestão de Contratos

| | |
|---|---|
| **Base URL** | `https://sistemas.sefaz.am.gov.br/sgc-am/api/v1/` |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/am-sgc-client.ts`](../lib/server/am-sgc-client.ts) (rota `/api/am/contratos`) |
| **Documentação oficial** | Swagger na página [Dados Abertos do Portal da Transparência do AM](https://www.transparencia.am.gov.br/dados-abertos-2/) |

Todas as chamadas são `POST` com corpo `application/x-www-form-urlencoded`,
sempre com `method=ApiTransparencia` e um `tipo`:

| Endpoint | Campos | Devolve |
|---|---|---|
| `unidadegestora.do` | `nome=` (vazio = todas), `tipo=UNIDADEGESTORA` | As 127 UGs (órgãos). Todas do Executivo |
| `contrato.do` | `ug`, `ano`, `termo=` (vazio), `situacao` (`Todos` ou `Vigentes`), `tipo=CONTRATO` | Contratos e aditivos da UG no ano, com CNPJ do contratado, objeto, valores, vigência e processo |
| `empenho.do` | `ug`, `ano` e `termo` (número do contrato), `tipo=EMPENHO` | Notas de empenho do contrato, com número, ano e valor |
| `responsavel.do` | — | Responsáveis pelos contratos — não usado |

**Particularidades:**
- **Não filtra por CNPJ.** `ug` e `ano` são obrigatórios. Para achar os
  contratos de uma empresa, o cliente varre todas as UGs, filtra pelo
  `cpfCnpjContratado` e guarda cada consulta por 6 h. Com 12 chamadas em
  paralelo, cada ano varrido leva ~2 s.
- Varredura: o ano atual e o anterior com `situacao=Todos` (contrato
  encerrado ainda pode ter resto a pagar) e os 6 anos antes deles só com
  `Vigentes`.
- **Aditivo vem como outra linha**, com o mesmo `nrNumeroContrato` e
  `nrNumeroAditamento` diferente de `"0"`. O cliente agrupa por
  UG + ano + número.
- **Contrato antigo vigente só por aditivo:** com `Vigentes`, só vêm as
  linhas dos aditivos. Nelas, o `desObjetivoContrato` descreve o aditivo ("O
  presente Termo Aditivo tem por objetivo prorrogar…"), e o `nmTermo` é o do
  aditivo ("3º TACT 10/2023"). Nesse caso o cliente consulta o ano inteiro
  daquela UG (`Todos`) para recuperar a linha original.
- **Nem todo "contrato" é contrato:** compra pequena formalizada só por nota
  de empenho aparece com termo `NE 367/2025`.
- Sem resultado vem como **HTTP 204**, sem corpo.
- Erro de validação vem como `[{"erro": "..."}]`, com status 200 ou 500.
- Datas vêm como `AAAAMMDD`; o código da UG tem 6 dígitos (`017101`).
- **O mesmo empenho pode aparecer duas vezes no mesmo contrato** (ex.: CT
  15/2026 da FESP, `2026NE0000071`). O app soma o valor e conta a nota uma
  vez só, senão os totais dobram.
- O número da nota vem sem o ano nem o prefixo. O app monta o formato do
  portal da SEFAZ: `${anoEmpenho}NE${numero com 7 dígitos}` →
  `2026NE0001718`.

### Portal da Transparência Fiscal — valores de cada nota

| | |
|---|---|
| **Base URL** | `https://sistemas.sefaz.am.gov.br/transpprd/mnt/despesa/` |
| **Autenticação** | Nenhuma |
| **Arquivo** | [`lib/server/am-sefaz-despesa-client.ts`](../lib/server/am-sefaz-despesa-client.ts) e [`lib/server/am-empenhos.ts`](../lib/server/am-empenhos.ts) (rota `/api/am/empenhos`) |
| **Documentação** | Nenhuma — scraping de HTML. Levantamento completo em [SEFAZ-AM-TRANSPARENCIA.md](SEFAZ-AM-TRANSPARENCIA.md) |

Um GET em `execDespAnoPoderUg.do` por UG traz todas as notas do ano, com
empenhado, liquidado e pago. O app baixa só as UGs onde o fornecedor tem
contrato (1–5 MB cada, guardadas por 1 h) e cruza com as notas do SGC.

**Particularidades:**
- **`Accept-Language` muda o formato dos números.** O `fetch` do Node manda
  `Accept-Language: *`, e aí o portal responde `123,600.00` (formato
  americano) em vez de `123.600,00`. Tratar como brasileiro dá 123,6. O
  cliente manda `pt-BR` e ainda lê os dois formatos (o último `.` ou `,` é
  a vírgula decimal).
- **Reforço some da lista.** Nota de reforço é somada à nota original no
  portal. A nota do SGC que não aparece no ano corrente fica como "não
  encontrada", e a tela explica que provavelmente é um reforço (ex.:
  `2026NE0003452` do CT 8/2026 da SUSAM).
- **Resto a pagar** (nota de ano anterior) só tem valores nas colunas "Pago
  Exercício Anterior" e "A Pagar Exercício Anterior". Nota de ano anterior
  que não está na lista não tem mais saldo (quitada ou cancelada).
- A receber = `Empenhado − Pago` nas notas do ano mais `A Pagar Exercício
  Anterior` nos restos a pagar. Os totais separam o pago no ano do pago de
  restos a pagar, senão o pago passa do liquidado.
- Conferido à mão com o CT 8/2026 da SUSAM (X-BRASIL LTDA): as notas
  `2026NE0001718` (123.600,00 empenhado, 58.400,00 pago) e `2026NE0000349`
  (153.100,00 empenhado, 58.400,00 pago) somam **159.900,00** a receber,
  com 52.000,00 já liquidados.

### Avaliada e não usada: e-Compras AM (licitações)

`https://www.e-compras.am.gov.br/publico/api/` (`Consulta_UG.asp`,
`Licitacao_Consulta.asp`, `Dispensas_Inexigibilidade_Consulta.asp`,
`Atas_Proprias_Consulta.asp`), da mesma página de dados abertos. Ficou de
fora porque:
- é lenta (8–9 s por chamada);
- usa código de UG com 5 dígitos, diferente do SGC;
- mistura formatos de número;
- traz o CNPJ do vencedor dentro do nome da empresa, não num campo próprio.

Pela Lei 14.133, as licitações do estado também devem ser publicadas no PNCP, que o app já consulta.

## IBGE — Localidades (só geração de dados, não roda em produção)

| | |
|---|---|
| **Base URL** | `https://servicodados.ibge.gov.br/api/v1/localidades/municipios` |
| **Autenticação** | Nenhuma |

Usada uma única vez para gerar [`lib/data/municipios.ts`](../lib/data/municipios.ts)
(os 5.571 municípios brasileiros, todos os 27 estados) como dado estático.
Não é chamada pelo app em tempo de execução — só re-execute a consulta se o
IBGE criar um novo município.
