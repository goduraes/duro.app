'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionIcon, Alert, Badge, Button, Group, Modal, Paper, Skeleton, Stack, Table, Text, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconArrowBackUp, IconCheck, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { isCompletePeriod, type Period } from '@/components/period-filter';
import { usePrivacy } from '@/components/privacy';
import { createClient } from '@/lib/supabase/client';
import { useTags } from '@/hooks/use-tags';
import { formatCents } from '@/lib/money';
import type { Recurring, Tag, TxType } from '@/lib/types';
import { RecurringForm } from './recurring-form';

interface RawRow {
  id: string;
  description: string;
  amount_cents: number;
  type: TxType;
  start_date: string;
  end_date: string | null;
  day_of_month: number;
  total_cents: number | null;
  recurring_transaction_tags: { tags: Tag | null }[];
}

export function RecurringView({ period }: { period: Period }) {
  const { mask } = usePrivacy();
  const queryClient = useQueryClient();
  const tags = useTags().data ?? [];

  const [editing, setEditing] = useState<Recurring | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const list = useQuery({
    queryKey: ['recurring'],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('recurring_transactions')
        .select(
          'id, description, amount_cents, type, start_date, end_date, day_of_month, total_cents, recurring_transaction_tags(tags(id, name, color))',
        )
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as RawRow[]).map(
        (r): Recurring => ({
          id: r.id,
          description: r.description,
          amount_cents: r.amount_cents,
          type: r.type,
          start_date: r.start_date,
          end_date: r.end_date,
          day_of_month: r.day_of_month,
          total_cents: r.total_cents,
          tags: r.recurring_transaction_tags.map((rt) => rt.tags).filter((t): t is Tag => t !== null),
        }),
      );
    },
  });

  // Exceções do mês escolhido (mês excluído ou com data alterada).
  const monthStart = period[0] ? dayjs(period[0]).startOf('month').format('YYYY-MM-DD') : '';
  const overrides = useQuery({
    queryKey: ['recurring', 'overrides', monthStart],
    enabled: !!monthStart,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('recurring_overrides')
        .select('recurring_id, is_skipped, occurred_on')
        .eq('ref_month', monthStart);
      if (error) throw new Error(error.message);
      return new Map(
        ((data ?? []) as { recurring_id: string; is_skipped: boolean; occurred_on: string | null }[]).map((o) => [
          o.recurring_id,
          o,
        ]),
      );
    },
  });

  // Desfaz as exceções do mês: volta a valer o cadastro da recorrência.
  const restore = useMutation({
    mutationFn: async (recurringId: string) => {
      const { error } = await createClient()
        .from('recurring_overrides')
        .delete()
        .eq('recurring_id', recurringId)
        .eq('ref_month', monthStart);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({ color: 'teal', message: 'Lançamento restaurado neste mês.' });
    },
    onError: (error: Error) => notifications.show({ color: 'red', title: 'Erro ao restaurar', message: error.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('recurring_transactions').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({ color: 'teal', message: 'Recorrência excluída.' });
    },
    onError: (error: Error) => notifications.show({ color: 'red', title: 'Erro ao excluir', message: error.message }),
  });

  function confirmDelete(r: Recurring) {
    modals.openConfirmModal({
      title: 'Excluir recorrência',
      children: (
        <Text size="sm">
          Excluir <b>{r.description}</b> ({mask(formatCents(r.amount_cents))}{r.end_date ? ' por parcela' : ' por mês'})? Ela some de todos os meses, no histórico e no dashboard.
        </Text>
      ),
      labels: { confirm: 'Excluir', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(r.id),
    });
  }

  function openForm(r: Recurring | null) {
    setEditing(r);
    setFormOpen(true);
  }

  const [from, to] = isCompletePeriod(period) ? period : [null, null];

  // Só as recorrências ativas no mês escolhido, com a data em que caem nele.
  const rows = (list.data ?? []).flatMap((r) => {
    if (!from || !to) return [];
    if (r.start_date > to || (r.end_date !== null && r.end_date < from)) return [];
    const day = Math.min(r.day_of_month, dayjs(from).daysInMonth());
    const ov = overrides.data?.get(r.id);
    // Parcela deste mês, quando a recorrência tem mês de fim.
    const installments = r.end_date ? dayjs(r.end_date).diff(dayjs(r.start_date).startOf('month'), 'month') + 1 : null;
    const installment = installments ? dayjs(from).diff(dayjs(r.start_date).startOf('month'), 'month') + 1 : null;
    return [
      {
        ...r,
        skipped: !!ov?.is_skipped,
        installment,
        installments,
        // A última parcela de uma recorrência parcelada fecha o total informado.
        monthAmount:
          r.total_cents && installment && installment === installments
            ? r.total_cents - r.amount_cents * (installments - 1)
            : r.amount_cents,
        occurrence: ov?.occurred_on ?? dayjs(from).date(day).format('YYYY-MM-DD'),
      },
    ];
  });

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        O lugar certo para as suas entradas e saídas fixas. Você configura o cadastro aqui e o sistema já lança os
        próximos meses no seu Histórico, mantendo o controle da sua carteira organizado e sem trabalho extra.
      </Text>

      <Group justify="flex-end">
        <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
          Nova recorrência
        </Button>
      </Group>

      {list.error && (
        <Alert color="red" title="Não foi possível carregar as recorrências">
          {list.error.message}
        </Alert>
      )}

      <Paper withBorder>
        <Table.ScrollContainer minWidth={720}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Tag</Table.Th>
                <Table.Th w={70}>Dia</Table.Th>
                <Table.Th ta="right" w={140}>
                  Valor
                </Table.Th>
                <Table.Th w={170}>Status</Table.Th>
                <Table.Th w={90} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <Table.Tr key={i}>
                    <Table.Td colSpan={6}>
                      <Skeleton h={20} />
                    </Table.Td>
                  </Table.Tr>
                ))}

              {!list.isLoading && rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="lg">
                      Nenhuma recorrência neste mês.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}

              {rows.map((r) => {
                return (
                  <Table.Tr key={r.id}>
                    <Table.Td fw={600}>
                      {r.description}
                      {r.installment && r.installments && (
                        <Text span size="xs" fw={400} c="dimmed" ml={6}>
                          ({r.installment}/{r.installments})
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {r.tags.map((tag) => (
                          <Badge key={tag.id} color={tag.color} variant="light" size="sm">
                            {tag.name}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>{r.day_of_month}</Table.Td>
                    <Table.Td ta="right" fw={600} c={r.type === 'income' ? 'teal' : 'red'}>
                      {r.type === 'income' ? '+' : '−'} {mask(formatCents(r.monthAmount))}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        {r.skipped ? (
                          <IconX size={14} color="var(--mantine-color-red-5)" />
                        ) : (
                          <IconCheck size={14} color="var(--mantine-color-teal-5)" />
                        )}
                        <Text size="xs" c={r.skipped ? 'red' : 'teal'}>
                          {r.skipped ? 'Excluído' : 'Lançado'} · {dayjs(r.occurrence).format('DD/MM')}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        {r.skipped && (
                          <Tooltip label="Restaurar neste mês" withArrow>
                            <ActionIcon variant="subtle" aria-label="Restaurar neste mês" onClick={() => restore.mutate(r.id)}>
                              <IconArrowBackUp size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <ActionIcon variant="subtle" aria-label="Editar" onClick={() => openForm(r)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" color="red" aria-label="Excluir" onClick={() => confirmDelete(r)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      <Modal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar recorrência' : 'Nova recorrência'}
      >
        <RecurringForm recurring={editing} tags={tags} onDone={() => setFormOpen(false)} />
      </Modal>
    </Stack>
  );
}
