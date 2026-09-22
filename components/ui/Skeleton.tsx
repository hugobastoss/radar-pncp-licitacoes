import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-skeleton rounded-md bg-ink-200 dark:bg-ink-800", className)} aria-hidden="true" />;
}
