export type Role = 'admin' | 'common';
export type TxType = 'income' | 'expense';

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount_cents: number;
  type: TxType;
  occurred_on: string; // YYYY-MM-DD
  tags: Tag[];
  /** Preenchido quando a linha é uma ocorrência de recorrência (não é uma transação real). */
  recurring_id: string | null;
  /** Data original da ocorrência da recorrência (identifica o mês); nulo em transações reais. */
  recurring_ref: string | null;
}

export interface Recurring {
  id: string;
  description: string;
  amount_cents: number;
  type: TxType;
  start_date: string; // YYYY-MM-DD
  end_date: string | null; // null = sem data final
  day_of_month: number;
  tags: Tag[];
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface SummaryRow {
  income_cents: number;
  expense_cents: number;
}

export interface ByTagRow {
  tag_id: string | null;
  tag_name: string;
  color: string;
  total_cents: number;
}

export type SeriesUnit = 'day' | 'month';

export interface SeriesRow {
  period: string; // YYYY-MM-DD (o dia, ou o primeiro dia do mês)
  income_cents: number;
  expense_cents: number;
}

export type ActionResult = { ok: true } | { ok: false; error: string };
