import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "accent";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
  primary: "bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
  success: "bg-success-50 text-success-700 dark:bg-success-900 dark:text-success-300",
  warning: "bg-warning-50 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
  danger: "bg-danger-50 text-danger-700 dark:bg-danger-900 dark:text-danger-300",
  accent: "bg-accent-50 text-accent-700 dark:bg-accent-900 dark:text-accent-300",
};

interface BadgeProps {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
