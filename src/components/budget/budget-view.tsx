'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconListDetails, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { MonthNavigator, currentMonthPeriod, isCompletePeriod, type Period } from '@/components/period-filter';
import { PageHeader } from '@/components/page-header';
import { usePrivacy } from '@/components/privacy';
import { budgetBarColor, useBudgetOverview } from '@/hooks/use-budget-overview';
import { useTags } from '@/hooks/use-tags';
import { createClient } from '@/lib/supabase/client';
import { formatCents } from '@/lib/money';
import type { BudgetRow, SummaryRow } from '@/lib/types';
import { BudgetForm } from './budget-form';

function SummaryCard({ label, value, hint, loading }: { label: string; value: string; hint?: string; loading: boolean }) {
  return (
    <Paper withBorder p="lg">
      <Text size="sm" c="dimmed" fw={500} mb="xs">
        {label}
      </Text>
      {loading ? (
        <Skeleton h={34} w={150} />
      ) : (
        <Text ff="heading" fz={26} fw={700} lh={1.1} style={{ letterSpacing: '-0.02em' }}>
          {value}
        </Text>
      )}
      {hint && (
        <Text size="xs" c="dimmed" mt={6}>
          {hint}
        </Text>
      )}
    </Paper>
  );
}

interface TagTx {
  key: string;
  description: string;
  amount_cents: number;
  occurred_on: string;
  installment: number | null;
  installments: number | null;
}

/** Despesas de uma tag no mês: o que compõe o "gasto" do orçamento. */
function TagTransactionsModal({
  budget,
  from,
  to,
  onClose,
}: {
  budget: BudgetRow | null;
  from: string;
  to: string;
  onClose: () => void;
}) {
  const { mask } = usePrivacy();

  const list = useQuery({
    queryKey: ['transactions', 'budget-tag', budget?.tag_id, from, to],
    enabled: !!budget,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('list_transactions', {
        p_from: from,
        p_to: to,
        p_type: 'expense',
        p_tags: [budget!.tag_id],
        p_sort: 'occurred_on',
        p_dir: 'desc',
        p_limit: 2000,
        p_offset: 0,
        p_search: null,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as TagTx[];
    },
  });

  const items = list.data ?? [];
  const total = items.reduce((acc, t) => acc + t.amount_cents, 0);

  return (
    <Modal
      opened={!!budget}
      onClose={onClose}
      size="md"
      radius="lg"
      title={
        budget ? (
          <Group gap="sm">
            <Badge color={budget.tag_color} variant="light">
              {budget.tag_name}
            </Badge>
            <Text ff="heading" fw={700} fz="lg">
              {dayjs(from).format('MMMM [de] YYYY')}
            </Text>
          </Group>
        ) : null
      }
    >
      {list.error && (
        <Alert color="red" title="Não foi possível carregar os lançamentos">
          {list.error.message}
        </Alert>
      )}

      {list.isLoading && (
        <Stack gap="md">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} h={40} />
          ))}
        </Stack>
      )}

      {!list.isLoading && !list.error && items.length === 0 && (
        <Text ta="center" c="dimmed" py="lg">
          Nenhum lançamento nesta tag no mês.
        </Text>
      )}

      {items.length > 0 && (
        <>
          <Text size="sm" c="dimmed" mb="md">
            {items.length} {items.length === 1 ? 'lançamento' : 'lançamentos'} neste mês
          </Text>
          <ScrollArea.Autosize mah={360} type="auto" scrollbarSize={6} offsetScrollbars="y">
            <Stack gap="md" pr={16}>
              {items.map((t) => (
                <Group key={t.key} justify="space-between" wrap="nowrap" align="flex-start">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} truncate>
                      {t.description}
                      {t.installment && t.installments && (
                        <Text span size="xs" fw={400} c="dimmed" ml={6}>
                          ({t.installment}/{t.installments})
                        </Text>
                      )}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {dayjs(t.occurred_on).format('DD/MM/YYYY')}
                    </Text>
                  </div>
                  <Text fw={700} c="red" style={{ whiteSpace: 'nowrap' }}>
                    {mask(`−${formatCents(t.amount_cents)}`)}
                  </Text>
                </Group>
              ))}
            </Stack>
          </ScrollArea.Autosize>
          <Group
            justify="space-between"
            mt="md"
            pt="md"
            style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
          >
            <Text size="sm" c="dimmed">
              Total gasto
            </Text>
            <Text fw={700} c="red">
              {mask(`−${formatCents(total)}`)}
            </Text>
          </Group>
        </>
      )}
    </Modal>
  );
}

export function BudgetView() {
  const { mask } = usePrivacy();
  const queryClient = useQueryClient();
  const tags = useTags().data ?? [];

  const [period, setPeriod] = useState<Period>(currentMonthPeriod);
  const [editing, setEditing] = useState<BudgetRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<BudgetRow | null>(null);

  const range = isCompletePeriod(period) ? period : null;
  const [from, to] = range ?? ['', ''];

  const budgets = useBudgetOverview(from, to, !!range);

  const summary = useQuery({
    queryKey: ['transactions', 'budget-income', from, to],
    enabled: !!range,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('dashboard_summary', { p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      return ((data as SummaryRow[] | null)?.[0] ?? { income_cents: 0, expense_cents: 0 }) as SummaryRow;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('budgets').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', 'budgets'] });
      notifications.show({ color: 'teal', message: 'Orçamento excluído.' });
    },
    onError: (error: Error) => notifications.show({ color: 'red', title: 'Erro ao excluir', message: error.message }),
  });

  function confirmDelete(b: BudgetRow) {
    modals.openConfirmModal({
      title: 'Excluir orçamento',
      children: (
        <Text size="sm">
          Excluir o orçamento da tag <b>{b.tag_name}</b>? As transações não são afetadas.
        </Text>
      ),
      labels: { confirm: 'Excluir', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(b.id),
    });
  }

  function openForm(b: BudgetRow | null) {
    setEditing(b);
    setFormOpen(true);
  }

  const rows = budgets.data ?? [];
  const income = summary.data?.income_cents ?? 0;
  const totalLimit = rows.reduce((acc, b) => acc + b.limit_cents, 0);
  const totalSpent = rows.reduce((acc, b) => acc + b.spent_cents, 0);
  const monthLabel = range ? dayjs(from).format('MMMM [de] YYYY') : '';
  const loading = budgets.isLoading || summary.isLoading;

  // Ao criar, só as tags sem orçamento; ao editar, mantém a do próprio orçamento.
  const usedTagIds = new Set(rows.map((b) => b.tag_id));
  const availableTags = tags.filter((t) => !usedTagIds.has(t.id) || t.id === editing?.tag_id);
  const error = budgets.error ?? summary.error;

  return (
    <Stack gap="lg">
      <PageHeader
        title="Orçamento"
        description="Defina um limite mensal por tag e acompanhe quanto já gastou."
        actions={<MonthNavigator value={period} onChange={setPeriod} />}
      />

      {error && (
        <Alert color="red" title="Não foi possível carregar o orçamento">
          {error.message}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <SummaryCard label="Receitas do mês" value={mask(formatCents(income))} loading={loading} />
        <SummaryCard
          label="Total orçado"
          value={mask(formatCents(totalLimit))}
          hint={income > 0 && totalLimit > 0 ? `${Math.round((totalLimit / income) * 100)}% das receitas` : undefined}
          loading={loading}
        />
        <SummaryCard
          label="Gasto nas tags orçadas"
          value={mask(formatCents(totalSpent))}
          hint={
            totalLimit > 0
              ? totalSpent > totalLimit
                ? `${mask(formatCents(totalSpent - totalLimit))} acima do orçado`
                : `${mask(formatCents(totalLimit - totalSpent))} ainda disponível`
              : undefined
          }
          loading={loading}
        />
      </SimpleGrid>

      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          {!loading && `${rows.length} ${rows.length === 1 ? 'orçamento' : 'orçamentos'}`}
        </Text>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => openForm(null)}
          disabled={tags.length > 0 && availableTags.length === 0 && !editing}
        >
          Novo orçamento
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {budgets.isLoading &&
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={170} radius="lg" />)}

        {!budgets.isLoading && rows.length === 0 && (
          <Paper withBorder p="xl" style={{ gridColumn: '1 / -1' }}>
            <Text ta="center" c="dimmed">
              Nenhum orçamento criado. Crie um para acompanhar quanto você gasta em cada tag.
            </Text>
          </Paper>
        )}

        {rows.map((b) => {
          const over = b.spent_cents > b.limit_cents;
          const ratio = b.limit_cents > 0 ? b.spent_cents / b.limit_cents : b.spent_cents > 0 ? 1 : 0;
          const color = budgetBarColor(b.spent_cents, b.limit_cents);
          const noIncome = b.kind === 'percent' && income === 0;
          // Sem limite (ex.: % das receitas num mês sem receitas) não existe porcentagem para mostrar.
          const pct = b.limit_cents > 0 ? `${Math.round(ratio * 100)}%` : b.spent_cents > 0 ? '—' : '0%';

          return (
            <Paper key={b.id} withBorder p="md">
              <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                <Badge color={b.tag_color} variant="light" style={{ flexShrink: 1, minWidth: 0 }}>
                  {b.tag_name}
                </Badge>
                <Group gap={4} wrap="nowrap">
                  <ActionIcon variant="subtle" aria-label="Editar" onClick={() => openForm(b)}>
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" aria-label="Excluir" onClick={() => confirmDelete(b)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
              <Text size="xs" c="dimmed" mt={4}>
                {b.kind === 'percent' ? `${(b.percent ?? 0).toLocaleString('pt-BR')}% das receitas` : 'Valor fixo'}
              </Text>

              <Group justify="space-between" align="flex-end" mt="md" mb={8} gap="xs" wrap="nowrap">
                <Text ff="heading" fz={30} fw={700} lh={1} c={color === 'gray' ? 'dimmed' : color} style={{ letterSpacing: '-0.02em' }}>
                  {pct}
                </Text>
                <Text size="sm" fw={600} ta="right" c={over ? 'red' : 'dimmed'}>
                  {noIncome
                    ? 'Sem receitas no mês'
                    : over
                      ? `Estourou ${mask(formatCents(b.spent_cents - b.limit_cents))}`
                      : `Restam ${mask(formatCents(b.limit_cents - b.spent_cents))}`}
                </Text>
              </Group>

              <Progress
                value={Math.min(ratio, 1) * 100}
                color={color}
                size="md"
                radius="xl"
                aria-label={`${b.tag_name}: ${pct} do limite`}
              />

              <Group justify="space-between" align="center" mt="xs" gap="xs" wrap="nowrap">
                <Text size="sm">
                  <Text span fw={700}>
                    {mask(formatCents(b.spent_cents))}
                  </Text>
                  <Text span c="dimmed">
                    {' '}
                    de {mask(formatCents(b.limit_cents))}
                  </Text>
                </Text>
                {/* Clicar abre os lançamentos da tag no mês. Sem transações, não há o que abrir. */}
                <UnstyledButton
                  className="duro-link-btn"
                  disabled={b.tx_count === 0}
                  onClick={() => setViewing(b)}
                  aria-label={`Ver as ${b.tx_count} transações de ${b.tag_name}`}
                  style={{ flexShrink: 0, cursor: b.tx_count === 0 ? 'default' : 'pointer' }}
                >
                  <Group gap={6} wrap="nowrap" c="dimmed">
                    <IconListDetails size={16} />
                    <Text size="sm" fw={600} c="dimmed">
                      {b.tx_count} {b.tx_count === 1 ? 'transação' : 'transações'}
                    </Text>
                  </Group>
                </UnstyledButton>
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>

      <TagTransactionsModal budget={viewing} from={from} to={to} onClose={() => setViewing(null)} />

      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Editar orçamento' : 'Novo orçamento'}>
        <BudgetForm
          budget={editing}
          tags={availableTags}
          incomeCents={income}
          monthLabel={monthLabel}
          onDone={() => setFormOpen(false)}
        />
      </Modal>
    </Stack>
  );
}
