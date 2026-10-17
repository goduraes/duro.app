'use client';

import type { ReactNode } from 'react';
import { Table, UnstyledButton } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconSelector } from '@tabler/icons-react';

export type SortDir = 'asc' | 'desc';

interface Props {
  children: ReactNode;
  /** Coluna ordenada no momento? */
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  align?: 'left' | 'right';
  w?: number | string;
}

/** Cabeçalho de tabela clicável: crescente → decrescente → sem ordenação. */
export function SortableTh({ children, active, dir, onSort, align = 'left', w }: Props) {
  const Icon = !active ? IconSelector : dir === 'asc' ? IconArrowUp : IconArrowDown;
  return (
    <Table.Th w={w} ta={align} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <UnstyledButton
        onClick={onSort}
        className="duro-sort-btn"
        data-active={active || undefined}
        style={{ flexDirection: align === 'right' ? 'row-reverse' : 'row' }}
      >
        <span>{children}</span>
        <Icon size={14} />
      </UnstyledButton>
    </Table.Th>
  );
}

export interface Sort<K extends string> {
  key: K;
  dir: SortDir;
}

/**
 * Próximo estado ao clicar no cabeçalho: 1º clique ordena (`first`), 2º inverte, 3º remove a ordenação (null).
 * Clicar em outra coluna começa o ciclo dela.
 */
export function nextSort<K extends string>(current: Sort<K> | null, key: K, first: SortDir = 'asc'): Sort<K> | null {
  if (current?.key !== key) return { key, dir: first };
  if (current.dir === first) return { key, dir: first === 'asc' ? 'desc' : 'asc' };
  return null;
}
