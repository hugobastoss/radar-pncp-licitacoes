"use client";

import { forwardRef, useId } from "react";
import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hideLabel?: boolean;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hideLabel, hint, className, id, children, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className={cn("text-sm font-medium text-ink-700 dark:text-ink-200", hideLabel && "sr-only")}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-10 w-full appearance-none rounded-lg border border-ink-200 bg-white pl-3 pr-9 text-sm text-ink-900",
            "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100",
            "disabled:bg-ink-50 disabled:text-ink-400",
            "dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50 dark:focus:ring-primary-900",
            "dark:disabled:bg-ink-800 dark:disabled:text-ink-600",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-ink-500"
          aria-hidden
        />
      </div>
      {hint && <p className="text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  );
});
