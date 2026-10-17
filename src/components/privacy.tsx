'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY = 'duro-hide-values';
const MASK = '****';

interface PrivacyCtx {
  hidden: boolean;
  toggle: () => void;
  /** Devolve '****' quando os valores estão ocultos; senão o próprio texto. */
  mask: (text: string) => string;
}

const Ctx = createContext<PrivacyCtx>({ hidden: false, toggle: () => {}, mask: (t) => t });

/** Guarda se os valores numéricos estão ocultos. Os componentes usam `mask()` para trocar valores por ****. */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(KEY) === '1');
    } catch {
      /* sem localStorage: segue visível */
    }
  }, []);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-hide-values', hidden);
  }, [hidden]);

  const toggle = useCallback(() => {
    setHidden((h) => {
      try {
        localStorage.setItem(KEY, h ? '0' : '1');
      } catch {
        /* ignora */
      }
      return !h;
    });
  }, []);

  return <Ctx.Provider value={{ hidden, toggle, mask: (t) => (hidden ? MASK : t) }}>{children}</Ctx.Provider>;
}

export const usePrivacy = () => useContext(Ctx);
