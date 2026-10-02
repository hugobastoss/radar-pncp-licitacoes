"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Core, CoseLayoutOptions, StylesheetJson } from "cytoscape";
import {
  ArrowUpRight,
  BadgePercent,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Building2,
  Download,
  Expand,
  Factory,
  Landmark,
  Loader2,
  Maximize2,
  Minus,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  ScrollText,
  Share2,
  ShieldAlert,
  Shrink,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  UserRound,
  Vote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { buscarContratosAm, buscarEmpenhosAm } from "@/lib/api-am";
import { buscarComplementoCnpj, buscarEmpresa } from "@/lib/api-cnpj";
import { buscarConvenios } from "@/lib/api-convenios";
import { consultarCpf } from "@/lib/api-cpf";
import { buscarDocumentosEmenda, buscarEmendas } from "@/lib/api-emendas";
import { buscarEmpenhosFederais } from "@/lib/api-empenhos-federais";
import { buscarListaSuja, buscarRegistroDominio } from "@/lib/api-fontes-publicas";
import { buscarDadosGovernoFederal } from "@/lib/api-governo-federal";
import { buscarSancoes } from "@/lib/api-sancoes";
import { buscarCertidaoTcu } from "@/lib/api-tcu";
import { validarCnpj } from "@/lib/cnpj";
import { validarCpf } from "@/lib/cpf";
import { arrastarParaRolar } from "@/lib/arrastar-para-rolar";
import { cn } from "@/lib/cn";
import { dominioDoEmail } from "@/lib/dominio-email";
import { FORMATO_CODIGO_EMENDA } from "@/lib/emendas";
import { formatarCnpj, mascararCnpj, mascararCpf } from "@/lib/formatters";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import {
  comBeneficiosFiscais,
  comCadastro,
  comCertidaoTcu,
  comComplemento,
  comContratosAm,
  comConvenios,
  comDominio,
  comEmenda,
  comEmpenhosAm,
  comEmpenhosFederais,
  comEmpresaPendente,
  comGovernoFederal,
  comListaSuja,
  comPessoaFisica,
  comSancoes,
  cpfBateComMascara,
  encontrarCruzamentos,
  idEmenda,
  idEmpresa,
  MODELO_VAZIO,
  resumirCruzamentos,
} from "@/lib/sinapse";
import type { Cruzamento, FonteAresta, ModeloSinapse, NoSinapse, ResumoCruzamentos, TipoNo } from "@/lib/sinapse";
import type { Empresa } from "@/types/cnpj";

// Cada empresa aberta custa de 5 a ~30 chamadas às fontes (a CGU tem cota de 400/min pro app inteiro).
const MAXIMO_EMPRESAS = 8;
const MAXIMO_EMENDAS = 5;

// Dois fornecedores da Marinha pagos pela mesma emenda: o exemplo mostra um órgão em comum.
const EXEMPLO = ["54464211000104", "46106851000114"];

// A CNPJá tem limite apertado (5/min por IP): só consulta quando pode acrescentar algo, como na tela de CNPJ.
const UFS_AREA_SUFRAMA = new Set(["AM", "RO", "RR", "AC", "AP"]);
function precisaComplemento(empresa: Empresa): boolean {
  return UFS_AREA_SUFRAMA.has(empresa.uf ?? "") || !empresa.email;
}

type Fonte =
  | "cadastro"
  | "sancoes"
  | "tcu"
  | "listaSuja"
  | "federal"
  | "complemento"
  | "dominio"
  | "am"
  | "empenhosFederais"
  | "empenhosAm"
  | "convenios"
  | "emenda";
type FonteSobDemanda = "am" | "empenhosFederais" | "empenhosAm" | "convenios";
type EstadoFonte = "carregando" | "ok" | "vazio" | "limite" | "erro";

const ROTULO_FONTE: Record<Fonte, string> = {
  cadastro: "Cadastro (Receita)",
  sancoes: "Sanções (CGU)",
  tcu: "Certidão do TCU",
  listaSuja: "Lista suja do trabalho escravo (MTE)",
  federal: "Governo federal e benefícios fiscais (CGU)",
  complemento: "SUFRAMA e e-mail (CNPJá)",
  dominio: "Dono do domínio do e-mail (registro.br)",
  am: "Contratos do Governo do Amazonas",
  empenhosFederais: "Empenhos a receber: federal",
  empenhosAm: "Empenhos a receber: Amazonas",
  convenios: "Convênios (CGU)",
  emenda: "Emenda e quem recebeu (CGU)",
};

const ROTULO_ESTADO: Record<EstadoFonte, string> = {
  carregando: "consultando…",
  ok: "no mapa",
  vazio: "nada encontrado",
  limite: "limite de consultas, tente de novo em 1 minuto",
  erro: "não respondeu",
};

const SOB_DEMANDA: { fonte: FonteSobDemanda; botao: string }[] = [
  { fonte: "am", botao: "Contratos com o Governo do Amazonas" },
  { fonte: "empenhosFederais", botao: "Empenhos a receber (federal)" },
  { fonte: "empenhosAm", botao: "Empenhos a receber (Amazonas)" },
  { fonte: "convenios", botao: "Convênios desta entidade" },
];

const ROTULO_TIPO: Record<TipoNo, string> = {
  empresa: "Empresa",
  pessoa: "Pessoa",
  "orgao-federal": "Órgão federal",
  "orgao-am": "Órgão do Amazonas",
  sancao: "Sanção",
  beneficio: "Benefício fiscal",
  registro: "Registro (SUFRAMA)",
  parlamentar: "Autor de emenda",
  emenda: "Emenda parlamentar",
  cargo: "Cargo público (PEP)",
};

/** Os mesmos ícones das telas do app: empresa como na de CNPJ, pessoa como na de CPF, sanção como na de Sanções. */
const ICONE_TIPO: Record<TipoNo, LucideIcon> = {
  empresa: Building2,
  pessoa: UserRound,
  "orgao-federal": Landmark,
  "orgao-am": Landmark,
  sancao: ShieldAlert,
  beneficio: BadgePercent,
  registro: Factory,
  parlamentar: Vote,
  emenda: ScrollText,
  cargo: BriefcaseBusiness,
};

const TIPOS = Object.keys(ICONE_TIPO) as TipoNo[];

/** Filtros de visualização: ocultar uma fonte esconde a ligação e, com ela, o ponto que fica sem nenhuma ligação visível. */
const GRUPOS_FILTRO: { grupo: string; itens: { fonte: FonteAresta; rotulo: string }[] }[] = [
  {
    grupo: "Relações diretas",
    itens: [
      { fonte: "socio", rotulo: "Sócios" },
      { fonte: "federal", rotulo: "Contratos e pagamentos (federal)" },
      { fonte: "federal-empenho", rotulo: "Empenhos a receber (federal)" },
      { fonte: "am", rotulo: "Contratos (Governo do Amazonas)" },
      { fonte: "am-empenho", rotulo: "Empenhos a receber (Amazonas)" },
      { fonte: "convenio", rotulo: "Convênios" },
      { fonte: "beneficio", rotulo: "Benefícios fiscais" },
      { fonte: "registro", rotulo: "SUFRAMA" },
    ],
  },
  {
    grupo: "Sanções e PEP",
    itens: [
      { fonte: "sancao", rotulo: "Sanções" },
      { fonte: "pep", rotulo: "Pessoa politicamente exposta" },
      { fonte: "servidor", rotulo: "Vínculo de servidor público" },
    ],
  },
  {
    grupo: "Emendas parlamentares",
    itens: [
      { fonte: "autoria", rotulo: "Autoria de emenda" },
      { fonte: "emenda-pagamento", rotulo: "Quem recebeu a emenda" },
    ],
  },
  {
    grupo: "Coincidências",
    itens: [
      { fonte: "dominio", rotulo: "Mesmo dono de domínio" },
      { fonte: "mesmo-endereco", rotulo: "Mesmo endereço" },
      { fonte: "mesmo-telefone", rotulo: "Mesmo telefone" },
      { fonte: "mesmo-email", rotulo: "Mesmo e-mail" },
    ],
  },
];

type EstadoCpf = { status: "carregando" } | { status: "ok" } | { status: "erro"; mensagem: string };

/** "***455835**" → "***.455.835-**", como a tela de CPF mostra. */
function formatarCpfMascarado(documento: string | undefined): string {
  const d = (documento ?? "").replace(/\D/g, "");
  return d.length === 6 ? `***.${d.slice(0, 3)}.${d.slice(3)}-**` : (documento ?? "");
}

// ---------------------------------------------------------------------------
// Cores do grafo: o Cytoscape desenha em canvas e precisa de cores prontas, então
// elas saem das variáveis do tema (app/globals.css), com o valor do tema de reserva.
// ---------------------------------------------------------------------------

function ehEscuro(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Como cada tipo de ponto aparece: fundo do círculo, cor do ícone e, nos pontos de apoio, um contorno. */
type Visual = { fundo: string; icone: string; borda?: string };

function cores(escuro: boolean) {
  const estilo = getComputedStyle(document.documentElement);
  const v = (nome: string, reserva: string) => estilo.getPropertyValue(`--color-${nome}`).trim() || reserva;
  const branco = "#ffffff";
  const empresa = v("primary-600", "#2563eb");
  const roxo = v("accent-600", "#7c3aed");
  const perigo = v("danger-600", "#dc2626");
  const atencao = v("warning-600", "#d97706");
  const emenda = v("success-600", "#059669");
  const tipos: Record<TipoNo, Visual> = {
    empresa: { fundo: empresa, icone: branco },
    pessoa: { fundo: v("ink-500", "#64748b"), icone: branco },
    "orgao-federal": { fundo: roxo, icone: branco },
    "orgao-am": escuro
      ? { fundo: v("accent-900", "#4c1d95"), icone: v("accent-300", "#c4b5fd"), borda: roxo }
      : { fundo: v("accent-100", "#ede9fe"), icone: v("accent-700", "#6d28d9"), borda: roxo },
    sancao: { fundo: perigo, icone: branco },
    beneficio: escuro
      ? { fundo: v("primary-900", "#1e3a8a"), icone: v("primary-200", "#bfdbfe"), borda: v("primary-500", "#3b82f6") }
      : { fundo: v("primary-100", "#dbeafe"), icone: v("primary-700", "#1d4ed8"), borda: v("primary-500", "#3b82f6") },
    registro: escuro
      ? { fundo: v("ink-800", "#1e293b"), icone: v("ink-300", "#cbd5e1"), borda: v("ink-500", "#64748b") }
      : { fundo: v("ink-100", "#f1f5f9"), icone: v("ink-600", "#475569"), borda: v("ink-400", "#94a3b8") },
    parlamentar: escuro ? { fundo: v("ink-200", "#e2e8f0"), icone: v("ink-900", "#0f172a") } : { fundo: v("ink-800", "#1e293b"), icone: branco },
    emenda: { fundo: emenda, icone: branco },
    cargo: { fundo: atencao, icone: branco },
  };
  return {
    tipos,
    texto: escuro ? v("ink-200", "#e2e8f0") : v("ink-700", "#334155"),
    fundo: escuro ? v("ink-900", "#0f172a") : branco,
    empresa,
    emenda,
    perigo,
    atencao,
    linha: escuro ? v("ink-600", "#475569") : v("ink-300", "#cbd5e1"),
    linhaSancao: escuro ? v("danger-900", "#7f1d1d") : v("danger-200", "#fecaca"),
    foco: v("primary-500", "#3b82f6"),
  };
}

/** SVG de cada ícone, lido dos ícones do lucide que a tela desenha escondidos (o traço vem em `currentColor`). */
type Icones = Partial<Record<TipoNo, string>>;

function lerIcones(raiz: HTMLElement | null): Icones {
  const icones: Icones = {};
  raiz?.querySelectorAll<SVGSVGElement>("svg[data-tipo]").forEach((svg) => {
    icones[svg.dataset.tipo as TipoNo] = svg.outerHTML;
  });
  return icones;
}

/** O ícone pintado na cor pedida, como imagem pro canvas. */
function imagem(svg: string | undefined, cor: string): string {
  if (!svg) return "none";
  // Tamanho natural de 96px: com zoom o ícone continua nítido.
  const pintado = svg
    .replace(/currentColor/g, cor)
    .replace('width="24"', 'width="96"')
    .replace('height="24"', 'height="96"');
  return `data:image/svg+xml;utf8,${encodeURIComponent(pintado)}`;
}

const TAMANHO: Record<TipoNo, number> = {
  empresa: 34,
  pessoa: 28,
  "orgao-federal": 32,
  "orgao-am": 32,
  sancao: 26,
  beneficio: 28,
  registro: 28,
  parlamentar: 32,
  emenda: 30,
  cargo: 26,
};

function estilos(c: ReturnType<typeof cores>, icones: Icones): StylesheetJson {
  return [
    {
      selector: "node",
      style: {
        label: "data(rotulo)",
        "font-size": 11,
        "font-family": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: c.texto,
        "text-valign": "bottom",
        "text-margin-y": 6,
        "text-wrap": "ellipsis",
        "text-max-width": "130px",
        "text-background-color": c.fundo,
        "text-background-opacity": 0.85,
        "text-background-padding": "2px",
        "text-background-shape": "roundrectangle",
        shape: "ellipse",
        "background-width": "56%",
        "background-height": "56%",
        "border-width": 0,
      },
    },
    // O tipo do ponto está no ícone e na cor; a forma é sempre um círculo.
    ...TIPOS.map((tipo) => {
      const visual = c.tipos[tipo];
      return {
        selector: `node[tipo = "${tipo}"]`,
        style: {
          "background-color": visual.fundo,
          "background-image": imagem(icones[tipo], visual.icone),
          width: TAMANHO[tipo],
          height: TAMANHO[tipo],
          "border-width": visual.borda ? 2 : 0,
          "border-color": visual.borda ?? visual.fundo,
        },
      };
    }),
    { selector: 'node[tipo = "empresa"][?expandida]', style: { width: 44, height: 44, "font-weight": 600 } },
    // Empresa só citada (sócia de outra, ou quem recebeu uma emenda), ainda não aberta: contorno tracejado.
    {
      selector: 'node[tipo = "empresa"][!expandida]',
      style: {
        "background-color": c.fundo,
        "background-image": imagem(icones.empresa, c.empresa),
        "border-width": 2,
        "border-style": "dashed",
        "border-color": c.empresa,
      },
    },
    { selector: 'node[alerta = "perigo"]', style: { "border-width": 4, "border-color": c.perigo, "border-style": "solid" } },
    { selector: 'node[alerta = "atencao"]', style: { "border-width": 4, "border-color": c.atencao, "border-style": "solid" } },
    { selector: "node:selected", style: { "overlay-color": c.foco, "overlay-opacity": 0.2, "overlay-padding": 6 } },
    {
      selector: "edge",
      style: { width: "data(largura)", "line-color": c.linha, "curve-style": "bezier", opacity: 0.85 },
    },
    { selector: 'edge[tipo = "sancao"]', style: { "line-color": c.linhaSancao } },
    { selector: 'edge[tipo = "emenda-pagamento"]', style: { "line-color": c.emenda } },
    { selector: 'edge[tipo = "pep"], edge[tipo = "servidor"], edge[tipo = "dominio"]', style: { "line-style": "dashed" } },
    {
      selector: 'edge[tipo = "mesmo-endereco"], edge[tipo = "mesmo-telefone"], edge[tipo = "mesmo-email"]',
      style: { "line-style": "dashed", "line-color": c.atencao, width: 2 },
    },
    // O texto de cada ligação fica no painel: no desenho ele cobria os pontos.
    { selector: "edge.destaque", style: { "line-color": c.foco, opacity: 1, "z-index": 10 } },
    { selector: ".apagado", style: { opacity: 0.22 } },
    // Filtros de visualização: a ligação some, e o ponto some junto se ficar sem nenhuma ligação visível.
    { selector: ".filtro-oculto", style: { display: "none" } },
  ];
}

/** Espessura da linha pelo dinheiro: R$ 1 mil → 1,5px; R$ 1 milhão → 4,5px; teto de 6px. */
function largura(valor: number | undefined): number {
  if (!valor || valor <= 0) return 1.5;
  return 1.5 + Math.min(4.5, Math.max(0, Math.log10(valor) - 3));
}

const LAYOUT: CoseLayoutOptions = {
  name: "cose",
  animate: true,
  animationDuration: 450,
  randomize: false,
  fit: true,
  padding: 40,
  nodeDimensionsIncludeLabels: true,
  nodeRepulsion: () => 9000,
  idealEdgeLength: () => 90,
};

// ---------------------------------------------------------------------------

/** O círculo com ícone da legenda: as mesmas cores que `cores()` dá ao mapa. */
function Marcador({ tipo, classe }: { tipo: TipoNo; classe: string }) {
  const Icone = ICONE_TIPO[tipo];
  return (
    <span className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full", classe)} aria-hidden>
      <Icone className="h-3 w-3" />
    </span>
  );
}

const LEGENDA: [string, TipoNo, string][] = [
  ["Empresa", "empresa", "bg-primary-600 text-white"],
  ["Empresa ainda não aberta", "empresa", "border-2 border-dashed border-primary-600 bg-white text-primary-600 dark:bg-ink-900"],
  ["Pessoa", "pessoa", "bg-ink-500 text-white"],
  ["Órgão federal", "orgao-federal", "bg-accent-600 text-white"],
  [
    "Órgão do Amazonas",
    "orgao-am",
    "border-2 border-accent-600 bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-300",
  ],
  ["Sanção", "sancao", "bg-danger-600 text-white"],
  [
    "Benefício fiscal",
    "beneficio",
    "border-2 border-primary-500 bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200",
  ],
  ["SUFRAMA", "registro", "border-2 border-ink-400 bg-ink-100 text-ink-600 dark:border-ink-500 dark:bg-ink-800 dark:text-ink-300"],
  ["Autor de emenda", "parlamentar", "bg-ink-800 text-white dark:bg-ink-200 dark:text-ink-900"],
  ["Emenda", "emenda", "bg-success-600 text-white"],
  ["Cargo público (PEP)", "cargo", "bg-warning-600 text-white"],
];

/**
 * Um ícone da legenda. O nome só aparece ao passar o mouse, ao clicar (é o
 * que funciona no toque) ou ao chegar pelo teclado. Perto das bordas da tela
 * a dica abre pra dentro, em vez de centrada no ícone.
 */
function ItemLegenda({
  rotulo,
  aberto,
  onAlternar,
  children,
}: {
  rotulo: string;
  aberto: boolean;
  onAlternar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const [lado, setLado] = useState<"esquerda" | "centro" | "direita">("centro");

  function posicionar() {
    const caixa = ref.current?.getBoundingClientRect();
    if (!caixa) return;
    const meio = caixa.left + caixa.width / 2;
    setLado(meio < 140 ? "esquerda" : meio > window.innerWidth - 140 ? "direita" : "centro");
  }

  return (
    <li ref={ref} className="group relative" onPointerEnter={posicionar} onFocus={posicionar}>
      <button
        type="button"
        aria-label={rotulo}
        onClick={() => {
          posicionar();
          onAlternar();
        }}
        className="peer inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1 hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-ink-800"
      >
        {children}
      </button>
      {/* O nome acessível já está no botão: a dica é só visual. */}
      <span
        role="tooltip"
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-full z-20 mb-1.5 w-max max-w-64 rounded-md bg-ink-900 px-2 py-1 text-xs text-white shadow-popover dark:bg-ink-100 dark:text-ink-900",
          lado === "esquerda" ? "left-0" : lado === "direita" ? "right-0" : "left-1/2 -translate-x-1/2",
          aberto ? "block" : "hidden group-hover:block peer-focus-visible:block",
        )}
      >
        {rotulo}
      </span>
    </li>
  );
}

function Legenda() {
  // O item aberto por clique; passar o mouse e o foco do teclado abrem sem estado.
  const [aberto, setAberto] = useState<string | null>(null);
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoTocarFora(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setAberto(null);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(null);
    }
    document.addEventListener("pointerdown", aoTocarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoTocarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const itens: { rotulo: string; amostra: ReactNode }[] = [
    ...LEGENDA.map(([rotulo, tipo, classe]) => ({ rotulo, amostra: <Marcador tipo={tipo} classe={classe} /> })),
    {
      rotulo: "Empenho a receber",
      amostra: <span className="inline-block w-5 border-t-2 border-dotted border-primary-400" aria-hidden />,
    },
    {
      rotulo: "Dono do domínio do e-mail",
      amostra: <span className="inline-block w-5 border-t-2 border-dashed border-ink-300 dark:border-ink-600" aria-hidden />,
    },
    {
      rotulo: "Contorno vermelho: sanção · âmbar: atenção (inativa, PEP)",
      amostra: <Marcador tipo="empresa" classe="border-2 border-danger-600 bg-primary-600 text-white" />,
    },
  ];

  return (
    <ul ref={ref} aria-label="Legenda do mapa" className="flex flex-wrap items-center gap-1">
      {itens.map(({ rotulo, amostra }) => (
        <ItemLegenda
          key={rotulo}
          rotulo={rotulo}
          aberto={aberto === rotulo}
          onAlternar={() => setAberto((atual) => (atual === rotulo ? null : rotulo))}
        >
          {amostra}
        </ItemLegenda>
      ))}
    </ul>
  );
}

const TOM_CRUZAMENTO = { perigo: "danger", atencao: "warning", info: "primary" } as const;
const ROTULO_CRUZAMENTO: Record<Cruzamento["tipo"], string> = {
  "socio-comum": "Sócio",
  "orgao-comum": "Órgão",
  "beneficio-comum": "Benefício",
  "mesmo-endereco": "Endereço",
  "mesmo-telefone": "Telefone",
  "mesmo-email": "E-mail",
  "sancionada-com-contratos": "Sanção",
  "emenda-para-sancionada": "Emenda",
  "socio-com-alerta": "Sócio",
  "mesmo-dono-dominio": "Domínio",
};

/** Resumo por gravidade, ao lado do título da lista de cruzamentos. */
function ResumoCruzamentosBadge({ resumo }: { resumo: ResumoCruzamentos }) {
  if (resumo.perigo > 0) {
    return (
      <Badge tone="danger" icon={<TriangleAlert className="h-3 w-3" aria-hidden />}>
        {resumo.perigo} de risco
      </Badge>
    );
  }
  if (resumo.atencao > 0) {
    return (
      <Badge tone="warning" icon={<TriangleAlert className="h-3 w-3" aria-hidden />}>
        {resumo.atencao} pra atenção
      </Badge>
    );
  }
  if (resumo.total > 0) return <Badge>{resumo.total}</Badge>;
  return null;
}

/**
 * Os cruzamentos lado a lado, numa faixa que rola na horizontal. Fora da tela
 * cheia é um card abaixo do mapa; na tela cheia (`flutuante`), uma faixa por
 * cima do mapa, com botão de recolher.
 */
function ListaCruzamentos({
  cruzamentos,
  resumo,
  onFocar,
  pontos,
  flutuante = false,
  onRecolher,
  className,
}: {
  cruzamentos: Cruzamento[];
  resumo: ResumoCruzamentos;
  onFocar: (id: string) => void;
  pontos: number;
  flutuante?: boolean;
  onRecolher?: () => void;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="titulo-cruzamentos"
      className={cn(
        "min-w-0 border border-ink-200 dark:border-ink-700",
        flutuante
          ? "rounded-xl bg-white/95 p-3 shadow-popover backdrop-blur dark:bg-ink-900/95"
          : "rounded-[10px] bg-white p-5 shadow-card dark:bg-ink-900",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="titulo-cruzamentos"
          className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400"
        >
          Cruzamentos encontrados
          <ResumoCruzamentosBadge resumo={resumo} />
        </h2>
        {onRecolher && (
          <button
            type="button"
            onClick={onRecolher}
            aria-label="Recolher cruzamentos"
            title="Recolher cruzamentos"
            className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-200"
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {cruzamentos.length === 0 ? (
        <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
          {pontos < 2
            ? "Adicione outra empresa ou uma emenda para o mapa procurar sócios, órgãos, endereço, telefone ou e-mail em comum."
            : "Nenhum cruzamento no mapa até agora."}
        </p>
      ) : (
        // Uma linha só, que se arrasta na horizontal com o mouse (ou com o dedo, no celular).
        <ul
          ref={arrastarParaRolar}
          className={cn(
            "scrollbar-fina flex cursor-grab gap-3 overflow-x-auto pb-2 data-[arrastando=true]:cursor-grabbing data-[arrastando=true]:select-none",
            flutuante ? "mt-2" : "mt-3",
          )}
        >
          {cruzamentos.map((c) => (
            <li key={c.id} className="w-72 shrink-0">
              <button
                type="button"
                onClick={() => onFocar(c.foco)}
                className="h-full w-full cursor-[inherit] rounded-lg border border-ink-200 p-2.5 text-left hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-ink-700 dark:hover:bg-ink-800"
              >
                <span className="flex items-center gap-1.5">
                  <Badge tone={TOM_CRUZAMENTO[c.gravidade]}>{ROTULO_CRUZAMENTO[c.tipo]}</Badge>
                  <span className="text-sm font-medium text-ink-900 dark:text-ink-50">{c.titulo}</span>
                </span>
                <span className="mt-1 block text-xs text-ink-500 dark:text-ink-400">{c.descricao}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ListaFontes({ fontes }: { fontes: Partial<Record<Fonte, EstadoFonte>> }) {
  return (
    <ul className="space-y-0.5 text-xs text-ink-500 dark:text-ink-400">
      {(Object.keys(fontes) as Fonte[]).map((f) => (
        <li key={f} className="flex items-center gap-1.5">
          {fontes[f] === "carregando" ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
          ) : (
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                fontes[f] === "erro" || fontes[f] === "limite"
                  ? "bg-danger-600"
                  : fontes[f] === "vazio"
                    ? "bg-ink-300 dark:bg-ink-600"
                    : "bg-success-600",
              )}
              aria-hidden
            />
          )}
          {ROTULO_FONTE[f]}: {ROTULO_ESTADO[fontes[f] ?? "vazio"]}
        </li>
      ))}
    </ul>
  );
}

/** CPF completo de um sócio, conferido com os dígitos que a Receita mostra antes de consultar. */
function ConsultaCpfSocio({
  no,
  estado,
  onConsultar,
}: {
  no: NoSinapse;
  estado?: EstadoCpf;
  onConsultar: (idPessoa: string, documento: string | undefined, cpf: string) => void;
}) {
  const [cpf, setCpf] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (cpf.trim()) onConsultar(no.id, no.documento, cpf);
      }}
      className="rounded-lg border border-ink-200 p-3 dark:border-ink-700"
    >
      <Input
        label="CPF completo deste sócio"
        placeholder="000.000.000-00"
        inputMode="numeric"
        autoComplete="off"
        leftIcon={<UserRound className="h-4 w-4" aria-hidden />}
        value={cpf}
        maxLength={14}
        error={estado?.status === "erro" ? estado.mensagem : undefined}
        onChange={(e) => setCpf(mascararCpf(e.target.value))}
        onClear={() => setCpf("")}
      />
      <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
        Precisa bater com os dígitos que a Receita mostra ({formatarCpfMascarado(no.documento)}). Traz sanções, PEP e vínculo
        de servidor. O CPF não fica guardado.
      </p>
      <Button type="submit" size="sm" className="mt-2" loading={estado?.status === "carregando"}>
        Consultar CPF
      </Button>
    </form>
  );
}

function PainelNo({
  no,
  modelo,
  fontes,
  estadoCpf,
  onSelecionar,
  onAbrir,
  onCentralizar,
  onCarregar,
  onConsultarCpf,
}: {
  no: NoSinapse;
  modelo: ModeloSinapse;
  fontes?: Partial<Record<Fonte, EstadoFonte>>;
  estadoCpf?: EstadoCpf;
  onSelecionar: (id: string) => void;
  onAbrir: (cnpj: string) => void;
  onCentralizar: (id: string) => void;
  onCarregar: (cnpj: string, fonte: FonteSobDemanda, razaoSocial?: string) => void;
  onConsultarCpf: (idPessoa: string, documento: string | undefined, cpf: string) => void;
}) {
  const ligacoes = Object.values(modelo.arestas)
    .filter((a) => a.origem === no.id || a.destino === no.id)
    .map((a) => ({ aresta: a, outro: modelo.nos[a.origem === no.id ? a.destino : a.origem] }))
    .filter((l) => l.outro);
  const razaoSocial = no.info.find(([k]) => k === "Razão social")?.[1];
  const pendentes = no.tipo === "empresa" && no.expandida && no.cnpj ? SOB_DEMANDA.filter((s) => !fontes?.[s.fonte]) : [];
  // Só sócio pessoa física com CPF mascarado de verdade pode ser conferido.
  const podeConsultarCpf = no.tipo === "pessoa" && !no.cpfConsultado && (no.documento ?? "").replace(/\D/g, "").length === 6;

  return (
    <div className="space-y-4">
      {/* pr-8: espaço do botão de recolher o painel, no canto. */}
      <div className="pr-8">
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
          {ROTULO_TIPO[no.tipo]}
          {no.alerta === "perigo" && <Badge tone="danger">Atenção</Badge>}
          {no.alerta === "atencao" && <Badge tone="warning">Atenção</Badge>}
        </p>
        <p className="mt-1 text-base font-semibold text-ink-900 dark:text-ink-50">{no.rotulo}</p>
        {no.detalhe && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{no.detalhe}</p>}
      </div>

      {/* Uma coluna só: rótulo em cima, valor embaixo — o painel é estreito demais pra lado a lado. */}
      <dl className="space-y-2.5 text-sm">
        {no.info.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-xs text-ink-500 dark:text-ink-400">{rotulo}</dt>
            <dd className="mt-0.5 break-words text-ink-700 dark:text-ink-200">{valor}</dd>
          </div>
        ))}
      </dl>

      {fontes && <ListaFontes fontes={fontes} />}

      <div className="flex flex-wrap gap-2">
        {no.tipo === "empresa" && no.cnpj && !no.expandida && (
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => onAbrir(no.cnpj!)}>
            Abrir ligações desta empresa
          </Button>
        )}
        {pendentes.map((s) => (
          <Button
            key={s.fonte}
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() => onCarregar(no.cnpj!, s.fonte, razaoSocial)}
          >
            {s.botao}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => onCentralizar(no.id)}>
          Centralizar
        </Button>
        {no.tipo === "empresa" && no.cnpj && (
          <Link
            href={`/cnpj?cnpj=${no.cnpj}`}
            target="_blank"
            rel="noopener"
            className="inline-flex h-8 items-center gap-1 px-1 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            Consulta completa
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">(abre em nova aba)</span>
          </Link>
        )}
      </div>
      {pendentes.length > 0 && (
        <p className="text-xs text-ink-400 dark:text-ink-500">
          Empenhos e convênios são consultas pesadas: só entram no mapa quando você pede. Convênios procura pelo nome da
          entidade, então só acham prefeituras, secretarias e entidades que recebem repasse.
        </p>
      )}

      {podeConsultarCpf && <ConsultaCpfSocio no={no} estado={estadoCpf} onConsultar={onConsultarCpf} />}

      {ligacoes.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">Ligações ({ligacoes.length})</p>
          <ul className="mt-1.5 space-y-1">
            {ligacoes.map(({ aresta, outro }) => (
              <li key={aresta.id}>
                <button
                  type="button"
                  onClick={() => onSelecionar(outro.id)}
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-ink-800"
                >
                  <span className="block text-sm text-ink-900 dark:text-ink-50">{outro.rotulo}</span>
                  <span className="block text-xs text-ink-500 dark:text-ink-400">{aresta.rotulo}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function listaDaUrl(valor: string | null): string[] {
  return (valor ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function SinapseClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const containerRef = useRef<HTMLDivElement>(null);
  const moldesRef = useRef<HTMLDivElement>(null);
  const iconesRef = useRef<Icones>({});
  const cyRef = useRef<Core | null>(null);
  const layoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const iniciais = useRef({ cnpjs: listaDaUrl(searchParams.get("cnpj")), emendas: listaDaUrl(searchParams.get("emenda")) });

  const [pronto, setPronto] = useState(false);
  const [modelo, setModelo] = useState<ModeloSinapse>(MODELO_VAZIO);
  // Fontes da verdade do que está aberto: os estados só servem pra redesenhar a tela.
  const abertasRef = useRef<string[]>([]);
  const emendasRef = useRef<string[]>([]);
  const [abertas, setAbertas] = useState<string[]>([]);
  const [emendas, setEmendas] = useState<string[]>([]);
  const [fontes, setFontes] = useState<Record<string, Partial<Record<Fonte, EstadoFonte>>>>({});
  const [consultasCpf, setConsultasCpf] = useState<Record<string, EstadoCpf>>({});
  const [selecionado, setSelecionado] = useState<string | null>(null);
  // O painel lateral pode ser recolhido pra dar a largura toda ao mapa. Escolher um
  // ponto (no mapa ou num cruzamento) o abre de novo: é lá que ficam os detalhes.
  const [painelAberto, setPainelAberto] = useState(true);
  // Tela cheia: o mapa cobre o site inteiro, com o painel e os cruzamentos flutuando
  // dentro dele. Fora dela, o painel fica ao lado e os cruzamentos embaixo.
  const [telaCheia, setTelaCheia] = useState(false);
  const [cruzamentosAbertos, setCruzamentosAbertos] = useState(true);

  useEffect(() => {
    if (!telaCheia) return;
    // A página de trás não rola, e Esc sai — como numa janela.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setTelaCheia(false);
    }
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [telaCheia]);
  const [modo, setModo] = useState<"cnpj" | "emenda">("cnpj");
  const [valor, setValor] = useState("");
  const [erroForm, setErroForm] = useState<string | undefined>();
  const [formAberto, setFormAberto] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  useClickOutside(formRef, () => setFormAberto(false), formAberto);

  const [ocultos, setOcultos] = useState<Set<FonteAresta>>(() => new Set());
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const filtrosRef = useRef<HTMLDivElement>(null);
  useClickOutside(filtrosRef, () => setFiltrosAberto(false), filtrosAberto);
  function alternarFiltro(fonte: FonteAresta) {
    setOcultos((atual) => {
      const novo = new Set(atual);
      if (novo.has(fonte)) novo.delete(fonte);
      else novo.add(fonte);
      return novo;
    });
  }

  const cruzamentos = useMemo(() => encontrarCruzamentos(modelo), [modelo]);
  const resumo = useMemo(() => resumirCruzamentos(cruzamentos), [cruzamentos]);
  const consultando = Object.values(fontes).reduce(
    (s, f) => s + Object.values(f).filter((e) => e === "carregando").length,
    0,
  );

  // Monta o Cytoscape só no navegador (ele mexe no DOM e no canvas).
  useEffect(() => {
    let cancelado = false;
    let cy: Core | undefined;
    (async () => {
      const { default: cytoscape } = await import("cytoscape");
      if (cancelado || !containerRef.current) return;
      iconesRef.current = lerIcones(moldesRef.current);
      cy = cytoscape({
        container: containerRef.current,
        style: estilos(cores(ehEscuro()), iconesRef.current),
        minZoom: 0.2,
        maxZoom: 3,
        boxSelectionEnabled: false,
      });
      cy.on("tap", "node", (e) => {
        setSelecionado(e.target.id());
        setPainelAberto(true);
      });
      cy.on("tap", (e) => {
        if (e.target === cy) setSelecionado(null);
      });
      cyRef.current = cy;
      setPronto(true);
    })();

    // O tema troca pela classe .dark no <html>: redesenha com as cores do novo tema.
    const observador = new MutationObserver(() => cyRef.current?.style(estilos(cores(ehEscuro()), iconesRef.current)));
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // O canvas não acompanha sozinho a caixa (celular girando, painel abrindo): ajusta e reenquadra.
    const redimensionar = new ResizeObserver(() => {
      const atual = cyRef.current;
      if (!atual) return;
      atual.resize();
      if (atual.elements().nonempty()) atual.fit(undefined, 40);
    });
    if (containerRef.current) redimensionar.observe(containerRef.current);

    return () => {
      cancelado = true;
      observador.disconnect();
      redimensionar.disconnect();
      clearTimeout(layoutTimer.current);
      cy?.destroy();
      cyRef.current = null;
    };
  }, []);

  // Leva o modelo pro grafo: acrescenta o que é novo, atualiza o resto e reorganiza.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !pronto) return;
    const ids = new Set<string>();
    let novos = 0;
    cy.batch(() => {
      for (const no of Object.values(modelo.nos)) {
        ids.add(no.id);
        const dados = { id: no.id, rotulo: no.rotulo, tipo: no.tipo, alerta: no.alerta ?? "", expandida: Boolean(no.expandida) };
        const el = cy.getElementById(no.id);
        if (el.nonempty()) {
          el.data(dados);
          continue;
        }
        // Nasce perto de um vizinho já desenhado, pra não voar do canto da tela.
        const ligacao = Object.values(modelo.arestas).find((a) => a.origem === no.id || a.destino === no.id);
        const vizinho = ligacao ? cy.getElementById(ligacao.origem === no.id ? ligacao.destino : ligacao.origem) : undefined;
        const base = vizinho?.nonempty() ? vizinho.position() : { x: 0, y: 0 };
        cy.add({
          group: "nodes",
          data: dados,
          position: { x: base.x + (Math.random() - 0.5) * 120, y: base.y + (Math.random() - 0.5) * 120 },
        });
        novos++;
      }
      for (const a of Object.values(modelo.arestas)) {
        if (!ids.has(a.origem) || !ids.has(a.destino)) continue;
        ids.add(a.id);
        const dados = {
          id: a.id,
          source: a.origem,
          target: a.destino,
          tipo: a.tipo,
          rotulo: a.rotulo,
          largura: largura(a.valor),
          fontes: a.fontes ?? [a.tipo],
        };
        const el = cy.getElementById(a.id);
        if (el.nonempty()) el.data({ rotulo: dados.rotulo, largura: dados.largura, fontes: dados.fontes });
        else {
          cy.add({ group: "edges", data: dados });
          novos++;
        }
      }
      cy.elements().forEach((el) => {
        if (!ids.has(el.id())) el.remove();
      });
    });
    if (novos > 0) {
      // As respostas chegam em rajadas: espera um instante pra reorganizar uma vez só.
      clearTimeout(layoutTimer.current);
      layoutTimer.current = setTimeout(() => cyRef.current?.layout(LAYOUT).run(), 150);
    }
  }, [modelo, pronto]);

  // Filtros de visualização: esconde as ligações das fontes ocultas, e junto, o ponto que fica sem nenhuma visível.
  // Empresa e emenda são o que foi pesquisado: ficam visíveis mesmo sem ligações.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !pronto) return;
    cy.batch(() => {
      cy.edges().forEach((e) => {
        const fontesArestas = (e.data("fontes") as FonteAresta[] | undefined) ?? [];
        e.toggleClass("filtro-oculto", fontesArestas.length > 0 && fontesArestas.every((f) => ocultos.has(f)));
      });
      cy.nodes().forEach((n) => {
        const tipo = n.data("tipo") as TipoNo;
        if (tipo === "empresa" || tipo === "emenda") {
          n.removeClass("filtro-oculto");
          return;
        }
        n.toggleClass("filtro-oculto", n.connectedEdges().not(".filtro-oculto").empty());
      });
    });
  }, [ocultos, modelo, pronto]);

  // Destaca o ponto escolhido e as ligações dele; apaga o resto.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !pronto) return;
    cy.elements().removeClass("destaque apagado").unselect();
    if (!selecionado) return;
    const no = cy.getElementById(selecionado);
    if (no.empty()) return;
    no.select();
    cy.elements().not(no.closedNeighborhood()).addClass("apagado");
    no.connectedEdges().addClass("destaque");
  }, [selecionado, modelo, pronto]);

  const marcarFonte = useCallback((chave: string, fonte: Fonte, estado: EstadoFonte) => {
    setFontes((f) => ({ ...f, [chave]: { ...f[chave], [fonte]: estado } }));
  }, []);

  /** Uma consulta de uma fonte: `aplicar` põe o resultado no modelo e diz o estado; erro vira "não respondeu". */
  const consultarFonte = useCallback(
    <T,>(chave: string, fonte: Fonte, promessa: Promise<T>, aplicar: (r: T) => EstadoFonte) => {
      marcarFonte(chave, fonte, "carregando");
      promessa.then((r) => marcarFonte(chave, fonte, aplicar(r))).catch(() => marcarFonte(chave, fonte, "erro"));
    },
    [marcarFonte],
  );

  const abrirEmpresa = useCallback(
    (entrada: string, selecionar = true) => {
      const validacao = validarCnpj(entrada);
      if (!validacao.valido) {
        setErroForm(validacao.mensagem);
        return false;
      }
      const cnpj = validacao.cnpj;
      setErroForm(undefined);
      if (selecionar) setSelecionado(idEmpresa(cnpj));

      if (abertasRef.current.includes(cnpj)) return true;
      if (abertasRef.current.length >= MAXIMO_EMPRESAS) {
        setErroForm(`Nesta versão beta o mapa abre até ${MAXIMO_EMPRESAS} empresas. Limpe o mapa para começar outro.`);
        return false;
      }
      abertasRef.current = [...abertasRef.current, cnpj];
      setAbertas(abertasRef.current);
      setModelo((m) => comEmpresaPendente(m, cnpj));

      // Quem registrou o domínio do e-mail (só .br e só domínio próprio, ver lib/dominio-email.ts).
      const consultarDominio = (email: string | undefined) => {
        const dominio = dominioDoEmail(email);
        if (!dominio) return;
        consultarFonte(cnpj, "dominio", buscarRegistroDominio(dominio), (rd) => {
          if (rd.status === "limite") return "limite";
          if (rd.status !== "sucesso") throw new Error("domínio");
          const registro = rd.registro;
          if (!registro?.titular) return "vazio";
          setModelo((m) => comDominio(m, cnpj, registro));
          return "ok";
        });
      };

      consultarFonte(cnpj, "cadastro", buscarEmpresa(cnpj), (r) => {
        if (r.status === "erro_servidor") throw new Error("cadastro");
        if (r.status !== "sucesso") return "vazio";
        setModelo((m) => comCadastro(m, r.empresa));
        consultarDominio(r.empresa.email);
        if (precisaComplemento(r.empresa)) {
          consultarFonte(cnpj, "complemento", buscarComplementoCnpj(cnpj), (rc) => {
            if (rc.status === "limite") return "limite";
            if (rc.status === "erro_servidor") throw new Error("complemento");
            if (rc.status !== "sucesso") return "vazio";
            setModelo((m) => comComplemento(m, cnpj, rc.complemento));
            // Sem e-mail na Receita, vale o corporativo que a CNPJá tiver.
            if (!r.empresa.email) consultarDominio(rc.complemento.emails[0]);
            return rc.complemento.suframa.length || rc.complemento.emails.length ? "ok" : "vazio";
          });
        }
        return "ok";
      });
      consultarFonte(cnpj, "listaSuja", buscarListaSuja(cnpj), (r) => {
        if (r.status !== "sucesso") throw new Error("lista suja");
        setModelo((m) => comListaSuja(m, cnpj, r.registros));
        return r.registros.length ? "ok" : "vazio";
      });
      consultarFonte(cnpj, "sancoes", buscarSancoes(cnpj), (r) => {
        if (r.status === "erro_servidor") throw new Error("sanções");
        if (r.status !== "sucesso") return "vazio";
        const todas = [...r.ceis, ...r.cnep];
        setModelo((m) => comSancoes(m, cnpj, todas));
        return todas.length ? "ok" : "vazio";
      });
      consultarFonte(cnpj, "tcu", buscarCertidaoTcu(cnpj), (r) => {
        if (r.status === "erro_servidor") throw new Error("TCU");
        if (r.status !== "sucesso") return "vazio";
        setModelo((m) => comCertidaoTcu(m, cnpj, r));
        return r.itens.some((i) => i.situacao === "consta" && i.tipo !== "CEIS" && i.tipo !== "CNEP") ? "ok" : "vazio";
      });
      consultarFonte(cnpj, "federal", buscarDadosGovernoFederal(cnpj), (r) => {
        if (r.status === "erro_servidor") throw new Error("governo federal");
        if (r.status !== "sucesso") return "vazio";
        setModelo((m) => {
          const comFederal = comGovernoFederal(m, cnpj, r);
          return r.beneficiosFiscais ? comBeneficiosFiscais(comFederal, cnpj, r.beneficiosFiscais) : comFederal;
        });
        const temAlgo =
          r.contratos?.itens.length ||
          r.pagamentos?.porOrgao.length ||
          r.beneficiosFiscais?.regimes.length ||
          r.beneficiosFiscais?.renunciasPorAno.length;
        return temAlgo ? "ok" : "vazio";
      });
      return true;
    },
    [consultarFonte],
  );

  /** Contratos AM, empenhos e convênios: pesados demais pra entrar sozinhos; o painel da empresa pede. */
  const carregarSobDemanda = useCallback(
    (cnpj: string, fonte: FonteSobDemanda, razaoSocial?: string) => {
      if (fonte === "am") {
        consultarFonte(cnpj, fonte, buscarContratosAm(cnpj), (r) => {
          if (r.status === "erro_servidor") throw new Error("Amazonas");
          if (r.status !== "sucesso") return "vazio";
          setModelo((m) => comContratosAm(m, cnpj, r.contratos));
          return r.contratos.length ? "ok" : "vazio";
        });
      } else if (fonte === "empenhosFederais") {
        consultarFonte(cnpj, fonte, buscarEmpenhosFederais(cnpj), (r) => {
          if (r.status === "limite") return "limite";
          if (r.status === "erro_servidor") throw new Error("empenhos federais");
          if (r.status !== "sucesso") return "vazio";
          setModelo((m) => comEmpenhosFederais(m, cnpj, r));
          return r.totais.aReceber > 0 ? "ok" : "vazio";
        });
      } else if (fonte === "empenhosAm") {
        consultarFonte(cnpj, fonte, buscarEmpenhosAm(cnpj), (r) => {
          if (r.status === "erro_servidor") throw new Error("empenhos AM");
          if (r.status !== "sucesso") return "vazio";
          setModelo((m) => comEmpenhosAm(m, cnpj, r));
          return r.totais.aReceber > 0 ? "ok" : "vazio";
        });
      } else if (razaoSocial) {
        consultarFonte(cnpj, fonte, buscarConvenios({ convenente: razaoSocial, pagina: 1 }), (r) => {
          if (r.status === "erro_servidor") throw new Error("convênios");
          if (r.status !== "sucesso") return "vazio";
          setModelo((m) => comConvenios(m, cnpj, r.itens));
          return r.itens.length ? "ok" : "vazio";
        });
      }
    },
    [consultarFonte],
  );

  const abrirEmenda = useCallback(
    (entrada: string, selecionar = true) => {
      const codigo = entrada.replace(/\D/g, "");
      if (!FORMATO_CODIGO_EMENDA.test(codigo)) {
        setErroForm("Código da emenda inválido: são 12 dígitos, como aparece na tela de Emendas (ex.: 202471040014).");
        return false;
      }
      setErroForm(undefined);
      const id = idEmenda(codigo);
      if (selecionar) setSelecionado(id);
      if (emendasRef.current.includes(codigo)) return true;
      if (emendasRef.current.length >= MAXIMO_EMENDAS) {
        setErroForm(`Nesta versão beta o mapa abre até ${MAXIMO_EMENDAS} emendas. Limpe o mapa para começar outro.`);
        return false;
      }
      emendasRef.current = [...emendasRef.current, codigo];
      setEmendas(emendasRef.current);

      const busca = Promise.all([buscarEmendas({ codigo, pagina: 1 }), buscarDocumentosEmenda(codigo)]);
      consultarFonte(id, "emenda", busca, ([re, rd]) => {
        if (re.status === "erro_servidor") throw new Error("emenda");
        const emenda = re.status === "sucesso" ? re.itens[0] : undefined;
        if (!emenda) {
          setErroForm(`A emenda ${codigo} não foi encontrada no Portal da Transparência.`);
          setFormAberto(true);
          emendasRef.current = emendasRef.current.filter((c) => c !== codigo);
          setEmendas(emendasRef.current);
          return "vazio";
        }
        setModelo((m) => comEmenda(m, emenda, rd.status === "sucesso" ? rd : null));
        return "ok";
      });
      return true;
    },
    [consultarFonte],
  );

  const consultarCpfDoSocio = useCallback(async (idPessoa: string, documento: string | undefined, cpf: string) => {
    const validacao = validarCpf(cpf);
    const erro = (mensagem: string) => setConsultasCpf((c) => ({ ...c, [idPessoa]: { status: "erro", mensagem } }));
    if (!validacao.valido) return erro(validacao.mensagem);
    if (!cpfBateComMascara(validacao.cpf, documento)) {
      return erro(`Esse CPF não bate com os dígitos que a Receita mostra para este sócio (${formatarCpfMascarado(documento)}).`);
    }
    setConsultasCpf((c) => ({ ...c, [idPessoa]: { status: "carregando" } }));
    const r = await consultarCpf(validacao.cpf);
    if (r.status === "sucesso") {
      setModelo((m) => comPessoaFisica(m, idPessoa, r.pessoa));
      setConsultasCpf((c) => ({ ...c, [idPessoa]: { status: "ok" } }));
    } else if (r.status !== "cancelado") {
      erro("mensagem" in r && r.mensagem ? r.mensagem : "Não foi possível consultar o CPF agora.");
    }
  }, []);

  // Abre o que veio na URL (/rastros?cnpj=A,B&emenda=C) quando o grafo fica pronto.
  useEffect(() => {
    if (!pronto) return;
    const { cnpjs, emendas: codigos } = iniciais.current;
    iniciais.current = { cnpjs: [], emendas: [] };
    const sozinho = cnpjs.length + codigos.length === 1;
    for (const c of cnpjs) abrirEmpresa(c, sozinho);
    for (const c of codigos) abrirEmenda(c, sozinho);
  }, [pronto, abrirEmpresa, abrirEmenda]);

  // A URL guarda o que está aberto, pra dar pra compartilhar o mapa.
  useEffect(() => {
    if (!pronto) return;
    const partes = [abertas.length && `cnpj=${abertas.join(",")}`, emendas.length && `emenda=${emendas.join(",")}`].filter(Boolean);
    router.replace(partes.length ? `${pathname}?${partes.join("&")}` : pathname, { scroll: false });
  }, [abertas, emendas, pathname, router, pronto]);

  function adicionar(evento: FormEvent) {
    evento.preventDefault();
    if (!valor.trim()) return;
    const ok = modo === "cnpj" ? abrirEmpresa(valor) : abrirEmenda(valor);
    setValor("");
    if (ok) setFormAberto(false);
  }

  function limpar() {
    abertasRef.current = [];
    emendasRef.current = [];
    setModelo(MODELO_VAZIO);
    setAbertas([]);
    setEmendas([]);
    setFontes({});
    setConsultasCpf({});
    setSelecionado(null);
    setErroForm(undefined);
  }

  // Link que reabre o mapa como está agora (mesmo formato que a URL já aceita pra abrir várias empresas de uma vez).
  const linkCompartilhavel = useMemo(() => {
    const params = new URLSearchParams();
    if (abertas.length > 0) params.set("cnpj", abertas.join(","));
    if (emendas.length > 0) params.set("emenda", emendas.join(","));
    const consulta = params.toString();
    return consulta ? `${pathname}?${consulta}` : pathname;
  }, [abertas, emendas, pathname]);

  const [linkCopiado, setLinkCopiado] = useState(false);
  async function compartilhar() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${linkCompartilhavel}`);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch {
      // Sem permissão de área de transferência (página sem HTTPS, navegador bloqueando).
    }
  }

  // Imagem do mapa como está na tela: cytoscape já sabe desenhar só os elementos visíveis nesse tamanho.
  function exportarImagem() {
    const cy = cyRef.current;
    if (!cy) return;
    const link = document.createElement("a");
    link.href = cy.png({ full: true, scale: 2, bg: ehEscuro() ? "#0f172a" : "#ffffff" });
    link.download = `rastros-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  }

  // Aproxima ou afasta mantendo o meio do mapa no lugar.
  function mudarZoom(fator: number) {
    const cy = cyRef.current;
    if (!cy) return;
    const nivel = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * fator));
    cy.animate({ zoom: { level: nivel, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } } }, { duration: 200 });
  }

  function centralizar(id: string) {
    const cy = cyRef.current;
    const el = cy?.getElementById(id);
    if (cy && el?.nonempty()) cy.animate({ center: { eles: el }, zoom: Math.max(cy.zoom(), 1.2) }, { duration: 300 });
  }

  function focar(id: string) {
    setSelecionado(id);
    setPainelAberto(true);
    centralizar(id);
  }

  const noSelecionado = selecionado ? modelo.nos[selecionado] : undefined;
  const totalNos = Object.keys(modelo.nos).length;
  const totalArestas = Object.keys(modelo.arestas).length;
  const fontesDoSelecionado = noSelecionado?.cnpj
    ? fontes[noSelecionado.cnpj]
    : noSelecionado?.tipo === "emenda"
      ? fontes[noSelecionado.id]
      : undefined;

  // O mesmo conteúdo do painel, ao lado do mapa ou flutuando nele na tela cheia.
  const conteudoPainel = (
    <>
      <button
        type="button"
        onClick={() => setPainelAberto(false)}
        aria-label="Recolher painel"
        title="Recolher o painel e dar a largura toda ao mapa"
        className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-200"
      >
        <PanelRightClose className="h-4 w-4" aria-hidden />
      </button>
      {noSelecionado ? (
        <PainelNo
          key={noSelecionado.id}
          no={noSelecionado}
          modelo={modelo}
          fontes={fontesDoSelecionado}
          estadoCpf={consultasCpf[noSelecionado.id]}
          onSelecionar={focar}
          onAbrir={abrirEmpresa}
          onCentralizar={centralizar}
          onCarregar={carregarSobDemanda}
          onConsultarCpf={consultarCpfDoSocio}
        />
      ) : (
        <p className="pr-8 text-sm text-ink-500 dark:text-ink-400">
          Clique num ponto do mapa para ver os detalhes e as ligações dele.
        </p>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className={cn("grid grid-cols-1 gap-4", painelAberto && !telaCheia && "lg:grid-cols-[minmax(0,1fr)_22rem]")}>
        {/* O mesmo elemento nos dois modos (o Cytoscape está preso ao div do mapa): só as classes mudam. */}
        <div
          role={telaCheia ? "dialog" : undefined}
          aria-modal={telaCheia || undefined}
          aria-label={telaCheia ? "Rastros em tela cheia" : undefined}
          className={cn(
            "min-w-0 bg-white dark:bg-ink-900",
            telaCheia
              ? "fixed inset-0 z-50"
              : "relative self-start rounded-[10px] border border-ink-200 shadow-card dark:border-ink-700",
          )}
        >
          {/* Só o canvas recorta nos cantos arredondados: o resto (popovers, painéis) não pode ficar preso a isso. */}
          <div className={cn("overflow-hidden", !telaCheia && "rounded-[10px]")}>
            <div
              ref={containerRef}
              role="img"
              aria-label={`Mapa de relações com ${totalNos} pontos e ${totalArestas} ligações. Os detalhes de cada ponto ficam no painel e os cruzamentos, na lista de cruzamentos.`}
              className={cn("w-full", telaCheia ? "h-dvh" : "h-[420px] lg:h-[600px]")}
            />
          </div>
          {totalNos === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <Network className="h-8 w-8 text-ink-300 dark:text-ink-600" aria-hidden />
              <p className="text-sm text-ink-500 dark:text-ink-400">
                Adicione um CNPJ ou uma emenda para começar o mapa. Cada empresa traz sócios, órgãos que contratam com
                ela, sanções e benefícios; cada emenda traz o autor e quem recebeu o dinheiro.
              </p>
              <button
                type="button"
                onClick={() => EXEMPLO.forEach((cnpj) => abrirEmpresa(cnpj, false))}
                className="pointer-events-auto text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Ver um exemplo com duas empresas
              </button>
            </div>
          )}
          <div className="absolute right-3 top-3 z-30 flex flex-wrap justify-end gap-2">
            {totalNos > 0 && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label="Ajustar"
                  title="Reenquadrar o mapa"
                  leftIcon={<Maximize2 className="h-4 w-4" aria-hidden />}
                  onClick={() => cyRef.current?.animate({ fit: { eles: cyRef.current.elements().not(".filtro-oculto"), padding: 40 } }, { duration: 300 })}
                >
                  <span className="hidden sm:inline">Ajustar</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={linkCopiado ? "Link copiado" : "Compartilhar"}
                  title="Copiar um link que reabre o mapa como está agora"
                  leftIcon={
                    linkCopiado ? <Check className="h-4 w-4" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />
                  }
                  onClick={compartilhar}
                >
                  <span className="hidden sm:inline">{linkCopiado ? "Link copiado" : "Compartilhar"}</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label="Exportar"
                  title="Baixar o mapa como imagem"
                  leftIcon={<Download className="h-4 w-4" aria-hidden />}
                  onClick={exportarImagem}
                >
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label="Limpar"
                  title="Limpar o mapa"
                  leftIcon={<Trash2 className="h-4 w-4" aria-hidden />}
                  onClick={limpar}
                >
                  <span className="hidden sm:inline">Limpar</span>
                </Button>
                <div className="relative" ref={filtrosRef}>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label="Filtros"
                    title="Mostrar ou ocultar categorias de ligações"
                    leftIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
                    aria-expanded={filtrosAberto}
                    onClick={() => setFiltrosAberto((v) => !v)}
                  >
                    <span className="hidden sm:inline">Filtros</span>
                    {ocultos.size > 0 && <Badge tone="accent" className="ml-1">{ocultos.size}</Badge>}
                  </Button>
                  {filtrosAberto && (
                    <div className="absolute right-0 top-full z-40 mt-2 max-h-[28rem] w-72 overflow-y-auto rounded-[10px] border border-ink-200 bg-white p-4 shadow-popover dark:border-ink-700 dark:bg-ink-900">
                      <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">Mostrar no mapa</p>
                      <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                        Desmarque uma categoria pra ocultar as ligações dela; o ponto some junto se ficar sem nenhuma
                        ligação visível.
                      </p>
                      {GRUPOS_FILTRO.map(({ grupo, itens }) => (
                        <div key={grupo} className="mt-3 first:mt-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{grupo}</p>
                          <div className="mt-1">
                            {itens.map(({ fonte, rotulo }) => (
                              <label
                                key={fonte}
                                className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800"
                              >
                                <input
                                  type="checkbox"
                                  checked={!ocultos.has(fonte)}
                                  onChange={() => alternarFiltro(fonte)}
                                  className="h-4 w-4 shrink-0 rounded border-ink-300 text-primary-600 focus:ring-2 focus:ring-primary-500 dark:border-ink-600 dark:bg-ink-900"
                                />
                                {rotulo}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            {(totalNos > 0 || telaCheia) && (
              <Button
                size="sm"
                variant="secondary"
                aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
                title={telaCheia ? "Sair da tela cheia (Esc)" : "Ver o mapa na tela toda"}
                leftIcon={
                  telaCheia ? <Shrink className="h-4 w-4" aria-hidden /> : <Expand className="h-4 w-4" aria-hidden />
                }
                onClick={() => setTelaCheia((v) => !v)}
              >
                <span className="hidden sm:inline">{telaCheia ? "Sair" : "Tela cheia"}</span>
              </Button>
            )}
            <div className="relative" ref={formRef}>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Adicionar"
                title="Adicionar uma empresa ou emenda ao mapa"
                leftIcon={<Plus className="h-4 w-4" aria-hidden />}
                aria-expanded={formAberto}
                onClick={() => setFormAberto((v) => !v)}
              >
                <span className="hidden sm:inline">Adicionar</span>
              </Button>
              {formAberto && (
                <form
                  onSubmit={adicionar}
                  className="absolute right-0 top-full z-40 mt-2 w-80 rounded-[10px] border border-ink-200 bg-white p-4 shadow-popover dark:border-ink-700 dark:bg-ink-900 sm:w-96"
                >
                  <Select
                    label="Adicionar"
                    hideLabel
                    value={modo}
                    onChange={(e) => {
                      setModo(e.target.value as "cnpj" | "emenda");
                      setValor("");
                      setErroForm(undefined);
                    }}
                  >
                    <option value="cnpj">Empresa (CNPJ)</option>
                    <option value="emenda">Emenda (código)</option>
                  </Select>
                  <div className="mt-3">
                    <Input
                      label={modo === "cnpj" ? "CNPJ" : "Código da emenda"}
                      hideLabel
                      placeholder={modo === "cnpj" ? "00.000.000/0000-00" : "Ex.: 202471040014"}
                      inputMode="numeric"
                      autoFocus
                      leftIcon={
                        modo === "cnpj" ? (
                          <Building2 className="h-4 w-4" aria-hidden />
                        ) : (
                          <ScrollText className="h-4 w-4" aria-hidden />
                        )
                      }
                      value={valor}
                      maxLength={modo === "cnpj" ? 18 : 12}
                      error={erroForm}
                      onChange={(e) => setValor(modo === "cnpj" ? mascararCnpj(e.target.value) : e.target.value.replace(/\D/g, ""))}
                      onClear={() => setValor("")}
                    />
                  </div>
                  <Button type="submit" fullWidth className="mt-3" leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
                    Adicionar ao mapa
                  </Button>
                </form>
              )}
            </div>
            {!painelAberto && (
              <Button
                size="sm"
                variant="secondary"
                aria-label="Mostrar painel"
                title="Mostrar o painel de detalhes"
                leftIcon={<PanelRightOpen className="h-4 w-4" aria-hidden />}
                onClick={() => setPainelAberto(true)}
              >
                <span className="hidden sm:inline">Painel</span>
              </Button>
            )}
          </div>
          {totalNos > 0 && (
            <div
              className={cn(
                "absolute z-10 flex flex-col overflow-hidden rounded-lg border border-ink-200 bg-white shadow-card dark:border-ink-700 dark:bg-ink-900",
                telaCheia && painelAberto ? "right-3 sm:right-[23.25rem]" : "right-3",
                telaCheia ? "top-24" : "bottom-3",
              )}
            >
              {(
                [
                  ["Aproximar", 1.4, Plus],
                  ["Afastar", 1 / 1.4, Minus],
                ] as const
              ).map(([rotulo, fator, Icone], i) => (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => mudarZoom(fator)}
                  aria-label={rotulo}
                  title={rotulo}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center text-ink-600 hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50",
                    i > 0 && "border-t border-ink-200 dark:border-ink-700",
                  )}
                >
                  <Icone className="h-4 w-4" aria-hidden />
                </button>
              ))}
            </div>
          )}
          {consultando > 0 && (
            <p
              className={cn(
                "absolute left-3 z-10 flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs text-ink-600 shadow-card dark:bg-ink-900/95 dark:text-ink-300",
                telaCheia ? "top-3" : "bottom-3",
              )}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Consultando {consultando} {consultando === 1 ? "fonte" : "fontes"}…
            </p>
          )}

          {telaCheia && painelAberto && (
            <aside className="scrollbar-fina absolute bottom-3 right-3 top-24 z-20 flex w-[calc(100%-1.5rem)] flex-col gap-5 overflow-y-auto rounded-xl border border-ink-200 bg-white/95 p-5 shadow-popover backdrop-blur dark:border-ink-700 dark:bg-ink-900/95 sm:w-[22rem]">
              {conteudoPainel}
            </aside>
          )}

          {telaCheia &&
            (cruzamentosAbertos ? (
              <ListaCruzamentos
                cruzamentos={cruzamentos}
                resumo={resumo}
                onFocar={focar}
                pontos={abertas.length + emendas.length}
                flutuante
                onRecolher={() => setCruzamentosAbertos(false)}
                className={cn(
                  "absolute bottom-3 left-3 z-10",
                  painelAberto ? "right-3 sm:right-[23.25rem]" : "right-3",
                )}
              />
            ) : (
              <Button
                size="sm"
                variant={resumo.perigo > 0 ? "danger" : "secondary"}
                className="absolute bottom-3 left-3 z-10"
                aria-label={`Mostrar cruzamentos (${cruzamentos.length})`}
                onClick={() => setCruzamentosAbertos(true)}
              >
                Cruzamentos ({cruzamentos.length})
              </Button>
            ))}
        </div>

        {painelAberto && !telaCheia && (
          <aside className="relative flex min-w-0 flex-col gap-5 rounded-[10px] border border-ink-200 bg-white p-5 shadow-card scrollbar-fina dark:border-ink-700 dark:bg-ink-900 lg:max-h-[600px] lg:overflow-y-auto">
            {conteudoPainel}
          </aside>
        )}
      </div>

      {!telaCheia && (
        <ListaCruzamentos
          cruzamentos={cruzamentos}
          resumo={resumo}
          onFocar={focar}
          pontos={abertas.length + emendas.length}
        />
      )}

      <div className="flex flex-col gap-3">
        <Legenda />
        <p className="flex items-start gap-1.5 text-xs text-ink-400 dark:text-ink-500">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          Versão beta. Fontes: Receita Federal (BrasilAPI), CNPJá, Portal da Transparência (CGU), TCU, MTE, registro.br e
          SEFAZ-AM. O CPF dos
          sócios vem mascarado da Receita, então o mapa liga pessoas pelo nome e pelos dígitos visíveis do CPF, só entre
          pontos que estão no mapa. Cada empresa mostra até 20 órgãos, os de maior valor.
          {abertas.length > 0 && ` Empresas abertas: ${abertas.map((c) => formatarCnpj(c)).join(", ")}.`}
          {emendas.length > 0 && ` Emendas: ${emendas.join(", ")}.`}
        </p>
      </div>

      {/* Moldes dos ícones do mapa: o Cytoscape desenha em canvas, então copia o SVG daqui e usa como imagem. */}
      <div ref={moldesRef} hidden aria-hidden>
        {TIPOS.map((tipo) => {
          const Icone = ICONE_TIPO[tipo];
          return <Icone key={tipo} data-tipo={tipo} />;
        })}
      </div>
    </div>
  );
}
