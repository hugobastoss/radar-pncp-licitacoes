"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  ativo = true,
) {
  useEffect(() => {
    if (!ativo) return;
    function aoClicar(evento: MouseEvent) {
      if (ref.current && !ref.current.contains(evento.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [ref, onOutside, ativo]);
}
