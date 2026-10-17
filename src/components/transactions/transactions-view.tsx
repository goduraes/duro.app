'use client';

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  CloseButton,
  Group,
  Modal,
  MultiSelect,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  CheckIcon,
  Text,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconPlus, IconRepeat, IconTrash } from '@tabler/icons-react';
import { usePrivacy } from '@/components/privacy';
import { createClient } from '@/lib/supabase/client';
import { useTags } from '@/hooks/use-tags';
import { formatCents } from '@/lib/money';
import type { Tag, Transaction, TxType } from '@/lib/types';
import { isCompletePeriod, type Period } from '@/components/period-filter';
import { SortableTh, nextSort, type Sort, type SortDir } from '@/components/sortable-th';
import { TablePagination } from '@/components/table-pagination';
import { TransactionForm } from './transaction-form';

const PAGE_SIZES = ['10', '25', '50'];

// Mesmas cores do tipo no cadastro (verde = receita, vermelho = despesa), legíveis nos dois temas.
const TYPE_COLOR: Record<TxType, string> = {
  income: 'light-dark(var(--mantine-color-green-8), var(--mantine-color-green-4))',
  expense: 'light-dark(var(--mantine-color-red-8), var(--mantine-color-red-4))',
};

type SortKey = 'occurred_on' | 'description' | 'amount_cents' | 'tag';

interface RawRow {
  key: string;
  recurring_id: string | null;
  description: string;
  amount_cents: number;
  type: TxType;
  occurred_on: string;
  tags: Tag[];
  total: number;
}

export function TransactionsView({ period }: { period: Period }) {
  const { mask } = usePrivacy();
  const queryClient = useQueryClient();
  const tagsQuery = useTags();
  const tags = tagsQuery.data ?? [];

  const [type, setType] = useState<TxType | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // null = ordem padrão (data, mais recente primeiro), sem seta nos cabeçalhos
  const [userSort, setUserSort] = useState<Sort<SortKey> | null>(null);
  const sort: Sort<SortKey> = userSort ?? { key: 'occurred_on', dir: 'desc' };
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const range = isCompletePeriod(period) ? period : null;
  const [from, to] = range ?? ['', ''];

  // Mudou o mês: volta para a primeira página.
  useEffect(() => {
    setPage(1);
  }, [from, to]);

  const list = useQuery({
    queryKey: ['transactions', from, to, type, tagIds, page, pageSize, sort.key, sort.dir],
    enabled: !!range,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // As recorrências já vêm combinadas com as transações (calculadas no banco para o período).
      const { data, error } = await createClient().rpc('list_transactions', {
        p_from: from,
        p_to: to,
        p_type: type,
        p_tags: tagIds,
        p_sort: sort.key,
        p_dir: sort.dir,
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      });
      if (error) throw new Error(error.message);
      const raw = (data ?? []) as RawRow[];
      const rows: Transaction[] = raw.map((r) => ({
        id: r.key, // transação real: o próprio id; ocorrência de recorrência: "<recorrência>:<data>"
        description: r.description,
        amount_cents: r.amount_cents,
        type: r.type,
        occurred_on: r.occurred_on,
        recurring_id: r.recurring_id,
        // a chave de uma ocorrência é "<recorrência>:<data original>"
        recurring_ref: r.recurring_id ? r.key.split(':')[1] : null,
        tags: r.tags,
      }));
      return { rows, count: raw.length ? Number(raw[0].total) : 0 };
    },
  });

  const totals = useQuery({
    queryKey: ['transactions', 'totals', from, to, type, tagIds],
    enabled: !!range,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('transactions_totals', {
        p_from: from,
        p_to: to,
        p_type: type,
        p_tags: tagIds,
      });
      if (error) throw new Error(error.message);
      const row = (data as { income_cents: number; expense_cents: number }[] | null)?.[0];
      return { income: row?.income_cents ?? 0, expense: row?.expense_cents ?? 0 };
    },
  });

  const balance = (totals.data?.income ?? 0) - (totals.data?.expense ?? 0);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('transactions').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({ color: 'teal', message: 'Transação excluída.' });
    },
    onError: (error: Error) => notifications.show({ color: 'red', title: 'Erro ao excluir', message: error.message }),
  });

  // Exclui só o mês da recorrência; ela continua nos outros meses.
  const skip = useMutation({
    mutationFn: async (t: Transaction) => {
      const { error } = await createClient().rpc('skip_recurring_occurrence', {
        p_recurring_id: t.recurring_id,
        p_ref_month: t.recurring_ref,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      notifications.show({ color: 'teal', message: 'Lançamento excluído neste mês.' });
    },
    onError: (error: Error) => notifications.show({ color: 'red', title: 'Erro ao excluir', message: error.message }),
  });

  function confirmDelete(t: Transaction) {
    modals.openConfirmModal({
      title: t.recurring_id ? 'Excluir lançamento recorrente' : 'Excluir transação',
      children: t.recurring_id ? (
        <Text size="sm">
          Excluir <b>{t.description}</b> ({mask(formatCents(t.amount_cents))}) apenas em{' '}
          <b>{dayjs(t.occurred_on).format('MMMM [de] YYYY')}</b>? A recorrência continua nos outros meses. Para
          excluí-la de todos os meses, use a aba Recorrência.
        </Text>
      ) : (
        <Text size="sm">
          Excluir <b>{t.description}</b> ({mask(formatCents(t.amount_cents))})? Esta ação não pode ser desfeita.
        </Text>
      ),
      labels: { confirm: t.recurring_id ? 'Excluir só este mês' : 'Excluir', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => (t.recurring_id ? skip.mutate(t) : remove.mutate(t.id)),
    });
  }

  function changeSort(key: SortKey, first: SortDir = 'asc') {
    setUserSort((cur) => nextSort(cur, key, first));
    setPage(1);
  }

  function openForm(t: Transaction | null) {
    setEditing(t);
    setFormOpen(true);
  }

  const total = list.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const rows = list.data?.rows ?? [];
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  // Se a última linha da última página for excluída, volta para a página anterior.
  useEffect(() => {
    if (!list.isLoading && !list.isPlaceholderData && page > pages) setPage(pages);
  }, [list.isLoading, list.isPlaceholderData, page, pages]);

  return (
    <Stack gap="lg">
      <Group align="flex-end" justify="space-between" gap="sm">
      <Group align="flex-end" gap="sm">
        <Select
          label="Tipo"
          placeholder="Todos"
          clearable
          data={[
            { value: 'income', label: 'Receitas' },
            { value: 'expense', label: 'Despesas' },
          ]}
          value={type}
          renderOption={({ option, checked }) => {
            const color = TYPE_COLOR[option.value as TxType];
            return (
              <Group flex={1} gap="xs" wrap="nowrap">
                {checked && <CheckIcon size={12} style={{ opacity: 0.4, color: 'var(--mantine-color-text)' }} />}
                <span style={{ color, fontWeight: 600, fontSize: 'var(--mantine-font-size-sm)' }}>{option.label}</span>
              </Group>
            );
          }}
          styles={{ input: { color: type ? TYPE_COLOR[type] : undefined, fontWeight: type ? 600 : undefined } }}
          onChange={(v) => {
            setType(v as TxType | null);
            setPage(1);
          }}
          w={{ base: '100%', sm: 200 }}
        />
        <MultiSelect
          label="Tags"
          placeholder={tagIds.length ? undefined : 'Todas'}
          clearable
          searchable
          data={tags.map((t) => ({ value: t.id, label: t.name }))}
          value={tagIds}
          onChange={(v) => {
            setTagIds(v);
            setPage(1);
          }}
          renderOption={({ option, checked }) => (
            <Group flex={1} gap="xs" wrap="nowrap">
              {checked && <CheckIcon size={12} style={{ opacity: 0.4, color: 'var(--mantine-color-text)' }} />}
              <Badge color={tags.find((t) => t.id === option.value)?.color} variant="light" size="sm">
                {option.label}
              </Badge>
            </Group>
          )}
          renderPill={({ option, onRemove }) => (
            <Badge
              color={tags.find((t) => t.id === option.value)?.color}
              variant="light"
              size="sm"
              rightSection={onRemove ? <CloseButton size={12} variant="transparent" onMouseDown={onRemove} aria-label="Remover" /> : undefined}
              style={{ cursor: 'default', flex: '0 0 auto' }}
            >
              {option.label}
            </Badge>
          )}
          // Uma linha só: o campo não cresce e as tags que não cabem ficam cortadas no final.
          styles={{
            pillsList: { gap: 6, flexWrap: 'nowrap', overflow: 'hidden' },
            inputField: { flex: '1 0 24px', minWidth: 24 },
          }}
          w={{ base: '100%', sm: 200 }}
        />
      </Group>

        <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
          Nova transação
        </Button>
      </Group>

      {list.error && (
        <Alert color="red" title="Não foi possível carregar as transações">
          {list.error.message}
        </Alert>
      )}

      <Paper withBorder opacity={list.isPlaceholderData ? 0.6 : 1}>
        <Table.ScrollContainer minWidth={640}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <SortableTh w={120} active={userSort?.key === 'occurred_on'} dir={sort.dir} onSort={() => changeSort('occurred_on')}>
                  Data
                </SortableTh>
                <SortableTh active={userSort?.key === 'description'} dir={sort.dir} onSort={() => changeSort('description')}>
                  Descrição
                </SortableTh>
                <SortableTh active={userSort?.key === 'tag'} dir={sort.dir} onSort={() => changeSort('tag')}>
                  Tags
                </SortableTh>
                <SortableTh align="right" active={userSort?.key === 'amount_cents'} dir={sort.dir} onSort={() => changeSort('amount_cents', 'desc')}>
                  Valor
                </SortableTh>
                <Table.Th w={90} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <Table.Tr key={i}>
                    <Table.Td colSpan={5}>
                      <Skeleton h={20} />
                    </Table.Td>
                  </Table.Tr>
                ))}

              {!list.isLoading && rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="lg">
                      Nenhuma transação encontrada.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}

              {rows.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>{dayjs(t.occurred_on).format('DD/MM/YYYY')}</Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <span>{t.description}</span>
                      {t.recurring_id && (
                        <Tooltip label="Lançamento de uma recorrência" withArrow>
                          <IconRepeat size={14} style={{ opacity: 0.6, flexShrink: 0 }} aria-label="Recorrente" />
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {t.tags.map((tag) => (
                        <Badge key={tag.id} color={tag.color} variant="light" size="sm">
                          {tag.name}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right" fw={600} c={t.type === 'income' ? 'teal' : 'red'}>
                    {t.type === 'income' ? '+' : '−'} {mask(formatCents(t.amount_cents))}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <ActionIcon variant="subtle" aria-label="Editar" onClick={() => openForm(t)}>
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" aria-label="Excluir" onClick={() => confirmDelete(t)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group
            justify="space-between"
            gap="md"
            px="md"
            py="sm"
            style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
          >
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              {range ? dayjs(from).format('MMMM YYYY') : ''}
            </Text>
            <Group gap="xl" wrap="wrap">
              <Text size="sm" c="dimmed">
                Entradas{' '}
                <Text span fw={700} c={TYPE_COLOR.income}>
                  {mask(formatCents(totals.data?.income ?? 0))}
                </Text>
              </Text>
              <Text size="sm" c="dimmed">
                Saídas{' '}
                <Text span fw={700} c={TYPE_COLOR.expense}>
                  {mask(formatCents(totals.data?.expense ?? 0))}
                </Text>
              </Text>
              <Text
                size="sm"
                c="dimmed"
                pl="xl"
                style={{ borderInlineStart: '1px solid var(--mantine-color-default-border)' }}
              >
                Resultado{' '}
                <Text span fw={700} c={balance > 0 ? TYPE_COLOR.income : balance < 0 ? TYPE_COLOR.expense : undefined}>
                  {mask(formatCents(balance))}
                </Text>
              </Text>
            </Group>
          </Group>
        </Table.ScrollContainer>
      </Paper>

      <TablePagination
        total={total}
        page={page}
        pageSize={pageSize}
        pageSizes={PAGE_SIZES}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        emptyLabel="Nenhuma transação"
      />

      <Modal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing?.recurring_id ? 'Editar lançamento recorrente' : editing ? 'Editar transação' : 'Nova transação'}
      >
        <TransactionForm transaction={editing} tags={tags} onDone={() => setFormOpen(false)} />
      </Modal>
    </Stack>
  );
}
