'use client';

import { Group, Pagination, Select, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { storePageSize } from '@/hooks/use-page-size';

interface Props {
  total: number;
  page: number;
  pageSize: number;
  pageSizes: string[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Texto quando não há registros (ex.: "Nenhuma transação"). */
  emptyLabel: string;
}

/** Rodapé de tabela: "Mostrando X–Y de N", itens por página e paginação (empilhado no celular). */
export function TablePagination({ total, page, pageSize, pageSizes, onPageChange, onPageSizeChange, emptyLabel }: Props) {
  const isMobile = useMediaQuery('(max-width: 47.99em)');
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const info = (
    <Text size="sm" c="dimmed">
      {total === 0 ? emptyLabel : `Mostrando ${first}–${last} de ${total}`}
    </Text>
  );

  const sizeSelect = (
    <Group gap="xs" wrap="nowrap">
      <Text size="sm" c="dimmed">
        Por página
      </Text>
      <Select
        size="xs"
        w={72}
        allowDeselect={false}
        data={pageSizes}
        value={String(pageSize)}
        onChange={(v) => {
          if (!v) return;
          // Lembra a escolha para todas as tabelas do sistema.
          storePageSize(Number(v));
          onPageSizeChange(Number(v));
        }}
        aria-label="Itens por página"
      />
    </Group>
  );

  // No celular só cabem poucos botões: mostra primeira, atual e última página.
  const pagination = (
    <Pagination
      value={page}
      onChange={onPageChange}
      total={pages}
      size="sm"
      radius="sm"
      siblings={isMobile ? 0 : 1}
      boundaries={1}
      gap={isMobile ? 4 : 'xs'}
    />
  );

  if (isMobile) {
    return (
      <Stack gap="sm" align="center">
        <Group justify="space-between" w="100%" wrap="nowrap" gap="xs">
          {info}
          {sizeSelect}
        </Group>
        {pagination}
      </Stack>
    );
  }

  return (
    <Group justify="space-between" align="center" wrap="wrap">
      {info}
      <Group gap="md" wrap="wrap">
        {sizeSelect}
        {pagination}
      </Group>
    </Group>
  );
}
