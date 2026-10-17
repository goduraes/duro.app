'use client';

import { useState } from 'react';
import { Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { IconHistory, IconRepeat } from '@tabler/icons-react';
import { MonthNavigator, currentMonthPeriod, type Period } from '@/components/period-filter';
import { RecurringView } from './recurring-view';
import { TransactionsView } from './transactions-view';

export function TransactionsTabs({ openNew = false }: { openNew?: boolean }) {
  const [tab, setTab] = useState<string | null>('history');
  const [period, setPeriod] = useState<Period>(currentMonthPeriod);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" gap="md">
        <div>
          <Title order={2} style={{ letterSpacing: '-0.02em' }}>
            Transações
          </Title>
          <Text c="dimmed" size="sm" mt={2}>
            Aqui você pode visualizar todas as suas transações
          </Text>
        </div>
        <MonthNavigator value={period} onChange={setPeriod} />
      </Group>

      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
            Histórico
          </Tabs.Tab>
          <Tabs.Tab value="recurring" leftSection={<IconRepeat size={16} />}>
            Recorrência
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="history" pt="lg">
          <TransactionsView period={period} openNew={openNew} />
        </Tabs.Panel>
        <Tabs.Panel value="recurring" pt="lg">
          <RecurringView period={period} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
