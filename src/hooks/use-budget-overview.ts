'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { BudgetRow } from '@/lib/types';

/**
 * Orçamentos do mês com limite calculado e gasto. A chave começa com 'transactions': ao criar,
 * editar ou excluir transações e recorrências, o gasto recalcula sozinho. Telas que usam o mesmo
 * mês compartilham o cache.
 */
export function useBudgetOverview(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['transactions', 'budgets', from, to],
    enabled,
    queryFn: async () => {
      const { data, error } = await createClient().rpc('budget_overview', { p_from: from, p_to: to });
      if (error) throw new Error(error.message);
      return ((data ?? []) as BudgetRow[]).map((b) => ({
        ...b,
        limit_cents: Number(b.limit_cents),
        spent_cents: Number(b.spent_cents),
        tx_count: Number(b.tx_count),
        percent: b.percent === null ? null : Number(b.percent),
      }));
    },
  });
}

/** Cor da barra: verde até 80% do limite, amarelo até 100% e vermelho acima. */
export function budgetBarColor(spent: number, limit: number) {
  if (limit <= 0) return spent > 0 ? 'red' : 'gray';
  const ratio = spent / limit;
  return ratio > 1 ? 'red' : ratio >= 0.8 ? 'yellow' : 'teal';
}
