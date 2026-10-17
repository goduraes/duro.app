-- Totais de receitas/despesas respeitando os mesmos filtros da listagem (período, tipo e tag).
create or replace function public.transactions_totals(
  p_from date,
  p_to date,
  p_type text default null,
  p_tag uuid default null
)
returns table (income_cents bigint, expense_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(t.amount_cents) filter (where t.type = 'income'), 0)::bigint,
    coalesce(sum(t.amount_cents) filter (where t.type = 'expense'), 0)::bigint
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.occurred_on between p_from and p_to
    and (p_type is null or t.type = p_type)
    and (p_tag is null or exists (
      select 1 from public.transaction_tags tt
      where tt.transaction_id = t.id and tt.tag_id = p_tag
    ));
$$;

revoke execute on function public.transactions_totals(date, date, text, uuid) from public, anon;
grant execute on function public.transactions_totals(date, date, text, uuid) to authenticated;
