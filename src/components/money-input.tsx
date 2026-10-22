'use client';

import { useLayoutEffect, useRef, type FocusEvent, type MouseEvent } from 'react';
import { TextInput, type TextInputProps } from '@mantine/core';

const MAX_CENTS = 2_100_000_000; // R$ 21.000.000,00, o mesmo limite do cadastro

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props extends Omit<TextInputProps, 'value' | 'onChange' | 'type' | 'inputMode'> {
  /** Valor em reais (ex.: 12.34); '' (ou ausente) = campo vazio. */
  value?: number | '';
  onChange: (value: number | '') => void;
}

/**
 * Campo de valor em reais que se digita a partir dos centavos: cada número entra pela direita
 * (1 → 0,01 · 12 → 0,12 · 1234 → 12,34) e o apagar remove o último; zerado, fica em R$ 0,00. Guarda o valor em reais,
 * igual ao NumberInput que ele substitui, então os formulários não mudam.
 */
export function MoneyInput({ value, onChange, onFocus, onClick, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const text = value === '' || value === undefined ? '' : brl.format(Math.round(value * 100) / 100);

  const toEnd = () => {
    const el = ref.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  };

  // Depois de reformatar, o cursor volta para o fim (o navegador o deixaria no meio do texto).
  useLayoutEffect(() => {
    if (ref.current && document.activeElement === ref.current) toEnd();
  }, [text]);

  return (
    <TextInput
      {...rest}
      ref={ref}
      value={text}
      inputMode="numeric"
      autoComplete="off"
      placeholder={rest.placeholder ?? 'R$ 0,00'}
      onChange={(e) => {
        const typed = e.currentTarget.value;
        const digits = typed.replace(/\D/g, '');
        if (!digits) return onChange(0);
        const cents = Math.min(parseInt(digits, 10), MAX_CENTS);
        onChange(cents / 100);
      }}
      onFocus={(e: FocusEvent<HTMLInputElement>) => {
        onFocus?.(e);
        // espera o clique posicionar o cursor e então o leva para o fim
        requestAnimationFrame(toEnd);
      }}
      onClick={(e: MouseEvent<HTMLInputElement>) => {
        onClick?.(e);
        toEnd();
      }}
    />
  );
}
