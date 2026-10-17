'use client';

import dayjs from 'dayjs';
import { ActionIcon, Group, Paper, Text } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { IconCalendar, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

/** Período como [primeiro dia, último dia] do mês escolhido (YYYY-MM-DD). */
export type Period = [string | null, string | null];

const FMT = 'YYYY-MM-DD';

/** "Outubro 2026" / "Outubro de 2026": o nome do mês em português começa com letra maiúscula. */
export function formatMonthLabel(date: string, withDe = false) {
  const label = dayjs(date).format(withDe ? 'MMMM [de] YYYY' : 'MMMM YYYY');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function currentMonthPeriod(): [string, string] {
  return [dayjs().startOf('month').format(FMT), dayjs().endOf('month').format(FMT)];
}

export function isCompletePeriod(p: Period): p is [string, string] {
  return Boolean(p[0] && p[1]);
}

/** Navegador de mês para o topo da tela: intervalo, seta anterior, seletor do mês e seta seguinte. */
export function MonthNavigator({ value, onChange }: { value: Period; onChange: (value: Period) => void }) {
  const current = value[0] ? dayjs(value[0]) : dayjs();

  function go(month: dayjs.Dayjs) {
    onChange([month.startOf('month').format(FMT), month.endOf('month').format(FMT)]);
  }

  return (
    <Group gap="sm" wrap="nowrap" w={{ base: '100%', sm: 'auto' }}>
      <Paper withBorder radius="xl" px="md" py={6} visibleFrom="sm">
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {current.startOf('month').format('D MMM')} – {current.endOf('month').format('D MMM')}
        </Text>
      </Paper>
      <Paper withBorder radius="md" p={4} style={{ flex: 1 }}>
        <Group gap={4} wrap="nowrap" justify="space-between">
          <ActionIcon variant="subtle" color="gray" aria-label="Mês anterior" onClick={() => go(current.subtract(1, 'month'))}>
            <IconChevronLeft size={16} />
          </ActionIcon>
          <MonthPickerInput
            variant="unstyled"
            leftSection={<IconCalendar size={16} />}
            valueFormatter={({ date }) => (typeof date === 'string' ? formatMonthLabel(date) : '')}
            value={current.startOf('month').format(FMT)}
            onChange={(v) => v && go(dayjs(v))}
            allowDeselect={false}
            w={{ base: 'auto', sm: 170 }}
            style={{ flex: 1 }}
            styles={{ input: { fontWeight: 600, border: 0, background: 'transparent' } }}
            aria-label="Mês"
          />
          <ActionIcon variant="subtle" color="gray" aria-label="Próximo mês" onClick={() => go(current.add(1, 'month'))}>
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
      </Paper>
    </Group>
  );
}
