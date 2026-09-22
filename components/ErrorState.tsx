import type { ComponentType } from "react";
import { AlertTriangle, Clock, RefreshCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

type TipoErro = "timeout" | "servidor" | "conexao";

const CONTEUDO: Record<TipoErro, { icone: ComponentType<{ className?: string }>; titulo: string; texto: string }> = {
  timeout: {
    icone: Clock,
    titulo: "O PNCP demorou para responder",
    texto: "Estamos tentando novamente. Se o problema persistir, tente novamente em alguns instantes.",
  },
  servidor: {
    icone: AlertTriangle,
    titulo: "Não foi possível concluir a consulta neste momento",
    texto: "Tente novamente em instantes.",
  },
  conexao: {
    icone: WifiOff,
    titulo: "Não foi possível realizar a consulta",
    texto: "Verifique sua conexão com a internet e tente novamente.",
  },
};

interface ErrorStateProps {
  tipo: TipoErro;
  mensagem?: string;
  onTentarNovamente: () => void;
}

export function ErrorState({ tipo, mensagem, onTentarNovamente }: ErrorStateProps) {
  const { icone: Icone, titulo, texto } = CONTEUDO[tipo];

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="alert">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <Icone className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-base font-semibold text-ink-900">{titulo}</h3>
      <p className="max-w-sm text-sm text-ink-500">{mensagem ?? texto}</p>
      <Button variant="secondary" leftIcon={<RefreshCcw className="h-4 w-4" aria-hidden />} onClick={onTentarNovamente}>
        Tentar novamente
      </Button>
    </div>
  );
}
