'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'duro-page-size';
export const PAGE_SIZE_OPTIONS = [10, 25, 50];
export const DEFAULT_PAGE_SIZE = 10;

/** Itens por página escolhido pelo usuário (vale para todas as tabelas), ou null se não houver. */
export function readStoredPageSize(): number | null {
  try {
    const n = Number(localStorage.getItem(KEY));
    return PAGE_SIZE_OPTIONS.includes(n) ? n : null;
  } catch {
    return null; // sem localStorage (ex.: modo privado): segue com o padrão
  }
}

export function storePageSize(size: number) {
  try {
    localStorage.setItem(KEY, String(size));
  } catch {
    /* ignora */
  }
}

/**
 * Estado de "itens por página" lembrado entre telas e visitas. Começa no padrão e, ao montar no
 * navegador, aplica o valor salvo (evita divergência entre o HTML do servidor e o do cliente).
 */
export function usePageSize(): [number, (size: number) => void] {
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    const stored = readStoredPageSize();
    if (stored) setSize(stored);
  }, []);

  const update = useCallback((next: number) => {
    setSize(next);
    storePageSize(next);
  }, []);

  return [size, update];
}
