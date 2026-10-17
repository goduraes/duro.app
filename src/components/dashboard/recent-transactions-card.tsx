'use client';

import Link from 'next/link';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { Anchor, Box, Group, Paper, Skeleton, Stack, Text } from '@mantine/core';
import { usePrivacy } from '@/components/privacy';
import { createClient } from '@/lib/supabase/client';
import { formatCents } from '@/lib/money';
import type { Tag, TxType } from '@/lib/types';

const LIMIT = 5;

interface Row {
  key: string;
  description: string;
  amount_cents: number;
  type: TxType;
  occurred_on: string;
  tags: Tag[];
  installment: number | null;
  installments: number | null;
}

/** Últimas transações do mês escolhido, até hoje (recorrências que ainda vão cair não entram). */
export function RecentTransactionsCard({ from, to }: { from: string; to: string }) {
  const { mask } = usePrivacy();
  const today = dayjs().format('YYYY-MM-DD');
  // Mês no futuro: não há o que mostrar ainda.
  const upTo = to < today ? to : today;

  const list = useQuery({
    queryKey: ['transactions', 'recent', from, upTo],
    enabled: !!from && !!to && from <= today,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('list_transactions', {
        p_from: from,
        p_to: upTo,
        p_type: null,
        p_tags: null,
        p_sort: 'occurred_on',
        p_dir: 'desc',
        p_limit: LIMIT,
        p_offset: 0,
        p_search: null,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
  });

  const rows = list.data ?? [];

  return (
    <Paper withBorder p="lg" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between" align="center" mb="md">
        <Text ff="heading" fw={700} fz="lg">
          Transações recentes
        </Text>
        <Anchor component={Link} href="/transacoes" size="sm" fw={600}>
          Ver todas
        </Anchor>
      </Group>

      {list.isLoading ? (
        <Stack gap="md">
          {Array.from({ length: LIMIT }).map((_, i) => (
            <Skeleton key={i} h={44} />
          ))}
        </Stack>
      ) : rows.length === 0 ? (
        <Stack align="center" justify="center" gap={6} py="xl" style={{ flex: 1 }}>
          <Text c="dimmed" size="sm" ta="center">
            Nenhuma transação neste mês até agora.
          </Text>
          <Anchor component={Link} href="/transacoes?nova=1" size="sm" fw={600}>
            Criar transação
          </Anchor>
        </Stack>
      ) : (
        <Stack gap={0}>
          {rows.map((t, i) => {
            const tag = t.tags[0];
            return (
              <Group
                key={t.key}
                justify="space-between"
                wrap="nowrap"
                align="flex-start"
                gap="sm"
                py="sm"
                style={i > 0 ? { borderTop: '1px solid var(--mantine-color-default-border)' } : undefined}
              >
                <Group gap={10} wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: tag?.color ?? 'var(--mantine-color-gray-6)',
                      flexShrink: 0,
                      marginTop: 7,
                    }}
                  />
                  <Box style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate>
                      {t.description}
                      {t.installment && t.installments && (
                        <Text span size="xs" fw={400} c="dimmed" ml={6}>
                          ({t.installment}/{t.installments})
                        </Text>
                      )}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {dayjs(t.occurred_on).format('DD/MM')}
                      {tag ? ` · ${tag.name}` : ''}
                    </Text>
                  </Box>
                </Group>
                <Text size="sm" fw={700} c={t.type === 'income' ? 'teal' : 'red'} style={{ whiteSpace: 'nowrap' }}>
                  {mask(`${t.type === 'income' ? '+' : '−'}${formatCents(t.amount_cents)}`)}
                </Text>
              </Group>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}
