import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

function LinhaSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

function CartaoSkeleton() {
  return (
    <div className="rounded-xl border border-ink-200 p-4 dark:border-ink-700">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-2/3" />
      <Skeleton className="mt-4 h-8 w-full" />
    </div>
  );
}

export function LoadingState({ linhas = 6 }: { linhas?: number }) {
  return (
    <div>
      <div className="flex items-center gap-2 rounded-t-2xl border-b border-ink-200 bg-primary-50 px-4 py-3 text-sm text-primary-700 dark:border-ink-700 dark:bg-primary-900 dark:text-primary-300 sm:px-6">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        <span className="font-medium">Consultando o PNCP…</span>
        <span className="hidden text-primary-600 dark:text-primary-400 sm:inline">
          Estamos consultando os dados diretamente no PNCP. Isso pode levar alguns segundos.
        </span>
      </div>

      <div className="hidden divide-y divide-ink-100 dark:divide-ink-800 sm:block" aria-hidden="true">
        {Array.from({ length: linhas }).map((_, i) => (
          <LinhaSkeleton key={i} />
        ))}
      </div>

      <div className="space-y-3 p-4 sm:hidden" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <CartaoSkeleton key={i} />
        ))}
      </div>

      <span className="sr-only" role="status">
        Consultando o PNCP, aguarde.
      </span>
    </div>
  );
}
