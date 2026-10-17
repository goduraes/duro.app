'use client';

import { useEffect } from 'react';
import { useComputedColorScheme } from '@mantine/core';

const LIGHT = '#6d4aff';
const DARK = '#8b73ff';

/**
 * Cor da barra superior do navegador/PWA no celular: #6d4aff no tema claro e #8b73ff no escuro.
 * Acompanha o tema escolhido no app (inclusive a troca manual), não só o do sistema.
 */
export function ThemeColorSync() {
  const scheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  useEffect(() => {
    const color = scheme === 'dark' ? DARK : LIGHT;
    let metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    if (metas.length === 0) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
      metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    }
    // Mesma cor em todas as tags (inclusive as com media query do layout), para valer a do tema do app.
    metas.forEach((m) => m.setAttribute('content', color));
  }, [scheme]);

  return null;
}
