# Fontes de dados públicos avaliadas

Levantamento de 30/09/2026: para cada fonte, se existe API aberta, como se acessa e se vale para o QBuscado. As APIs que o site **já usa** estão em [APIS.md](APIS.md); este documento trata das que ainda não usa.

"Testado" quer dizer que a chamada foi feita de verdade nessa data e respondeu como descrito. O resto vem de pesquisa e está marcado como "não testado".

## Resumo

Das 20 fontes avaliadas:

- **4 têm API gratuita por consulta** e dão para ligar sem banco de dados: registro.br, inscrições estaduais (via CNPJ.ws), ANS e IBGE.
- **3 já estão cobertas** pelo cadastro do CNPJ que o site consulta: Receita/CNPJ, Simples Nacional e QSA.
- **7 só oferecem arquivos para baixar.** Um deles (a "lista suja" do MTE) é pequeno o bastante para usar sem banco de dados. Os outros precisam ser importados para um banco, que o site hoje não tem.
- **6 não têm acesso aberto:** captcha, API paga ou dado sigiloso.

## Fontes com API gratuita por consulta

### registro.br (WhoIs de domínios .br) — testado

- `GET https://rdap.registro.br/domain/{dominio}` — sem chave, JSON (`application/rdap+json`).
- Devolve o titular em `entities[]` com `roles: ["registrant"]`: nome (`vcardArray`), `publicIds: [{ type: "cnpj", identifier: "00.000.000/0001-91" }]` e `legalRepresentative`. Em `events[]`: `registration`, `last changed`, `expiration`.
- Só domínios `.br`. O limite de consultas não é publicado e a resposta não traz cabeçalhos de limite: guardar em cache.
- Disponibilidade de um domínio: `GET https://brasilapi.com.br/api/registrobr/v1/{dominio}`.
- **Uso:** dono do domínio do e-mail da empresa, na ficha do CNPJ e como cruzamento no Sinapse (domínio registrado por outro CNPJ; duas empresas com domínios do mesmo dono).

### Inscrições estaduais (o que o Sintegra dá) — testado

- `GET https://publica.cnpj.ws/cnpj/{cnpj}` — sem chave, **3 consultas por minuto por IP**.
- `estabelecimento.inscricoes_estaduais[]`: `inscricao_estadual`, `ativo`, `atualizado_em`, `estado { sigla, nome }`. Traz todos os estados.
- A via oficial (Cadastro Centralizado de Contribuintes, `NFeConsultaCadastro`) exige certificado digital e-CNPJ. O Sintegra de cada estado só tem site com captcha.
- A API aberta da CNPJá, que o site já usa para SUFRAMA e e-mail, **não** devolve inscrições estaduais.
- **Uso:** seção na ficha do CNPJ.

### ANS — operadoras de planos de saúde — testado

- `GET https://www.ans.gov.br/operadoras-entity/v1/operadoras?cnpj={cnpj}` — sem chave. Paginado (`page`, `size`).
- Campos: `registro_ans`, `cnpj`, `razao_social`, `nome_fantasia`, `classificacao_sigla`, `ativa`. Detalhe em `/operadoras/{registro_ans}`.
- Reclamações, planos e demonstrações contábeis só existem como arquivos em `dadosabertos.ans.gov.br`.
- **Uso:** na ficha do CNPJ, dizer se a empresa é operadora registrada e se está ativa.

### IBGE — testado

- `https://servicodados.ibge.gov.br/api/v1/localidades/...` (municípios, UFs) e `/api/v2/cnae/subclasses/{codigo}` (descrição e hierarquia do CNAE). Sem chave.
- O site já usa o IBGE para localidades.

### Portal de Dados Abertos (dados.gov.br) — testado

- `https://dados.gov.br/dados/api/publico/conjuntos-dados` devolve **401 sem chave**. A chave é um token gerado no perfil, com login gov.br. Documentação: `https://dados.gov.br/swagger-ui/index.html`.
- É o **catálogo** de conjuntos de dados, não os dados. Serve para descobrir fontes.

## Fontes já cobertas

| Fonte | De onde vem hoje |
|---|---|
| Receita Federal — CNPJ | BrasilAPI (com minhareceita como alternativa). A API oficial é do SERPRO, paga |
| Simples Nacional | Campos `opcao_pelo_simples` e `opcao_pelo_mei` do cadastro |
| QSA | Campo `qsa` do cadastro |

## Fontes só com arquivos para baixar

| Fonte | O que publica | Tamanho e formato | Observação |
|---|---|---|---|
| MTE — "lista suja" do trabalho escravo (testado) | Cadastro de empregadores: ano, UF, nome, CNPJ/CPF, estabelecimento, trabalhadores, CNAE, datas | CSV de 87 KB, 577 linhas, separador `;`, Latin-1. Atualizado a cada semestre | `https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/areas-de-atuacao/cadastro_de_empregadores.csv`. **Cabe sem banco de dados** |
| PGFN — devedores da dívida ativa (testado) | Inscrições em dívida ativa (FGTS, previdenciária, não previdenciária) com CPF/CNPJ | Zips por trimestre; o não previdenciário tem ~1,3 GB | `https://dadosabertos.pgfn.gov.br/{ano}_trimestre_{nn}/Dados_abertos_Nao_Previdenciario.zip` (também `_Previdenciario` e `_FGTS`). Último conferido: `2026_trimestre_02`. Exige banco |
| TSE (testado) | Candidatos, bens, prestação de contas (doadores e fornecedores de campanha com CPF/CNPJ) | CSV por eleição, no catálogo CKAN `https://dadosabertos.tse.jus.br/api/3/action/package_search` | A API do DivulgaCand (`divulgacandcontas.tse.jus.br/divulga/rest/v1/...`) devolveu **403** a acesso automatizado. Exige banco |
| IBAMA (testado) | Autos de infração, embargos, apreensões | Zips de CSV no catálogo `https://dadosabertos.ibama.gov.br` (sem API de consulta) | Ex.: `.../SIFISC/auto_infracao/auto_infracao/auto_infracao_csv.zip`. Exige banco |
| CAGED (testado) | Microdados de admissões e desligamentos | FTP `ftp.mtps.gov.br/pdet/microdados/NOVO CAGED/` | Estatística anônima, sem empresa identificada |
| ANATEL (não testado) | Acessos, outorgas, prestadoras | Arquivos do plano de dados abertos | A consulta de operadora por número é da ABR Telecom, só no site com captcha |
| Procon SP (não testado) | "Evite esses sites", reclamações fundamentadas | Listas no site | Alternativa nacional: CSV do consumidor.gov.br |
| IPTU SP (não testado) | Cadastro fiscal: contribuinte, áreas, endereço, SQL | Download no GeoSampa (~3 milhões de imóveis) | Só a cidade de São Paulo. Exige banco |

## Fontes sem acesso aberto

| Fonte | Por quê |
|---|---|
| Receita Federal — CPF | Só no site, com captcha e data de nascimento. API oficial do SERPRO, paga: R$ 0,6591 por consulta até 999 por mês, caindo até R$ 0,2616 de 50 mil a 99.999. O site já consulta CPF pelo Portal da Transparência |
| Receita Federal — certidões | Só no site, com captcha. API do SERPRO, paga |
| CEF — CRF / FGTS | Só em `consulta-crf.caixa.gov.br`, com captcha. Há intermediários pagos |
| ABR Telecom | Só em `consultanumero.abrtelecom.com.br`, com captcha |
| COAF | Não há dado público por pessoa ou empresa. A lista de PEP é da CGU e o site já usa |
| CNPq Lattes | Captcha; extração só para instituições conveniadas |

## Outras APIs públicas testadas

| Fonte | Resultado |
|---|---|
| TransfereGov — `https://api.transferegov.gestao.gov.br/transferenciasespeciais/plano_acao_especial` | Funciona, sem chave (PostgREST). Filtra por CNPJ do beneficiário: `?cnpj_beneficiario_plano_acao=eq.{cnpj}`. São as transferências especiais ("emendas PIX") |
| BNDES — `https://dadosabertos.bndes.gov.br/api/3/action/datastore_search?resource_id=612faa0b-b6be-4b2c-9317-da5dc2c0b901` | Funciona: 2,38 milhões de operações de financiamento. O CNPJ vem **mascarado** (`**.*16.560/0001-**`), então a busca por empresa precisa combinar o trecho visível com o nome |
| Câmara dos Deputados — cota parlamentar | O arquivo anual baixa (`https://www.camara.leg.br/cotas/Ano-2025.csv.zip`, 7 MB) e traz o CNPJ do fornecedor. A consulta `/api/v2/deputados/{id}/despesas` voltou **vazia** nos testes: conferir de novo antes de depender dela |
| Senado — `https://legis.senado.leg.br/dadosabertos/` | Respondeu normalmente |
| Querido Diário — `https://queridodiario.ok.org.br/api/gazettes?querystring=` | Busca por texto em diários oficiais municipais. **Instável:** respondeu uma vez e depois deu erro 520 |
| CNES — `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos` | Funciona, mas **ignorou** o filtro por CNPJ |
| Banco Central (Olinda) e CVM (CKAN) | Respondem. Sem uso direto para o que o site faz hoje |

## Ordem sugerida

1. **Lista suja do MTE** — arquivo minúsculo que vira alerta na ficha do CNPJ e no Sinapse.
2. **registro.br** — dono do domínio do e-mail.
3. **Inscrições estaduais** (CNPJ.ws) — ficha do CNPJ, respeitando 3 por minuto.
4. **Emendas PIX por CNPJ** (TransfereGov).
5. **ANS por CNPJ**.

Esses cinco não precisam de chave nem de banco de dados. PGFN, TSE e IBAMA têm o maior valor investigativo, mas só funcionam importando os arquivos para um banco — o site hoje consulta tudo na hora e não guarda nada, então é uma decisão de arquitetura à parte.

## Cuidados

- **LGPD:** a lista suja inclui pessoas físicas, com CPF. É uma lista oficial pública; exibir como o governo publica, sem cruzar além disso.
- **Limites:** o registro.br não publica o dele; a CNPJ.ws limita a 3 por minuto por IP — e na Vercel o IP de saída é compartilhado, então o limite pode estourar por uso de terceiros.
- **Domínio:** em 30/09/2026 o `qbuscado.com.br` aparecia como disponível no registro.br.
