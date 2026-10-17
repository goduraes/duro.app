-- Orçamento por tag: um limite mensal para as despesas de cada tag.
--   kind = 'fixed'   → valor fixo (amount_cents)
--   kind = 'percent' → porcentagem das RECEITAS do mês (percent)
-- O limite vale para todos os meses; o que muda de mês a mês é o gasto (e, em porcentagem, a receita).

create table public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tag_id        uuid not null references public.tags (id) on delete cascade,
  kind          text not null check (kind in ('fixed', 'percent')),
  amount_cents  integer check (amount_cents is null or amount_cents > 0),
  percent       numeric(5, 2) check (percent is null or (percent > 0 and percent <= 100)),
  created_at    timestamptz not null default now(),
  unique (user_id, tag_id),
  check (
    (kind = 'fixed'   and amount_cents is not null and percent is null) or
    (kind = 'percent' and percent is not null and amount_cents is null)
  )
);

alter table public.budgets enable row level security;

-- Estritamente do dono, com conta ativa, e só para tags dele.
create policy budgets_owner on public.budgets
  for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (
    user_id = (select auth.uid())
    and public.is_active_user()
    and exists (select 1 from public.tags g where g.id = tag_id and g.user_id = (select auth.uid()))
  );

revoke all on public.budgets from anon;
revoke all on public.budgets from authenticated;
grant select, insert, update, delete on public.budgets to authenticated;

------------------------------------------------------------------
-- Orçamentos do usuário no período, com limite calculado e gasto
------------------------------------------------------------------

create or replace function public.budget_overview(p_from date, p_to date)
returns table (
  id            uuid,
  tag_id        uuid,
  tag_name      text,
  tag_color     text,
  kind          text,
  amount_cents  integer,
  percent       numeric,
  limit_cents   bigint,
  spent_cents   bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with month_tx as (
    select * from public.all_transactions(p_from, p_to)
  ),
  income as (
    select coalesce(sum(m.amount_cents) filter (where m.type = 'income'), 0)::bigint as total
    from month_tx m
  ),
  spent as (
    -- uma transação com várias tags conta integralmente em cada uma (igual ao dashboard)
    select tid as tag_id, sum(m.amount_cents)::bigint as total
    from month_tx m
    cross join lateral unnest(m.tag_ids) as tid
    where m.type = 'expense'
    group by tid
  )
  select
    b.id,
    b.tag_id,
    g.name,
    g.color,
    b.kind,
    b.amount_cents,
    b.percent,
    case when b.kind = 'fixed'
         then b.amount_cents::bigint
         else round(i.total * b.percent / 100)::bigint
    end,
    coalesce(s.total, 0)
  from public.budgets b
  join public.tags g on g.id = b.tag_id
  cross join income i
  left join spent s on s.tag_id = b.tag_id
  where b.user_id = (select auth.uid())
  order by g.name;
$$;

revoke execute on function public.budget_overview(date, date) from public, anon;
grant execute on function public.budget_overview(date, date) to authenticated;
