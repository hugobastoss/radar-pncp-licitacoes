import { formatarCnpj, formatarMoeda } from "@/lib/formatters";
import type { ComplementoCnpj, Empresa } from "@/types/cnpj";
import type { ContratoEstadual, ResultadoEmpenhosAm } from "@/types/am";
import type { RegistroDominio, RegistroListaSuja } from "@/types/fontes-publicas";
import type { CertidaoTcu } from "@/types/tcu";
import type {
  BeneficiosFiscais,
  ConvenioFederal,
  DadosGovernoFederal,
  DadosPessoaFisica,
  EmendaParlamentar,
  ResultadoDocumentosEmenda,
  ResultadoEmpenhosFederais,
  Sancao,
} from "@/types/transparencia";

/**
 * Modelo do modo Sinapse: um grafo de empresas, sócios, órgãos e sanções
 * montado a partir das consultas que o app já faz. Funções puras — a tela
 * (components/SinapseClient.tsx) só desenha o modelo.
 *
 * Cada ponto tem uma chave estável, então o mesmo órgão ou sócio alcançado
 * por duas empresas vira UM ponto — é isso que faz o cruzamento aparecer.
 */

export type TipoNo =
  | "empresa"
  | "pessoa"
  | "orgao-federal"
  | "orgao-am"
  | "sancao"
  | "beneficio"
  | "registro"
  | "parlamentar"
  | "emenda"
  | "cargo";

export type TipoAresta =
  | "socio"
  | "federal"
  | "am"
  | "sancao"
  | "a-receber"
  | "convenio"
  | "beneficio"
  | "registro"
  | "autoria"
  | "emenda-pagamento"
  | "pep"
  | "servidor"
  | "dominio"
  | "mesmo-endereco"
  | "mesmo-telefone"
  | "mesmo-email";

export interface NoSinapse {
  id: string;
  tipo: TipoNo;
  rotulo: string;
  /** Linha de apoio no painel (ex.: "Ativa · Manaus/AM", "CEIS · impede contratar"). */
  detalhe?: string;
  /** Ponto que pede atenção: sanção, empresa sancionada ou inativa. */
  alerta?: "perigo" | "atencao";
  /** Só em empresas. */
  cnpj?: string;
  /** Empresa cujas ligações já foram consultadas. */
  expandida?: boolean;
  /** Pessoa: CPF como a Receita publica ("***455835**"), pra conferir o CPF completo digitado. */
  documento?: string;
  /** Pessoa cujo CPF já foi consultado no Portal da Transparência. */
  cpfConsultado?: boolean;
  /** Pares rótulo → valor pro painel de detalhes. */
  info: [string, string][];
}

export interface ArestaSinapse {
  id: string;
  origem: string;
  destino: string;
  tipo: TipoAresta;
  rotulo: string;
  /** Dinheiro envolvido, pra espessura da linha. */
  valor?: number;
}

export interface ModeloSinapse {
  nos: Record<string, NoSinapse>;
  arestas: Record<string, ArestaSinapse>;
}

export const MODELO_VAZIO: ModeloSinapse = { nos: {}, arestas: {} };

// Um fornecedor grande tem dezenas de órgãos — acima disso o mapa vira um novelo.
export const MAXIMO_ORGAOS_POR_EMPRESA = 20;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function idEmpresa(cnpj: string): string {
  return `empresa:${cnpj}`;
}

/** CPF mascarado "***455835**" → "455835": os dígitos que a Receita deixa ver. */
function digitosVisiveis(documento: string | undefined): string {
  return (documento ?? "").replace(/\D/g, "");
}

function comNo(modelo: ModeloSinapse, no: NoSinapse): ModeloSinapse {
  const atual = modelo.nos[no.id];
  // Não rebaixa uma empresa já consultada a um ponto "de passagem" (sócio PJ citado por outra).
  if (atual?.expandida && !no.expandida) return modelo;
  return { ...modelo, nos: { ...modelo.nos, [no.id]: atual ? { ...atual, ...no } : no } };
}

function comAresta(modelo: ModeloSinapse, aresta: ArestaSinapse): ModeloSinapse {
  return { ...modelo, arestas: { ...modelo.arestas, [aresta.id]: aresta } };
}

/** Ponto da empresa ainda sem dados — aparece na hora em que o CNPJ é adicionado. */
export function comEmpresaPendente(modelo: ModeloSinapse, cnpj: string): ModeloSinapse {
  const id = idEmpresa(cnpj);
  if (modelo.nos[id]) return modelo;
  return comNo(modelo, { id, tipo: "empresa", rotulo: formatarCnpj(cnpj) ?? cnpj, cnpj, info: [["CNPJ", formatarCnpj(cnpj) ?? cnpj]] });
}

export function comCadastro(modelo: ModeloSinapse, empresa: Empresa): ModeloSinapse {
  const id = idEmpresa(empresa.cnpj);
  const inativa = Boolean(empresa.situacaoCadastral) && empresa.situacaoCadastral?.toUpperCase() !== "ATIVA";
  const local = [empresa.municipio, empresa.uf].filter(Boolean).join("/");
  // As sanções podem chegar antes do cadastro: "perigo" já marcado não cai para "atenção".
  const alertaAnterior = modelo.nos[id]?.alerta;
  let m = comNo(modelo, {
    id,
    tipo: "empresa",
    rotulo: empresa.nomeFantasia || empresa.razaoSocial,
    detalhe: [empresa.situacaoCadastral, local].filter(Boolean).join(" · "),
    alerta: alertaAnterior === "perigo" ? "perigo" : inativa ? "atencao" : alertaAnterior,
    cnpj: empresa.cnpj,
    expandida: true,
    info: [
      ["Razão social", empresa.razaoSocial],
      ["CNPJ", formatarCnpj(empresa.cnpj) ?? empresa.cnpj],
      ["Situação", empresa.situacaoCadastral ?? "—"],
      ["Atividade", empresa.atividadePrincipal?.descricao ?? "—"],
      ["Endereço", [empresa.endereco, empresa.bairro, local].filter(Boolean).join(", ") || "—"],
      ["Telefone", empresa.telefones.join(" · ") || "—"],
      ...(empresa.email ? [["E-mail", empresa.email.toLowerCase()] as [string, string]] : []),
    ],
  });

  for (const socio of empresa.socios) {
    const documento = digitosVisiveis(socio.documento);
    // Sócio empresa: vira um ponto de empresa, que dá pra abrir.
    if (socio.tipo === "pj" && documento.length === 14) {
      m = comNo(m, {
        id: idEmpresa(documento),
        tipo: "empresa",
        rotulo: socio.nome,
        detalhe: "Sócia — clique em Abrir ligações para consultar",
        cnpj: documento,
        info: [["Razão social", socio.nome], ["CNPJ", formatarCnpj(documento) ?? documento]],
      });
      m = comAresta(m, { id: `socio:${documento}>${empresa.cnpj}`, origem: idEmpresa(documento), destino: id, tipo: "socio", rotulo: socio.qualificacao });
      continue;
    }
    // Pessoa: nome + dígitos visíveis do CPF. Dois homônimos com o mesmo miolo de CPF
    // são, na prática, a mesma pessoa; sem CPF, vale só o nome.
    const idPessoa = `pessoa:${normalizar(socio.nome)}|${documento}`;
    m = comNo(m, {
      id: idPessoa,
      tipo: "pessoa",
      rotulo: socio.nome,
      detalhe: socio.tipo === "estrangeiro" ? "Sócio estrangeiro" : "Sócio",
      documento: socio.documento,
      info: [["Nome", socio.nome], ["CPF", socio.documento ?? "não informado"]],
    });
    m = comAresta(m, { id: `socio:${idPessoa}>${empresa.cnpj}`, origem: idPessoa, destino: id, tipo: "socio", rotulo: socio.qualificacao });
  }
  return comCoincidencias(m);
}

export function comSancoes(modelo: ModeloSinapse, cnpj: string, sancoes: Sancao[]): ModeloSinapse {
  return comSancoesDe(modelo, idEmpresa(cnpj), cnpj, sancoes);
}

/** Sanções de uma empresa ou de uma pessoa (consulta de CPF): `origem` é o ponto sancionado. */
function comSancoesDe(modelo: ModeloSinapse, origem: string, chaveOrigem: string, sancoes: Sancao[]): ModeloSinapse {
  let m = modelo;
  const idE = origem;
  const cnpj = chaveOrigem;
  for (const s of sancoes) {
    const id = `sancao:${s.tipo}-${s.id}`;
    m = comNo(m, {
      id,
      tipo: "sancao",
      rotulo: `${s.tipo}: ${s.tipoSancao}`,
      detalhe: [s.orgaoSancionador?.nome, s.dataFimSancao ? `até ${s.dataFimSancao}` : "sem prazo"].filter(Boolean).join(" · "),
      alerta: s.impedeContratar ? "perigo" : "atencao",
      info: [
        ["Cadastro", s.tipo],
        ["Sanção", s.tipoSancao],
        ["Impede contratar", s.impedeContratar ? "Sim" : "Não"],
        ["Órgão sancionador", s.orgaoSancionador?.nome ?? "—"],
        ["Vigência", [s.dataInicioSancao, s.dataFimSancao].filter(Boolean).join(" a ") || "—"],
      ],
    });
    m = comAresta(m, { id: `sancao:${cnpj}>${id}`, origem: idE, destino: id, tipo: "sancao", rotulo: s.impedeContratar ? "impede contratar" : "sanção" });
  }
  if (sancoes.some((s) => s.impedeContratar) && m.nos[idE]) {
    m = { ...m, nos: { ...m.nos, [idE]: { ...m.nos[idE], alerta: "perigo" } } };
  }
  return m;
}

/** "MIDR — Ministério da Integração…" e "Ministério da Integração…" são o mesmo órgão. */
function chaveOrgaoFederal(nome: string): string {
  const semSigla = nome.includes(" — ") ? nome.split(" — ").slice(1).join(" — ") : nome;
  return `orgao-federal:${normalizar(semSigla)}`;
}

export function comGovernoFederal(modelo: ModeloSinapse, cnpj: string, dados: DadosGovernoFederal): ModeloSinapse {
  // Soma contratos e pagamentos por órgão; fica com os maiores.
  const porOrgao = new Map<string, { nome: string; contratos: number; vigentes: number; valorContratos: number; pago: number }>();
  const pegar = (nome: string) => {
    const chave = chaveOrgaoFederal(nome);
    const atual = porOrgao.get(chave) ?? { nome, contratos: 0, vigentes: 0, valorContratos: 0, pago: 0 };
    porOrgao.set(chave, atual);
    return atual;
  };
  for (const c of dados.contratos?.itens ?? []) {
    const nome = c.orgao ?? c.unidadeGestora;
    if (!nome) continue;
    const o = pegar(nome);
    o.contratos++;
    if (c.vigente) o.vigentes++;
    o.valorContratos += c.valorFinal ?? c.valorInicial ?? 0;
  }
  for (const p of dados.pagamentos?.porOrgao ?? []) pegar(p.orgao).pago += p.valor;

  const ordenados = [...porOrgao.entries()].sort(
    (a, b) => b[1].valorContratos + b[1].pago - (a[1].valorContratos + a[1].pago),
  );
  let m = modelo;
  const idE = idEmpresa(cnpj);
  for (const [chave, o] of ordenados.slice(0, MAXIMO_ORGAOS_POR_EMPRESA)) {
    const partes = [
      o.contratos && `${o.contratos} ${o.contratos === 1 ? "contrato" : "contratos"}${o.vigentes ? ` (${o.vigentes} vigente${o.vigentes > 1 ? "s" : ""})` : ""}`,
      o.valorContratos && formatarMoeda(o.valorContratos),
      o.pago && `pago em 12 meses ${formatarMoeda(o.pago)}`,
    ].filter(Boolean);
    m = comNo(m, { id: chave, tipo: "orgao-federal", rotulo: o.nome.split(" — ")[0], detalhe: "Governo federal", info: [["Órgão", o.nome], ["Esfera", "Federal"]] });
    m = comAresta(m, { id: `federal:${cnpj}>${chave}`, origem: idE, destino: chave, tipo: "federal", rotulo: partes.join(" · "), valor: o.valorContratos + o.pago });
  }
  const resto = ordenados.length - MAXIMO_ORGAOS_POR_EMPRESA;
  if (resto > 0 && m.nos[idE]) {
    m = { ...m, nos: { ...m.nos, [idE]: { ...m.nos[idE], info: [...m.nos[idE].info.filter(([k]) => k !== "Órgãos federais fora do mapa"), ["Órgãos federais fora do mapa", `${resto} com valores menores`]] } } };
  }
  return m;
}

export function comContratosAm(modelo: ModeloSinapse, cnpj: string, contratos: ContratoEstadual[]): ModeloSinapse {
  const porUg = new Map<string, { nome: string; sigla?: string; contratos: number; vigentes: number; valor: number }>();
  for (const c of contratos) {
    const atual = porUg.get(c.ug) ?? { nome: c.ugNome ?? c.ug, sigla: c.ugSigla, contratos: 0, vigentes: 0, valor: 0 };
    atual.contratos++;
    if (c.vigente) atual.vigentes++;
    atual.valor += c.valorTotal ?? 0;
    porUg.set(c.ug, atual);
  }
  let m = modelo;
  const idE = idEmpresa(cnpj);
  for (const [ug, o] of [...porUg.entries()].sort((a, b) => b[1].valor - a[1].valor).slice(0, MAXIMO_ORGAOS_POR_EMPRESA)) {
    const id = `orgao-am:${ug}`;
    m = comNo(m, { id, tipo: "orgao-am", rotulo: o.sigla ?? o.nome, detalhe: "Governo do Amazonas", info: [["Órgão", o.nome], ["Esfera", "Estadual (AM)"], ["UG", ug]] });
    m = comAresta(m, {
      id: `am:${cnpj}>${id}`,
      origem: idE,
      destino: id,
      tipo: "am",
      rotulo: [`${o.contratos} ${o.contratos === 1 ? "contrato" : "contratos"}${o.vigentes ? ` (${o.vigentes} vigente${o.vigentes > 1 ? "s" : ""})` : ""}`, o.valor && formatarMoeda(o.valor)].filter(Boolean).join(" · "),
      valor: o.valor,
    });
  }
  return m;
}

/** Acrescenta (ou troca) uma linha de detalhe no painel de um ponto. */
function comInfo(modelo: ModeloSinapse, id: string, chave: string, valor: string): ModeloSinapse {
  const no = modelo.nos[id];
  if (!no) return modelo;
  const info = [...no.info.filter(([k]) => k !== chave), [chave, valor] as [string, string]];
  return { ...modelo, nos: { ...modelo.nos, [id]: { ...no, info } } };
}

function comAlerta(modelo: ModeloSinapse, id: string, alerta: "perigo" | "atencao"): ModeloSinapse {
  const no = modelo.nos[id];
  if (!no || no.alerta === "perigo") return modelo;
  return { ...modelo, nos: { ...modelo.nos, [id]: { ...no, alerta } } };
}

// ---------------------------------------------------------------------------
// Certidão do TCU: inidôneos (TCU) e improbidade (CNJ). CEIS e CNEP também vêm
// na certidão, mas já estão no mapa pela CGU — não viram ponto de novo.
// ---------------------------------------------------------------------------
export function comCertidaoTcu(modelo: ModeloSinapse, cnpj: string, certidao: CertidaoTcu): ModeloSinapse {
  const idE = idEmpresa(cnpj);
  let m = modelo;
  const proprios = certidao.itens.filter((i) => i.tipo !== "CEIS" && i.tipo !== "CNEP");
  for (const item of proprios.filter((i) => i.situacao === "consta")) {
    const id = `tcu:${cnpj}:${item.tipo}`;
    m = comNo(m, {
      id,
      tipo: "sancao",
      rotulo: `${item.emissor}: ${item.tipo === "Inidôneos" ? "licitante inidôneo" : item.tipo}`,
      detalhe: item.observacao,
      alerta: "perigo",
      info: [["Cadastro", item.descricao], ["Emissor", item.emissor], ["Registro", item.observacao ?? "—"]],
    });
    m = comAresta(m, { id: `sancao:${cnpj}>${id}`, origem: idE, destino: id, tipo: "sancao", rotulo: item.descricao });
    m = comAlerta(m, idE, "perigo");
  }
  const resumo = proprios.map((i) => `${i.tipo}: ${i.situacao === "consta" ? "constam registros" : i.situacao === "nada_consta" ? "nada consta" : "não consultado"}`);
  return comInfo(m, idE, "Certidão TCU", resumo.join(" · ") || "—");
}

// ---------------------------------------------------------------------------
// Benefícios fiscais: cada regime especial (REIDI, PADIS…) é um ponto
// compartilhado — duas empresas no mesmo regime aparecem ligadas a ele.
// ---------------------------------------------------------------------------
export function comBeneficiosFiscais(modelo: ModeloSinapse, cnpj: string, beneficios: BeneficiosFiscais): ModeloSinapse {
  const idE = idEmpresa(cnpj);
  let m = modelo;
  for (const r of beneficios.regimes) {
    const id = `beneficio:${normalizar(r.beneficio)}`;
    m = comNo(m, {
      id,
      tipo: "beneficio",
      rotulo: r.beneficio.toUpperCase(),
      detalhe: r.descricao ?? "Regime especial de tributação",
      info: [["Benefício", r.beneficio.toUpperCase()], ["O que é", r.descricao ?? "—"], ["Fundamento", r.fundamentoLegal ?? "—"]],
    });
    m = comAresta(m, {
      id: `beneficio:${cnpj}>${id}`,
      origem: idE,
      destino: id,
      tipo: "beneficio",
      rotulo: `${r.vigente ? "vigente" : "encerrado"}${r.inicio ? ` · de ${r.inicio}${r.fim ? ` a ${r.fim}` : ""}` : ""}`,
    });
  }
  const recente = beneficios.renunciasPorAno[0];
  if (recente) m = comInfo(m, idE, "Tributos não pagos", `${formatarMoeda(recente.total)} em ${recente.ano} (renúncia fiscal)`);
  if (beneficios.imunidades.length) {
    m = comInfo(m, idE, "Imunidade/isenção", beneficios.imunidades.map((i) => i.beneficio).join(" · "));
  }
  return m;
}

// ---------------------------------------------------------------------------
// SUFRAMA e e-mail (CNPJá). A SUFRAMA é um ponto só, compartilhado; o e-mail
// entra no detalhe da empresa e alimenta o cruzamento "mesmo e-mail".
// ---------------------------------------------------------------------------
export function comComplemento(modelo: ModeloSinapse, cnpj: string, complemento: ComplementoCnpj): ModeloSinapse {
  const idE = idEmpresa(cnpj);
  let m = modelo;
  if (complemento.emails.length) {
    const atuais = m.nos[idE]?.info.find(([k]) => k === "E-mail")?.[1];
    const todos = [...new Set([...(atuais ? atuais.split(" · ") : []), ...complemento.emails])];
    m = comInfo(m, idE, "E-mail", todos.join(" · "));
  }
  for (const inscricao of complemento.suframa) {
    const id = "registro:suframa";
    m = comNo(m, {
      id,
      tipo: "registro",
      rotulo: "SUFRAMA",
      detalhe: "Cadastro de empresas da Zona Franca de Manaus",
      info: [["Órgão", "Superintendência da Zona Franca de Manaus"]],
    });
    const incentivos = [...new Set(inscricao.incentivos.map((i) => i.tributo))].join(", ");
    m = comAresta(m, {
      id: `registro:${cnpj}>${id}:${inscricao.numero}`,
      origem: idE,
      destino: id,
      tipo: "registro",
      rotulo: [`inscrição ${inscricao.numero}`, inscricao.situacao, incentivos && `incentivos: ${incentivos}`].filter(Boolean).join(" · "),
    });
  }
  return comCoincidencias(m);
}

// ---------------------------------------------------------------------------
// Empenhos a receber: somados por órgão, na mesma chave do órgão dos contratos.
// ---------------------------------------------------------------------------
export function comEmpenhosFederais(modelo: ModeloSinapse, cnpj: string, resultado: ResultadoEmpenhosFederais): ModeloSinapse {
  const idE = idEmpresa(cnpj);
  const porOrgao = new Map<string, { nome: string; valor: number; empenhos: number }>();
  for (const e of resultado.empenhos) {
    if (e.aReceber <= 0) continue;
    const nome = e.orgao ?? e.orgaoSuperior ?? e.ug;
    if (!nome) continue;
    const chave = chaveOrgaoFederal(nome);
    const atual = porOrgao.get(chave) ?? { nome, valor: 0, empenhos: 0 };
    atual.valor += e.aReceber;
    atual.empenhos++;
    porOrgao.set(chave, atual);
  }
  let m = modelo;
  for (const [chave, o] of [...porOrgao.entries()].sort((a, b) => b[1].valor - a[1].valor).slice(0, MAXIMO_ORGAOS_POR_EMPRESA)) {
    m = comNo(m, { id: chave, tipo: "orgao-federal", rotulo: o.nome, detalhe: "Governo federal", info: [["Órgão", o.nome], ["Esfera", "Federal"]] });
    m = comAresta(m, {
      id: `receber-federal:${cnpj}>${chave}`,
      origem: idE,
      destino: chave,
      tipo: "a-receber",
      rotulo: `a receber ${formatarMoeda(o.valor)} (${o.empenhos} ${o.empenhos === 1 ? "empenho" : "empenhos"})`,
      valor: o.valor,
    });
  }
  return comInfo(m, idE, "A receber (federal)", resultado.totais.aReceber > 0 ? formatarMoeda(resultado.totais.aReceber) : "nada a receber");
}

export function comEmpenhosAm(modelo: ModeloSinapse, cnpj: string, resultado: ResultadoEmpenhosAm): ModeloSinapse {
  const idE = idEmpresa(cnpj);
  const porUg = new Map<string, { nome: string; valor: number; contratos: number }>();
  for (const c of resultado.contratos) {
    if (c.totais.aReceber <= 0) continue;
    const atual = porUg.get(c.ug) ?? { nome: c.ugSigla ?? c.ugNome ?? c.ug, valor: 0, contratos: 0 };
    atual.valor += c.totais.aReceber;
    atual.contratos++;
    porUg.set(c.ug, atual);
  }
  let m = modelo;
  for (const [ug, o] of porUg) {
    const id = `orgao-am:${ug}`;
    m = comNo(m, { id, tipo: "orgao-am", rotulo: o.nome, detalhe: "Governo do Amazonas", info: [["Órgão", o.nome], ["Esfera", "Estadual (AM)"], ["UG", ug]] });
    m = comAresta(m, {
      id: `receber-am:${cnpj}>${id}`,
      origem: idE,
      destino: id,
      tipo: "a-receber",
      rotulo: `a receber ${formatarMoeda(o.valor)} (${o.contratos} ${o.contratos === 1 ? "contrato" : "contratos"})`,
      valor: o.valor,
    });
  }
  return comInfo(m, idE, "A receber (Amazonas)", resultado.totais.aReceber > 0 ? formatarMoeda(resultado.totais.aReceber) : "nada a receber");
}

// ---------------------------------------------------------------------------
// Convênios: a entidade (prefeitura, secretaria, ONG) ligada a quem repassa.
// ---------------------------------------------------------------------------
export function comConvenios(modelo: ModeloSinapse, cnpj: string, convenios: ConvenioFederal[]): ModeloSinapse {
  const idE = idEmpresa(cnpj);
  const porConcedente = new Map<string, { nome: string; quantidade: number; valor: number; liberado: number }>();
  for (const c of convenios) {
    const nome = c.concedente ?? c.unidadeGestora;
    if (!nome) continue;
    const chave = chaveOrgaoFederal(nome);
    const atual = porConcedente.get(chave) ?? { nome, quantidade: 0, valor: 0, liberado: 0 };
    atual.quantidade++;
    atual.valor += c.valor;
    atual.liberado += c.valorLiberado;
    porConcedente.set(chave, atual);
  }
  let m = modelo;
  for (const [chave, o] of porConcedente) {
    m = comNo(m, { id: chave, tipo: "orgao-federal", rotulo: o.nome.split(" — ")[0], detalhe: "Governo federal", info: [["Órgão", o.nome], ["Esfera", "Federal"]] });
    m = comAresta(m, {
      id: `convenio:${cnpj}>${chave}`,
      origem: idE,
      destino: chave,
      tipo: "convenio",
      rotulo: `${o.quantidade} ${o.quantidade === 1 ? "convênio" : "convênios"} · ${formatarMoeda(o.valor)} · liberado ${formatarMoeda(o.liberado)}`,
      valor: o.valor,
    });
  }
  return comInfo(m, idE, "Convênios", convenios.length ? `${convenios.length} encontrados (primeira página da CGU)` : "nenhum com este nome");
}

// ---------------------------------------------------------------------------
// Emenda: parlamentar → emenda → quem recebeu o dinheiro. Quem recebeu vira
// ponto de empresa (pra abrir depois) ou de pessoa — e se essa pessoa já é
// sócia de uma empresa do mapa, o ponto é o mesmo.
// ---------------------------------------------------------------------------
export function idEmenda(codigo: string): string {
  return `emenda:${codigo}`;
}

export function comEmenda(modelo: ModeloSinapse, emenda: EmendaParlamentar, documentos: ResultadoDocumentosEmenda | null): ModeloSinapse {
  const id = idEmenda(emenda.codigo);
  const idAutor = `parlamentar:${normalizar(emenda.autor)}`;
  let m = comNo(modelo, {
    id: idAutor,
    tipo: "parlamentar",
    rotulo: emenda.autor,
    detalhe: "Autor de emenda (parlamentar, bancada ou comissão)",
    info: [["Autor", emenda.autor]],
  });
  m = comNo(m, {
    id,
    tipo: "emenda",
    rotulo: `Emenda ${emenda.numero}/${emenda.ano}`,
    detalhe: [emenda.tipo.replace(/^Emenda /, ""), emenda.localidade].filter(Boolean).join(" · "),
    info: [
      ["Código", emenda.codigo],
      ["Tipo", emenda.tipo],
      ["Função", [emenda.funcao, emenda.subfuncao].filter(Boolean).join(" › ") || "—"],
      ["Empenhado", formatarMoeda(emenda.empenhado)],
      ["Pago", `${formatarMoeda(emenda.pago)}${emenda.restoPago ? ` (+ ${formatarMoeda(emenda.restoPago)} de restos a pagar)` : ""}`],
    ],
  });
  m = comAresta(m, { id: `autoria:${idAutor}>${id}`, origem: idAutor, destino: id, tipo: "autoria", rotulo: "autor da emenda" });
  if (!documentos) return comInfo(m, id, "Quem recebeu", "não foi possível consultar os documentos");

  for (const r of documentos.recebedores) {
    const digitos = digitosVisiveis(r.documento);
    const destino =
      digitos.length === 14 ? idEmpresa(digitos) : `pessoa:${normalizar(r.nome)}|${digitos}`;
    if (digitos.length === 14) {
      m = comNo(m, {
        id: destino,
        tipo: "empresa",
        rotulo: r.nome,
        detalhe: "Recebeu dinheiro de emenda — clique em Abrir ligações",
        cnpj: digitos,
        info: [["Razão social", r.nome], ["CNPJ", formatarCnpj(digitos) ?? digitos], ["UF", r.uf ?? "—"]],
      });
    } else {
      m = comNo(m, { id: destino, tipo: "pessoa", rotulo: r.nome, detalhe: "Recebeu dinheiro de emenda", documento: r.documento, info: [["Nome", r.nome], ["CPF", r.documento ?? "—"]] });
    }
    m = comAresta(m, { id: `emenda-pagamento:${id}>${destino}`, origem: id, destino, tipo: "emenda-pagamento", rotulo: `recebeu ${formatarMoeda(r.valor)}`, valor: r.valor });
  }
  return comInfo(m, id, "Quem recebeu", documentos.recebedores.length ? `${documentos.recebedores.length} favorecidos` : "nenhum pagamento ainda");
}

// ---------------------------------------------------------------------------
// CPF de um sócio, digitado inteiro pelo usuário e conferido com os dígitos
// que a Receita mostra. O CPF não fica no modelo — só o que a CGU devolve.
// ---------------------------------------------------------------------------

/** O CPF completo bate com o mascarado da Receita ("***455835**" = dígitos 4 a 9)? */
export function cpfBateComMascara(cpf: string, mascarado: string | undefined): boolean {
  const visiveis = digitosVisiveis(mascarado);
  const digitos = cpf.replace(/\D/g, "");
  return visiveis.length === 6 && digitos.length === 11 && digitos.slice(3, 9) === visiveis;
}

export function comPessoaFisica(modelo: ModeloSinapse, idPessoa: string, dados: DadosPessoaFisica): ModeloSinapse {
  let m = modelo;
  const no = m.nos[idPessoa];
  if (!no) return m;
  m = { ...m, nos: { ...m.nos, [idPessoa]: { ...no, cpfConsultado: true } } };
  if (dados.nome) m = comInfo(m, idPessoa, "Nome na CGU", dados.nome);

  const sancoes = dados.sancoes ? [...dados.sancoes.ceis, ...dados.sancoes.cnep] : [];
  if (sancoes.length) m = comSancoesDe(m, idPessoa, idPessoa, sancoes);
  for (const p of dados.ceaf ?? []) {
    const id = `ceaf:${p.id}`;
    m = comNo(m, {
      id,
      tipo: "sancao",
      rotulo: `CEAF: ${p.tipo}`,
      detalhe: [p.orgao, p.dataPublicacao].filter(Boolean).join(" · "),
      alerta: "perigo",
      info: [["Cadastro", "CEAF — expulsos da administração federal"], ["Punição", p.tipo], ["Órgão", p.orgao ?? "—"], ["Publicada em", p.dataPublicacao ?? "—"]],
    });
    m = comAresta(m, { id: `sancao:${idPessoa}>${id}`, origem: idPessoa, destino: id, tipo: "sancao", rotulo: p.tipo });
  }
  if (sancoes.length || dados.ceaf?.length) m = comAlerta(m, idPessoa, "perigo");
  if (dados.listaSuja?.length) m = comListaSujaDe(m, idPessoa, dados.listaSuja);

  (dados.peps ?? []).forEach((p, i) => {
    const id = `pep:${idPessoa}:${i}`;
    m = comNo(m, {
      id,
      tipo: "cargo",
      rotulo: p.funcao,
      detalhe: [p.orgao, p.fimCarencia && `PEP até ${p.fimCarencia}`].filter(Boolean).join(" · "),
      alerta: "atencao",
      info: [["Função", p.funcao], ["Órgão", p.orgao ?? "—"], ["Exercício", [p.inicioExercicio, p.fimExercicio].filter(Boolean).join(" a ") || "—"], ["Segue PEP até", p.fimCarencia ?? "—"]],
    });
    m = comAresta(m, { id: `pep:${idPessoa}>${id}`, origem: idPessoa, destino: id, tipo: "pep", rotulo: "pessoa politicamente exposta" });
  });
  if (dados.peps?.length) m = comAlerta(m, idPessoa, "atencao");

  for (const v of dados.vinculos ?? []) {
    const nome = v.orgaoLotacao ?? v.orgaoExercicio;
    if (!nome) continue;
    const chave = chaveOrgaoFederal(nome);
    m = comNo(m, { id: chave, tipo: "orgao-federal", rotulo: nome.split(" — ")[0], detalhe: "Governo federal", info: [["Órgão", nome], ["Esfera", "Federal"]] });
    m = comAresta(m, { id: `servidor:${idPessoa}>${chave}`, origem: idPessoa, destino: chave, tipo: "servidor", rotulo: [v.situacao, v.cargo ?? v.funcao].filter(Boolean).join(" · ") || "servidor" });
  }

  const r = dados.resumo;
  const marcas = [
    r.servidor && "servidor federal",
    r.servidorInativo && "aposentado",
    r.pensionista && "pensionista",
    r.contratado && "contratado pelo governo federal",
    dados.peps?.length && "PEP",
  ].filter(Boolean);
  return comInfo(m, idPessoa, "Na CGU", r.semRegistro ? "sem registro" : marcas.join(" · ") || "sem vínculo federal registrado");
}

// ---------------------------------------------------------------------------
// Lista suja do trabalho escravo (MTE). Âmbar, não vermelho: estar na lista
// não impede contratar por lei.
// ---------------------------------------------------------------------------
const PREFIXO_LISTA_SUJA = "lista-suja:";

/** `origem` é o ponto que está na lista: uma empresa ou uma pessoa com o CPF consultado. */
function comListaSujaDe(modelo: ModeloSinapse, origem: string, registros: RegistroListaSuja[]): ModeloSinapse {
  if (registros.length === 0 || !modelo.nos[origem]) return modelo;
  const id = `${PREFIXO_LISTA_SUJA}${origem}`;
  const trabalhadores = registros.reduce((soma, r) => soma + (r.trabalhadores ?? 0), 0);
  let m = comNo(modelo, {
    id,
    tipo: "sancao",
    rotulo: "Lista suja do trabalho escravo",
    detalhe: registros.length === 1 ? "1 registro no cadastro do MTE" : `${registros.length} registros no cadastro do MTE`,
    alerta: "atencao",
    info: [
      ["Cadastro", "Empregadores que submeteram trabalhadores a condições análogas à de escravo (MTE)"],
      ["Ações fiscais", registros.map((r) => [r.anoAcaoFiscal, r.uf].filter(Boolean).join("/")).filter(Boolean).join(" · ") || "—"],
      ["Trabalhadores", trabalhadores ? String(trabalhadores) : "—"],
      ["Incluído em", registros.map((r) => r.inclusaoEm).filter(Boolean).join(" · ") || "—"],
      ["Impede contratar", "Não por lei"],
    ],
  });
  m = comAresta(m, { id: `sancao:${origem}>${id}`, origem, destino: id, tipo: "sancao", rotulo: "na lista suja do trabalho escravo" });
  return comAlerta(m, origem, "atencao");
}

export function comListaSuja(modelo: ModeloSinapse, cnpj: string, registros: RegistroListaSuja[]): ModeloSinapse {
  return comListaSujaDe(modelo, idEmpresa(cnpj), registros);
}

function estaNaListaSuja(modelo: ModeloSinapse, id: string): boolean {
  return Boolean(modelo.nos[`${PREFIXO_LISTA_SUJA}${id}`]);
}

// ---------------------------------------------------------------------------
// Dono do domínio do e-mail (registro.br). Quando é outro CNPJ, vira uma
// ligação até ele — sem alerta: é comum a empresa cadastrar o e-mail do contador.
// ---------------------------------------------------------------------------
export function comDominio(modelo: ModeloSinapse, cnpj: string, registro: RegistroDominio): ModeloSinapse {
  const idE = idEmpresa(cnpj);
  const titular = registro.titular;
  if (!titular || !modelo.nos[idE]) return modelo;

  const dono = titular.cnpj;
  // Matriz e filiais dividem a raiz do CNPJ (os 8 primeiros dígitos): é a mesma empresa.
  const daPropriaEmpresa = dono?.slice(0, 8) === cnpj.slice(0, 8);
  const quem = daPropriaEmpresa
    ? "a própria empresa"
    : [titular.nome ?? (titular.tipo === "cpf" ? "pessoa física" : "titular não informado"), dono && `(${formatarCnpj(dono) ?? dono})`]
        .filter(Boolean)
        .join(" ");
  let m = comInfo(modelo, idE, "Domínio", `${registro.dominio} — registrado por ${quem}`);
  if (!dono || daPropriaEmpresa) return m;

  m = comNo(m, {
    id: idEmpresa(dono),
    tipo: "empresa",
    rotulo: titular.nome ?? formatarCnpj(dono) ?? dono,
    detalhe: "Dona de domínio — clique para abrir",
    cnpj: dono,
    info: [["Razão social", titular.nome ?? "—"], ["CNPJ", formatarCnpj(dono) ?? dono]],
  });
  return comAresta(m, {
    id: `dominio:${cnpj}>${dono}`,
    origem: idE,
    destino: idEmpresa(dono),
    tipo: "dominio",
    rotulo: `domínio ${registro.dominio} registrado por`,
  });
}

/** Liga empresas do mapa que dividem telefone, e-mail ou endereço — ninguém declara isso, o mapa acha. */
export function comCoincidencias(modelo: ModeloSinapse): ModeloSinapse {
  const empresas = Object.values(modelo.nos).filter((n) => n.tipo === "empresa" && n.expandida);
  let m = modelo;
  const valorInfo = (n: NoSinapse, chave: string) => n.info.find(([k]) => k === chave)?.[1];
  for (let i = 0; i < empresas.length; i++) {
    for (let j = i + 1; j < empresas.length; j++) {
      const [a, b] = [empresas[i], empresas[j]];
      const telefones = (n: NoSinapse) => new Set((valorInfo(n, "Telefone") ?? "").split(" · ").map((t) => t.replace(/\D/g, "")).filter((t) => t.length >= 8));
      const ta = telefones(a);
      const comum = [...telefones(b)].find((t) => ta.has(t));
      if (comum) m = comAresta(m, { id: `mesmo-telefone:${a.id}|${b.id}`, origem: a.id, destino: b.id, tipo: "mesmo-telefone", rotulo: "mesmo telefone" });
      const emails = (n: NoSinapse) => new Set((valorInfo(n, "E-mail") ?? "").split(" · ").map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")));
      const eaEmails = emails(a);
      const emailComum = [...emails(b)].find((e) => eaEmails.has(e));
      if (emailComum) m = comAresta(m, { id: `mesmo-email:${a.id}|${b.id}`, origem: a.id, destino: b.id, tipo: "mesmo-email", rotulo: `mesmo e-mail (${emailComum})` });
      const ea = normalizar(valorInfo(a, "Endereço") ?? "");
      if (ea && ea !== "—" && ea === normalizar(valorInfo(b, "Endereço") ?? "")) {
        m = comAresta(m, { id: `mesmo-endereco:${a.id}|${b.id}`, origem: a.id, destino: b.id, tipo: "mesmo-endereco", rotulo: "mesmo endereço" });
      }
    }
  }
  return m;
}

export interface Cruzamento {
  id: string;
  tipo:
    | "socio-comum"
    | "orgao-comum"
    | "beneficio-comum"
    | "mesmo-endereco"
    | "mesmo-telefone"
    | "mesmo-email"
    | "sancionada-com-contratos"
    | "emenda-para-sancionada"
    | "socio-com-alerta"
    | "mesmo-dono-dominio";
  titulo: string;
  descricao: string;
  /** Ponto pra focar ao clicar. */
  foco: string;
  gravidade: "perigo" | "atencao" | "info";
}

/** O que o mapa mostra que nenhuma tela isolada mostra. */
export function encontrarCruzamentos(modelo: ModeloSinapse): Cruzamento[] {
  const arestas = Object.values(modelo.arestas);
  const nome = (id: string) => modelo.nos[id]?.rotulo ?? id;
  const empresasLigadas = (id: string, tipos: TipoAresta[]) =>
    [...new Set(arestas.filter((a) => tipos.includes(a.tipo) && (a.origem === id || a.destino === id)).map((a) => (a.origem === id ? a.destino : a.origem)))]
      .filter((outro) => modelo.nos[outro]?.tipo === "empresa");

  const lista: Cruzamento[] = [];
  for (const no of Object.values(modelo.nos)) {
    if (no.tipo === "pessoa" || (no.tipo === "empresa" && !no.expandida)) {
      const empresas = empresasLigadas(no.id, ["socio"]);
      if (empresas.length >= 2) {
        lista.push({ id: `socio:${no.id}`, tipo: "socio-comum", titulo: `Sócio em comum: ${no.rotulo}`, descricao: empresas.map(nome).join(" · "), foco: no.id, gravidade: "atencao" });
      }
    }
    if (no.tipo === "pessoa" && no.alerta) {
      const empresas = empresasLigadas(no.id, ["socio"]);
      if (empresas.length > 0) {
        lista.push({
          id: `alerta-socio:${no.id}`,
          tipo: "socio-com-alerta",
          titulo: `${
            no.alerta === "perigo"
              ? "Sócio com sanção"
              : estaNaListaSuja(modelo, no.id)
                ? "Sócio na lista suja do trabalho escravo"
                : "Sócio é pessoa politicamente exposta"
          }: ${no.rotulo}`,
          descricao: `Sócio de ${empresas.map(nome).join(" · ")}`,
          foco: no.id,
          gravidade: no.alerta,
        });
      }
    }
    if (no.tipo === "empresa") {
      // Empresas cujo e-mail usa um domínio registrado por este ponto.
      const clientes = [...new Set(arestas.filter((a) => a.tipo === "dominio" && a.destino === no.id).map((a) => a.origem))];
      if (clientes.length >= 2 || (clientes.length === 1 && no.expandida)) {
        lista.push({
          id: `dominio:${no.id}`,
          tipo: "mesmo-dono-dominio",
          titulo: `${clientes.length >= 2 ? "Mesmo dono de domínio" : "Domínio registrado por"}: ${no.rotulo}`,
          descricao: `E-mail de ${clientes.map(nome).join(" · ")}`,
          foco: no.id,
          gravidade: "info",
        });
      }
    }
    if (no.tipo === "beneficio") {
      const empresas = empresasLigadas(no.id, ["beneficio"]);
      if (empresas.length >= 2) {
        lista.push({ id: `beneficio:${no.id}`, tipo: "beneficio-comum", titulo: `Benefício fiscal em comum: ${no.rotulo}`, descricao: empresas.map(nome).join(" · "), foco: no.id, gravidade: "info" });
      }
    }
    if (no.tipo === "emenda") {
      const sancionadas = empresasLigadas(no.id, ["emenda-pagamento"]).filter((e) => modelo.nos[e]?.alerta === "perigo");
      if (sancionadas.length > 0) {
        lista.push({
          id: `emenda-sancionada:${no.id}`,
          tipo: "emenda-para-sancionada",
          titulo: `Dinheiro de emenda para empresa sancionada: ${no.rotulo}`,
          descricao: sancionadas.map(nome).join(" · "),
          foco: no.id,
          gravidade: "perigo",
        });
      }
    }
    if (no.tipo === "orgao-federal" || no.tipo === "orgao-am") {
      const empresas = empresasLigadas(no.id, ["federal", "am", "a-receber", "convenio"]);
      if (empresas.length >= 2) {
        lista.push({ id: `orgao:${no.id}`, tipo: "orgao-comum", titulo: `Órgão em comum: ${no.rotulo}`, descricao: empresas.map(nome).join(" · "), foco: no.id, gravidade: "info" });
      }
    }
    if (no.tipo === "empresa" && no.alerta === "perigo") {
      const orgaos = arestas.filter((a) => a.origem === no.id && (a.tipo === "federal" || a.tipo === "am"));
      if (orgaos.length > 0) {
        lista.push({
          id: `sancionada:${no.id}`,
          tipo: "sancionada-com-contratos",
          titulo: `Sanção que impede contratar: ${no.rotulo}`,
          descricao: `Ligada a ${orgaos.length} ${orgaos.length === 1 ? "órgão" : "órgãos"} por contratos ou pagamentos.`,
          foco: no.id,
          gravidade: "perigo",
        });
      }
    }
  }
  for (const a of arestas) {
    if (a.tipo === "mesmo-endereco" || a.tipo === "mesmo-telefone" || a.tipo === "mesmo-email") {
      lista.push({
        id: a.id,
        tipo: a.tipo,
        titulo: { "mesmo-endereco": "Mesmo endereço", "mesmo-telefone": "Mesmo telefone", "mesmo-email": "Mesmo e-mail" }[a.tipo],
        descricao: `${nome(a.origem)} · ${nome(a.destino)}`,
        foco: a.origem,
        gravidade: "atencao",
      });
    }
  }
  const peso = { perigo: 0, atencao: 1, info: 2 };
  return lista.sort((x, y) => peso[x.gravidade] - peso[y.gravidade]);
}
