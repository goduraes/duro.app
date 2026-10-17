'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Center,
  Grid,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { BarChart, DonutChart } from '@mantine/charts';
import { IconArrowDownRight, IconArrowUpRight, IconWallet } from '@tabler/icons-react';
import { BudgetProgressCard } from '@/components/dashboard/budget-progress-card';
import { ExpenseCalendar } from '@/components/dashboard/expense-calendar';
import { RecentTransactionsCard } from '@/components/dashboard/recent-transactions-card';
import { PageHeader } from '@/components/page-header';
import { usePrivacy } from '@/components/privacy';
import { createClient } from '@/lib/supabase/client';
import { formatBRL, formatBRLCompact, formatCents } from '@/lib/money';
import type { ByTagRow, SeriesRow, SummaryRow, TxType } from '@/lib/types';
import {
  MonthNavigator,
  currentMonthPeriod,
  isCompletePeriod,
  type Period,
} from '@/components/period-filter';

function StatCard({
  label,
  value,
  color,
  accent,
  icon,
  loading,
}: {
  label: string;
  value: string;
  color: string;
  /** Cor do ícone e do valor (mesma nos dois, em qualquer tema). */
  accent: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Paper withBorder p="lg">
      <Group gap="sm" mb="sm" wrap="nowrap">
        <ThemeIcon variant="light" size={36} radius="md" color={color} c={accent}>
          {icon}
        </ThemeIcon>
        <Text size="sm" c="dimmed" fw={500}>
          {label}
        </Text>
      </Group>
      {loading ? (
        <Skeleton h={34} w={150} />
      ) : (
        <Text
          ff="heading"
          fz={30}
          fw={700}
          lh={1.1}
          c={accent}
          style={{ letterSpacing: "-0.02em" }}
        >
          {value}
        </Text>
      )}
    </Paper>
  );
}

const MAX_TAGS_IN_CARD = 5;

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

function formatPercent(part: number, total: number) {
  const pct = total > 0 ? (part / total) * 100 : 0;
  return `${pct.toFixed(1).replace('.', ',')}%`;
}

function TagRow({ slice, total, mask }: { slice: DonutSlice; total: number; mask: (t: string) => string }) {
  const width = total > 0 ? (slice.value / total) * 100 : 0;
  return (
    <Group gap="sm" wrap="nowrap">
      <Group gap={8} wrap="nowrap" w={{ base: 110, xs: 130 }} style={{ flexShrink: 0 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: slice.color, flexShrink: 0 }} />
        <Text size="sm" truncate>
          {slice.name}
        </Text>
      </Group>
      <Box
        style={{
          flex: 1,
          minWidth: 20,
          height: 6,
          borderRadius: 999,
          background: 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
          overflow: 'hidden',
        }}
      >
        <Box style={{ width: `${width}%`, height: '100%', borderRadius: 999, background: slice.color }} />
      </Box>
      <Text size="sm" fw={700} ta="right" style={{ whiteSpace: 'nowrap' }}>
        {mask(formatBRL(slice.value))}
      </Text>
      <Text size="sm" c="dimmed" ta="right" w={48} style={{ flexShrink: 0 }}>
        {formatPercent(slice.value, total)}
      </Text>
    </Group>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Center h={220}>
      <Text c="dimmed" size="sm">
        {children}
      </Text>
    </Center>
  );
}

export function DashboardView() {
  const { mask } = usePrivacy();
  const [period, setPeriod] = useState<Period>(currentMonthPeriod);
  const [allTagsOpened, allTags] = useDisclosure(false);
  const [tagType, setTagType] = useState<TxType>('expense');
  const [historyMonths, setHistoryMonths] = useState('6');
  const range = isCompletePeriod(period) ? period : null;
  const [from, to] = range ?? ['', ''];
  const summary = useQuery({
    queryKey: ['dashboard', 'summary', from, to],
    enabled: !!range,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('dashboard_summary', { p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      return ((data as SummaryRow[] | null)?.[0] ?? { income_cents: 0, expense_cents: 0 }) as SummaryRow;
    },
  });

  // Histórico: últimos N meses, terminando no mês selecionado (um ponto por mês).
  const histFrom = range ? dayjs(to).subtract(Number(historyMonths) - 1, 'month').startOf('month').format('YYYY-MM-DD') : '';
  const history = useQuery({
    queryKey: ['dashboard', 'history', histFrom, to],
    enabled: !!range,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('dashboard_series', {
        p_from: histFrom,
        p_to: to,
        p_unit: 'month',
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as SeriesRow[];
    },
  });

  const byTag = useQuery({
    queryKey: ['dashboard', 'by-tag', from, to, tagType],
    enabled: !!range,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('dashboard_by_tag', {
        p_from: from,
        p_to: to,
        p_type: tagType,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as ByTagRow[];
    },
  });

  const historyChart = useMemo(
    () =>
      (history.data ?? []).map((row) => ({
        label: dayjs(row.period).format(historyMonths === '3' ? 'MMM/YYYY' : 'MMM/YY'),
        Receitas: row.income_cents / 100,
        Despesas: row.expense_cents / 100,
      })),
    [history.data, historyMonths],
  );
  const hasHistoryData = historyChart.some((m) => m.Receitas > 0 || m.Despesas > 0);

  const donutData = useMemo(
    () => (byTag.data ?? []).map((t) => ({ name: t.tag_name, value: t.total_cents / 100, color: t.color })),
    [byTag.data],
  );
  const donutTotal = donutData.reduce((acc, d) => acc + d.value, 0);

  const income = summary.data?.income_cents ?? 0;
  const expense = summary.data?.expense_cents ?? 0;
  const balance = income - expense;
  const error = summary.error ?? history.error ?? byTag.error;

  return (
    <Stack gap="lg">
      <PageHeader
        title="Dashboard"
        description="Resumo das suas receitas e despesas."
        actions={<MonthNavigator value={period} onChange={setPeriod} />}
      />

      {error && (
        <Alert color="red" title="Não foi possível carregar os dados">
          {error.message}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Paper className="duro-hero" p="xl" style={{ gridColumn: 'span 1' }}>
          <Group gap="xs" mb="md" wrap="nowrap">
            <IconWallet size={18} />
            <Text size="sm" fw={500} c="rgba(255,255,255,.8)">
              Saldo do período
            </Text>
          </Group>
          {summary.isLoading ? (
            <Skeleton h={34} w={150} opacity={0.4} />
          ) : (
            <Text ff="heading" fz={30} fw={700} lh={1.1} style={{ letterSpacing: "-0.02em" }}>
              {mask(formatCents(balance))}
            </Text>
          )}
          <Text size="xs" mt={6} c="rgba(255,255,255,.7)">
            {balance < 0 ? 'Você gastou mais do que recebeu.' : 'Receitas menos despesas no período.'}
          </Text>
        </Paper>
        <StatCard
          label="Receitas"
          value={mask(formatCents(income))}
          color="teal"
          accent="var(--duro-income)"
          loading={summary.isLoading}
          icon={<IconArrowUpRight size={20} />}
        />
        <StatCard
          label="Despesas"
          value={mask(formatCents(expense))}
          color="orange"
          accent="var(--duro-expense)"
          loading={summary.isLoading}
          icon={<IconArrowDownRight size={20} />}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        {range ? <ExpenseCalendar from={from} to={to} /> : <div />}

        <Paper withBorder p="lg" style={{ display: "flex", flexDirection: "column" }}>
          <Group justify="space-between" mb="sm">
            <Text ff="heading" fw={700} fz="lg">Por tag</Text>
            <SegmentedControl
              size="xs"
              color={tagType === 'income' ? 'green' : 'red'}
              className="duro-tx-type"
              data-type={tagType}
              value={tagType}
              onChange={(v) => setTagType(v as TxType)}
              data={[
                { label: 'Despesas', value: 'expense' },
                { label: 'Receitas', value: 'income' },
              ]}
            />
          </Group>
          {byTag.isLoading ? (
            <Stack align="center" justify="center" gap="lg" style={{ flex: 1 }}>
              <Skeleton circle h={260} w={260} />
              <Stack gap="sm" w="100%">
                {Array.from({ length: MAX_TAGS_IN_CARD }, (_, i) => (
                  <Skeleton key={i} h={20} />
                ))}
              </Stack>
            </Stack>
          ) : donutData.length === 0 ? (
            <Stack align="center" justify="center" gap={6} style={{ flex: 1 }} py="xl">
              <Text c="dimmed" size="sm" ta="center">
                Sem {tagType === 'expense' ? 'despesas' : 'receitas'} no período.
              </Text>
              <Anchor component={Link} href="/transacoes?nova=1" size="sm" fw={600}>
                Criar transação
              </Anchor>
            </Stack>
          ) : (
            <>
            <Stack align="center" justify="center" gap="lg" style={{ flex: 1 }}>
              <Box pos="relative" w={260} h={260}>
                <Box pos="relative" style={{ zIndex: 2 }}>
                <DonutChart
                  size={260}
                  thickness={34}
                  data={donutData}
                  valueFormatter={(v) => mask(formatBRL(v))}
                  withTooltip
                  tooltipDataSource="segment"
                  tooltipProps={{
                    wrapperStyle: { zIndex: 10 },
                    content: ({ payload }) => {
                      const item = payload?.[0];
                      if (!item) return null;
                      const value = Number(item.value);
                      return (
                        <Paper withBorder shadow="md" radius="md" px="sm" py={6}>
                          <Group gap={8} wrap="nowrap">
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: item.payload?.color,
                                flexShrink: 0,
                              }}
                            />
                            <Text size="sm" fw={600}>
                              {item.name}
                            </Text>
                          </Group>
                          <Text size="sm">
                            {mask(formatBRL(value))} · {formatPercent(value, donutTotal)}
                          </Text>
                        </Paper>
                      );
                    },
                  }}
                />
                </Box>
                <Stack
                  gap={0}
                  align="center"
                  justify="center"
                  style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
                >
                  <Text fw={700} size="sm">
                    {mask(formatBRL(donutTotal))}
                  </Text>
                  <Text size="xs" c="dimmed">
                    total no mês
                  </Text>
                </Stack>
              </Box>

              <Stack gap="sm" w="100%">
                {donutData.slice(0, MAX_TAGS_IN_CARD).map((d) => (
                  <TagRow key={d.name} slice={d} total={donutTotal} mask={mask} />
                ))}
              </Stack>
            </Stack>
          {donutData.length > MAX_TAGS_IN_CARD && (
            <UnstyledButton onClick={allTags.open} mt="lg">
              <Group gap="xs">
                <Text ff="heading" fw={700} c="var(--duro-brand)">
                  Ver todas as tags
                </Text>
                <Badge variant="light" color="gray" circle={false}>
                  {donutData.length}
                </Badge>
              </Group>
            </UnstyledButton>
          )}
            </>
          )}
        </Paper>
      </SimpleGrid>

      <Modal
        opened={allTagsOpened}
        onClose={allTags.close}
        size="lg"
        radius="lg"
        title={
          <Group gap="sm">
            <Text ff="heading" fw={700} fz="lg">
              Todas as tags
            </Text>
            <Badge variant="light" color="gray">
              {donutData.length}
            </Badge>
          </Group>
        }
      >
        <ScrollArea.Autosize mah={400} type="auto" scrollbarSize={6} offsetScrollbars="y">
          <Stack gap="sm" pr={16}>
            {donutData.map((d) => (
              <TagRow key={d.name} slice={d} total={donutTotal} mask={mask} />
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
            total no mês
          </Text>
          <Text fw={700}>{mask(formatBRL(donutTotal))}</Text>
        </Group>
      </Modal>

      {range && (
        <Grid gap="md">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <BudgetProgressCard from={from} to={to} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <RecentTransactionsCard from={from} to={to} />
          </Grid.Col>
        </Grid>
      )}

      <Paper withBorder p="lg">
        <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
          <div>
            <Text ff="heading" fw={700} fz="lg">
              Receitas x despesas
            </Text>
            <Text size="sm" c="dimmed">
              Comparativo mensal nos últimos meses
            </Text>
          </div>
          <SegmentedControl
            size="xs"
            value={historyMonths}
            onChange={setHistoryMonths}
            data={[
              { label: '3M', value: '3' },
              { label: '6M', value: '6' },
              { label: '1A', value: '12' },
            ]}
            aria-label="Intervalo do histórico"
          />
        </Group>
        {history.isLoading ? (
          <Skeleton h={280} />
        ) : !hasHistoryData ? (
          <Empty>Sem lançamentos nos últimos {historyMonths === '12' ? '12' : historyMonths} meses.</Empty>
        ) : (
          <BarChart
            h={280}
            data={historyChart}
            dataKey="label"
            series={[
              { name: 'Receitas', color: 'var(--duro-income)' },
              { name: 'Despesas', color: 'var(--duro-expense)' },
            ]}
            valueFormatter={(v) => mask(formatBRL(v))}
            yAxisProps={{ width: 76, tickFormatter: (v: number) => mask(formatBRLCompact(v)) }}
            xAxisProps={
              historyMonths === '12'
                ? { interval: 0, angle: -40, textAnchor: 'end', height: 52 }
                : { interval: 0 }
            }
            barProps={{ maxBarSize: 28, radius: [4, 4, 0, 0] }}
            withLegend
            tickLine="y"
          />
        )}
      </Paper>
    </Stack>
  );
}
