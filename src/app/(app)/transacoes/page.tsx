import type { Metadata } from 'next';
import { TransactionsTabs } from '@/components/transactions/transactions-tabs';

export const metadata: Metadata = { title: 'Transações' };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ nova?: string }>;
}) {
  const { nova } = await searchParams;
  // /transacoes?nova=1 abre direto o formulário de nova transação (usado pelo dashboard).
  return <TransactionsTabs openNew={nova === '1'} />;
}
