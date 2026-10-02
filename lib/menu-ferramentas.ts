import {
  Building2,
  FileStack,
  Globe,
  Handshake,
  HeartPulse,
  Landmark,
  MapPin,
  Network,
  Receipt,
  Scale,
  Search,
  ShieldAlert,
  Tag,
  Tags,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ItemMenu {
  href: string;
  label: string;
  icone: LucideIcon;
  ativoEm?: string[];
  beta?: boolean;
}

/**
 * Dado puro (sem "use client"), pra poder ser usado tanto pelo menu lateral
 * (components/MenuFerramentas.tsx, client) quanto pela tela de pouso
 * (app/(app)/page.tsx, server component) — um array exportado de um módulo
 * "use client" vira uma referência de cliente pro lado do servidor, não o
 * array de verdade, e quebra ali.
 */
export const GRUPOS: { titulo: string; itens: ItemMenu[] }[] = [
  {
    titulo: "Licitações e dinheiro público",
    itens: [
      { href: "/licitacoes", label: "Licitações", icone: Search },
      { href: "/atas", label: "Atas", icone: FileStack },
      // As duas telas de empenhos (Amazonas e federal) têm abas entre si.
      { href: "/empenhos-am", label: "Empenhos", icone: Receipt, ativoEm: ["/empenhos-am", "/empenhos-federal"] },
      { href: "/convenios", label: "Convênios", icone: Handshake },
      { href: "/emendas", label: "Emendas", icone: Landmark },
    ],
  },
  {
    titulo: "Empresas e pessoas",
    itens: [
      { href: "/cnpj", label: "CNPJ", icone: Building2 },
      { href: "/cpf", label: "CPF", icone: UserRound },
      { href: "/processos", label: "Processos", icone: Scale },
      { href: "/sancoes", label: "Sanções", icone: ShieldAlert },
      { href: "/rastros", label: "Rastros", icone: Network, beta: true },
    ],
  },
  {
    titulo: "Consultas de apoio",
    itens: [
      { href: "/cep", label: "CEP", icone: MapPin },
      { href: "/dominio", label: "Domínio", icone: Globe },
      { href: "/ncm", label: "NCM", icone: Tag },
      { href: "/produtos-saude", label: "Produtos p/ Saúde", icone: HeartPulse },
      { href: "/nome-tecnico", label: "Nome Técnico", icone: Tags },
    ],
  },
];
