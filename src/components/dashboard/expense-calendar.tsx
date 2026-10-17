'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Badge, Box, Group, Modal, Paper, ScrollArea, Skeleton, Stack, Text, UnstyledButton } from '@mantine/core';
import { usePrivacy } from '@/components/privacy';
import { createClient } from '@/lib/supabase/client';
import { formatCents, formatCentsShort } from '@/lib/money';

interface Expense {
  id: string;
  description: string;
  amount_cents: number;
  occurred_on: string;
  tagNames: string[];
}

interface RawRow {
  key: string;
  description: string;
  amount_cents: number;
  occurred_on: string;
  tags: { name: string }[] | null;
  installment: number | null;
  installments: number | null;
}

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const RED = '224, 49, 49';

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Calendário do mês com o total de saídas de cada dia. Clicar num dia abre as transações. */
export function ExpenseCalendar({ from, to }: { from: string; to: string }) {
  const { mask } = usePrivacy();
  const [openDay, setOpenDay] = useState<string | null>(null);

  const expenses = useQuery({
    queryKey: ['dashboard', 'expenses-by-day', from, to],
    queryFn: async () => {
      // Inclui as ocorrências de recorrências do mês, calculadas no banco.
      const { data, error } = await createClient().rpc('list_transactions', {
        p_from: from,
        p_to: to,
        p_type: 'expense',
        p_tags: null,
        p_sort: 'amount_cents',
        p_dir: 'desc',
        p_limit: 2000,
        p_offset: 0,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as RawRow[]).map(
        (r): Expense => ({
          id: r.key,
          description: r.installment && r.installments ? `${r.description} (${r.installment}/${r.installments})` : r.description,
          amount_cents: r.amount_cents,
          occurred_on: r.occurred_on,
          tagNames: (r.tags ?? []).map((t) => t.name),
        }),
      );
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<string, { total: number; items: Expense[] }>();
    for (const e of expenses.data ?? []) {
      const day = map.get(e.occurred_on) ?? { total: 0, items: [] };
      day.total += e.amount_cents;
      day.items.push(e);
      map.set(e.occurred_on, day);
    }
    return map;
  }, [expenses.data]);

  const monthStart = dayjs(from).startOf('month');
  const daysInMonth = monthStart.daysInMonth();
  const total = [...byDay.values()].reduce((acc, d) => acc + d.total, 0);
  const daysWithSpend = byDay.size;
  const max = Math.max(0, ...[...byDay.values()].map((d) => d.total));
  const maxDay = [...byDay.entries()].find(([, d]) => d.total === max)?.[0];

  const cells: (string | null)[] = [
    ...Array.from({ length: monthStart.day() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => monthStart.add(i, 'day').format('YYYY-MM-DD')),
  ];

  const selected = openDay ? byDay.get(openDay) : undefined;

  return (
    <Paper withBorder p="lg">
      <Text ff="heading" fw={700} fz="lg">
        Saídas por dia
      </Text>
      <Text size="sm" c="dimmed" mb="xs">
        {monthStart.format('MMMM YYYY')} · quanto saiu em cada dia
      </Text>

      {expenses.isLoading ? (
        <>
          <Skeleton h={34} w={170} mb="md" />
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
            {WEEKDAYS.map((d) => (
              <Box key={d} py={6} style={{ display: 'flex', justifyContent: 'center' }}>
                <Skeleton h={12} w={28} />
              </Box>
            ))}
            {Array.from({ length: Math.ceil(cells.length / 7) * 7 }, (_, i) => (
              <Skeleton key={i} h={56} radius={10} />
            ))}
          </Box>
          <Group
            gap="xl"
            mt="md"
            pt="md"
            style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
          >
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={36} w={90} />
            ))}
          </Group>
        </>
      ) : (
        <>
          <Group align="baseline" gap="sm" mb="md">
            <Text ff="heading" fz={30} fw={700} lh={1.1} style={{ letterSpacing: '-0.02em' }}>
              {mask(formatCents(total))}
            </Text>
            <Text size="sm" c="dimmed">
              em {daysWithSpend} {daysWithSpend === 1 ? 'dia' : 'dias'} com saída
            </Text>
          </Group>

          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
            {WEEKDAYS.map((d) => (
              <Text key={d} size="xs" fw={700} c="dimmed" ta="center" py={6}>
                {d}
              </Text>
            ))}
            {cells.map((date, i) => {
              if (!date) return <Box key={`empty-${i}`} />;
              const day = byDay.get(date);
              const intensity = day && max > 0 ? day.total / max : 0;
              const strong = intensity > 0.5;
              const content = (
                <>
                  <Text fz={12} fw={day ? 700 : 500} c={day ? (strong ? 'white' : undefined) : 'dimmed'}>
                    {dayjs(date).date()}
                  </Text>
                  <Text fz={11} fw={700} c={day ? (strong ? 'white' : undefined) : 'dimmed'} mt={4} truncate>
                    {day ? mask(formatCentsShort(day.total)) : '–'}
                  </Text>
                </>
              );
              const style = {
                minHeight: 56,
                borderRadius: 10,
                padding: '6px 8px',
                display: 'flex',
                flexDirection: 'column' as const,
                justifyContent: 'space-between',
                minWidth: 0,
                background: day
                  ? `rgba(${RED}, ${0.22 + intensity * 0.68})`
                  : 'var(--duro-bg)',
                border: '1px solid',
                borderColor: day ? 'transparent' : 'light-dark(var(--duro-border), transparent)',
              };
              return day ? (
                <UnstyledButton
                  key={date}
                  style={style}
                  onClick={() => setOpenDay(date)}
                  aria-label={`${dayjs(date).format('D [de] MMMM')}: ${day.items.length} saídas`}
                >
                  {content}
                </UnstyledButton>
              ) : (
                <Box key={date} style={style}>
                  {content}
                </Box>
              );
            })}
          </Box>

          <Group
            justify="space-between"
            align="flex-end"
            gap="lg"
            mt="md"
            pt="md"
            style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
          >
            <Group gap="xl">
              <div>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Média por dia
                </Text>
                <Text fw={700}>{mask(formatCents(Math.round(total / daysInMonth)))}</Text>
              </div>
              <div>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Maior dia
                </Text>
                <Text fw={700}>
                  {maxDay ? `${dayjs(maxDay).format('DD/MM')} · ${mask(formatCentsShort(max))}` : '–'}
                </Text>
              </div>
              <div>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Dias sem saída
                </Text>
                <Text fw={700}>{daysInMonth - daysWithSpend}</Text>
              </div>
            </Group>
            <Text size="xs" c="dimmed">
              Toque num dia para ver as transações
            </Text>
          </Group>
        </>
      )}

      <Modal
        opened={!!openDay && !!selected}
        onClose={() => setOpenDay(null)}
        size="md"
        radius="lg"
        title={
          openDay ? (
            <Group gap="sm">
              <Text ff="heading" fw={700} fz="lg">
                {dayjs(openDay).format('D [de] MMMM')}
              </Text>
              <Badge variant="light" color="gray" tt="none">
                {dayjs(openDay).format('ddd')}
              </Badge>
            </Group>
          ) : null
        }
      >
        {selected && (
          <Stack gap={0}>
            <Text size="sm" c="dimmed" mb="md">
              {selected.items.length} {selected.items.length === 1 ? 'transação' : 'transações'} neste dia
            </Text>
            <ScrollArea.Autosize mah={360} type="auto" scrollbarSize={6} offsetScrollbars="y">
              <Stack gap="md" pr={16}>
              {selected.items.map((e) => (
                <Group key={e.id} justify="space-between" wrap="nowrap" align="flex-start">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} truncate>
                      {e.description}
                    </Text>
                    {e.tagNames.length > 0 && (
                      <Text size="xs" c="dimmed" truncate>
                        {e.tagNames.join(' · ')}
                      </Text>
                    )}
                  </div>
                  <Text fw={700} c="red" style={{ whiteSpace: 'nowrap' }}>
                    {mask(`−${formatCents(e.amount_cents)}`)}
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
                {selected.items.length} {selected.items.length === 1 ? 'transação' : 'transações'}
              </Text>
              <Text fw={700} c="red">
                {mask(`−${formatCents(selected.total)}`)}
              </Text>
            </Group>
          </Stack>
        )}
      </Modal>
    </Paper>
  );
}
