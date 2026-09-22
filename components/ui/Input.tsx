"use client";

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  /** Quando definido, mostra um "x" pra limpar o campo assim que houver texto digitado. */
  onClear?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel, hint, error, leftIcon, onClear, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = cn(hintId, errorId) || undefined;
  const mostrarLimpar = Boolean(onClear) && !props.disabled && props.value !== undefined && props.value !== "";

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className={cn("text-sm font-medium text-ink-700 dark:text-ink-200", hideLabel && "sr-only")}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={!!error || undefined}
          className={cn(
            "h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400",
            "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100",
            "disabled:bg-ink-50 disabled:text-ink-400",
            "dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50 dark:placeholder:text-ink-500",
            "dark:focus:ring-primary-900 dark:disabled:bg-ink-800 dark:disabled:text-ink-600",
            Boolean(leftIcon) && "pl-9",
            mostrarLimpar && "pr-9",
            error &&
              "border-danger-300 focus:border-danger-500 focus:ring-danger-100 dark:border-danger-600 dark:focus:ring-danger-900",
            className,
          )}
          {...props}
        />
        {mostrarLimpar && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Limpar campo"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-200"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-500 dark:text-ink-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger-600 dark:text-danger-300">
          {error}
        </p>
      )}
    </div>
  );
});
