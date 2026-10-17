'use client';

import Link from 'next/link';
import dayjs from 'dayjs';
import { Anchor, Box, Group, Paper, Progress, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { usePrivacy } from '@/components/privacy';
import { budgetBarColor, useBudgetOverview } from '@/hooks/use-budget-overview';
import { formatCents } from '@/lib/money';

/** Quanto cada orçamento já usou do limite no mês escolhido. */
export function BudgetProgressCard({ from, to }: { from: string; to: string }) {
  const { mask } = usePrivacy();
  const budgets = useBudgetOverview(from, to, !!from && !!to);
  const rows = budgets.data ?? [];
  const monthName = from ? dayjs(from).format('MMMM') : '';

  return (
    <Paper withBorder p="lg" h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between" align="baseline" mb="lg" gap="xs">
        <Group gap="sm" align="baseline">
          <Text ff="heading" fw={700} fz="lg">
            Orçamento
          </Text>
          <Text size="sm" c="dimmed">
            quanto cada orçamento já usou do limite de {monthName}
          </Text>
        </Group>
        <Anchor component={Link} href="/orcamento" size="sm" fw={600}>
          Ver orçamento
        </Anchor>
      </Group>

      {budgets.isLoading ? (
        // Esqueleto com o mesmo desenho dos itens: nome e porcentagem, barra e as duas linhas de valores.
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl" verticalSpacing="lg">
          {Array.from({ length: 4 }).map((_, i) => (
            <Box key={i}>
              <Group justify="space-between" gap="xs" wrap="nowrap" mb={6}>
                <Group gap={8} wrap="nowrap">
                  <Skeleton circle h={10} w={10} />
                  <Skeleton h={14} w={96} />
                </Group>
                <Skeleton h={14} w={32} />
              </Group>
              <Skeleton h={10} radius="xl" />
              <Group justify="space-between" gap="xs" mt={6} wrap="nowrap">
                <Skeleton h={12} w={120} />
                <Skeleton h={12} w={90} />
              </Group>
            </Box>
          ))}
        </SimpleGrid>
      ) : rows.length === 0 ? (
        <Stack align="center" justify="center" gap={6} py="xl" style={{ flex: 1 }}>
          <Text c="dimmed" size="sm" ta="center">
            Nenhum orçamento criado.
          </Text>
          <Anchor component={Link} href="/orcamento" size="sm" fw={600}>
            Criar um orçamento
          </Anchor>
        </Stack>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl" verticalSpacing="lg">
          {rows.map((b) => {
            const noLimit = b.limit_cents <= 0;
            const ratio = noLimit ? (b.spent_cents > 0 ? 1 : 0) : b.spent_cents / b.limit_cents;
            const over = b.spent_cents > b.limit_cents;
            const color = budgetBarColor(b.spent_cents, b.limit_cents);
            // Sem limite (ex.: % das receitas num mês sem receitas) não existe porcentagem para mostrar.
            const pct = noLimit ? (b.spent_cents > 0 ? '—' : '0%') : `${Math.round(ratio * 100)}%`;

            return (
              <Box key={b.id} style={{ minWidth: 0 }}>
                <Group justify="space-between" gap="xs" wrap="nowrap" mb={6}>
                  <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                    <span
                      style={{ width: 10, height: 10, borderRadius: 999, background: b.tag_color, flexShrink: 0 }}
                    />
                    <Text size="sm" fw={600} truncate>
                      {b.tag_name}
                    </Text>
                    {b.kind === 'percent' && (
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {(b.percent ?? 0).toLocaleString('pt-BR')}%
                      </Text>
                    )}
                  </Group>
                  <Text size="sm" fw={700} c={color === 'gray' ? 'dimmed' : color} style={{ flexShrink: 0 }}>
                    {pct}
                  </Text>
                </Group>

                <Progress
                  value={Math.min(ratio, 1) * 100}
                  color={color}
                  size="md"
                  radius="xl"
                  aria-label={`${b.tag_name}: ${pct} do limite`}
                />

                <Group justify="space-between" gap="xs" mt={6} wrap="nowrap">
                  <Text size="xs" c="dimmed">
                    {mask(formatCents(b.spent_cents))} de {mask(formatCents(b.limit_cents))}
                  </Text>
                  <Text size="xs" c={over ? 'red' : 'dimmed'} fw={over ? 600 : 400} ta="right">
                    {noLimit
                      ? 'sem limite no mês'
                      : over
                        ? `estourou ${mask(formatCents(b.spent_cents - b.limit_cents))}`
                        : `faltam ${mask(formatCents(b.limit_cents - b.spent_cents))}`}
                  </Text>
                </Group>
              </Box>
            );
          })}
        </SimpleGrid>
      )}
    </Paper>
  );
}
