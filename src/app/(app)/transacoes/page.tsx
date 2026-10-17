import type { Metadata } from 'next';
import { TransactionsTabs } from '@/components/transactions/transactions-tabs';

export const metadata: Metadata = { title: 'Transações' };

export default function TransactionsPage() {
  return <TransactionsTabs />;
}
