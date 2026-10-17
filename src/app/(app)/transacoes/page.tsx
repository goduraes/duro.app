import type { Metadata } from 'next';
import { TransactionsTabs } from '@/components/transactions/transactions-tabs';

export const metadata: Metadata = { title: 'Transações' };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ nova?: string; tag?: string; mes?: string; tipo?: string }>;
}) {
  const { nova, tag, mes, tipo } = await searchParams;

  // Filtros vindos de links (ex.: "Ver em Transações" no orçamento); valores inválidos são ignorados.
  const initialMonth = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : null;
  const initialTagId = tag && /^[0-9a-f-]{36}$/i.test(tag) ? tag : null;
  const initialType = tipo === 'income' || tipo === 'expense' ? tipo : null;

  return (
    <TransactionsTabs
      // remonta quando o link muda os filtros, para o estado inicial refletir a URL nova
      key={`${initialMonth}|${initialTagId}|${initialType}`}
      openNew={nova === '1'}
      initialMonth={initialMonth}
      initialTagId={initialTagId}
      initialType={initialType}
    />
  );
}
