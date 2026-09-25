# Próximos passos

Itens já decididos/avaliados, mas ainda não implementados.

## Base de Medicamentos (ANVISA) como arquivo estático local

**Decisão:** gerar um arquivo estático via script, no mesmo padrão já usado em
[`lib/data/municipios.ts`](../lib/data/municipios.ts) — não usar backend SQL
nem Google Sheets.

**Contexto:** a ANVISA publica um export bruto em
`https://dados.anvisa.gov.br/dados/CONSULTAS/PRODUTOS/TA_CONSULTA_MEDICAMENTOS.CSV`
(~46.662 linhas, `;`-separado, encoding Latin-1/ISO-8859-1, ~40 colunas).
Avaliamos usar uma planilha do Google como datastore leve (leitura via
`gviz/tq` pública, sem chave), mas isso exigiria service account + Vercel Cron
para manter atualizado — infraestrutura nova só pra isso. Optamos por algo
mais simples e manual.

**Plano:**
- Script (ex.: `scripts/gerar-medicamentos.ts`) baixa o CSV, corrige o
  encoding para UTF-8, mantém só as colunas úteis (produto, CNPJ, razão
  social, registro, situação, vencimento, processo) e grava um JSON local.
- Nova rota (ex.: `/api/medicamentos`, tela `/medicamentos`) lê esse arquivo
  do disco em runtime (`fs.readFileSync`, não `import` estático — pra não
  inflar o bundle de toda função serverless) e busca em memória.
- Atualização é manual: rodar o script de novo e commitar quando quiser dados
  mais recentes. Sem cron, sem service account, sem infraestrutura nova.

**Fora de escopo:** Cosméticos (mesma fonte ANVISA) tem 526.730 linhas — não
caberia numa planilha nem faria sentido como arquivo estático do mesmo jeito.

**Status:** avaliado e decidido, não implementado.

## Empenhos a receber — SEFAZ-AM

**Decisão:** usar o Portal da Transparência Fiscal da SEFAZ-AM pra consultar
empenhos a receber de alguns órgãos do Amazonas.

**Contexto:** não é uma API — são páginas HTML (Struts), consumidas por
scraping, sem login nem sessão. O levantamento completo (endpoints,
parâmetros, colunas, cálculo do saldo e pegadinhas) está em
[SEFAZ-AM-TRANSPARENCIA.md](SEFAZ-AM-TRANSPARENCIA.md).

**Plano:** ver a seção "Esboço da implementação futura" daquele documento.
Um GET por órgão traz todos os empenhos do ano com empenhado, liquidado e
pago; o CNPJ do credor só vem no detalhe de cada empenho.

**Status:** avaliado e documentado, não implementado.
