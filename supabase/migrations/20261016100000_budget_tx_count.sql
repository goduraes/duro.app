-- Orçamento: além do gasto, devolve quantas despesas da tag compõem esse gasto no mês.

drop function if exists public.budget_overview(date, date);

create function public.budget_overview(p_from date, p_to date)
returns table (
  id            uuid,
  tag_id        uuid,
  tag_name      text,
  tag_color     text,
  kind          text,
  amount_cents  integer,
  percent       numeric,
  limit_cents   bigint,
  spent_cents   bigint,
  tx_count      bigint
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
    select tid as tag_id, sum(m.amount_cents)::bigint as total, count(*)::bigint as n
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
    coalesce(s.total, 0),
    coalesce(s.n, 0)
  from public.budgets b
  join public.tags g on g.id = b.tag_id
  cross join income i
  left join spent s on s.tag_id = b.tag_id
  where b.user_id = (select auth.uid())
  order by g.name;
$$;

revoke execute on function public.budget_overview(date, date) from public, anon;
grant execute on function public.budget_overview(date, date) to authenticated;
