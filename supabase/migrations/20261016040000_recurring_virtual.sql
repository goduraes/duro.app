-- Recorrências deixam de ser copiadas para `transactions`.
-- Elas são combinadas com as transações na hora da consulta (all_transactions), então:
--   * excluir/editar uma recorrência vale para todos os meses;
--   * o filtro de período vale também para as recorrências;
--   * histórico, totais e dashboard enxergam as mesmas ocorrências.

------------------------------------------------------------------
-- Remove a geração antiga e o que ela criou
------------------------------------------------------------------

drop function if exists public.generate_recurring_transactions(date);

delete from public.transactions where recurring_id is not null;
drop index if exists public.transactions_recurring_day_idx;
alter table public.transactions drop column if exists recurring_id;
alter table public.recurring_transactions drop column if exists last_generated_on;

------------------------------------------------------------------
-- Transações reais + ocorrências das recorrências no período
------------------------------------------------------------------

create or replace function public.all_transactions(p_from date, p_to date)
returns table (
  key           text,
  id            uuid,
  recurring_id  uuid,
  description   text,
  amount_cents  integer,
  type          text,
  occurred_on   date,
  created_at    timestamptz,
  tag_ids       uuid[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id::text,
    t.id,
    null::uuid,
    t.description,
    t.amount_cents,
    t.type,
    t.occurred_on,
    t.created_at,
    coalesce((select array_agg(tt.tag_id) from public.transaction_tags tt where tt.transaction_id = t.id), '{}'::uuid[])
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.occurred_on between p_from and p_to

  union all

  select
    r.id::text || ':' || o.occ::text,
    null::uuid,
    r.id,
    r.description,
    r.amount_cents,
    r.type,
    o.occ,
    r.created_at,
    coalesce((select array_agg(rt.tag_id) from public.recurring_transaction_tags rt where rt.recurring_id = r.id), '{}'::uuid[])
  from public.recurring_transactions r
  cross join lateral (
    -- um lançamento por mês; no dia escolhido, ou no último dia se o mês for mais curto
    select (m::date + (least(
             r.day_of_month,
             extract(day from (m::date + interval '1 month' - interval '1 day'))::integer
           ) - 1)) as occ
    from generate_series(
           date_trunc('month', greatest(r.start_date, p_from)::timestamp),
           date_trunc('month', p_to::timestamp),
           interval '1 month'
         ) as m
  ) o
  where r.user_id = (select auth.uid())
    and o.occ between greatest(r.start_date, p_from) and least(coalesce(r.end_date, p_to), p_to);
$$;

revoke execute on function public.all_transactions(date, date) from public, anon;
grant execute on function public.all_transactions(date, date) to authenticated;

------------------------------------------------------------------
-- Dashboard e totais passam a usar all_transactions
------------------------------------------------------------------

create or replace function public.dashboard_summary(p_from date, p_to date)
returns table (income_cents bigint, expense_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(a.amount_cents) filter (where a.type = 'income'), 0)::bigint,
    coalesce(sum(a.amount_cents) filter (where a.type = 'expense'), 0)::bigint
  from public.all_transactions(p_from, p_to) a;
$$;

create or replace function public.dashboard_by_tag(p_from date, p_to date, p_type text)
returns table (tag_id uuid, tag_name text, color text, total_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, g.name, g.color, sum(a.amount_cents)::bigint
  from public.all_transactions(p_from, p_to) a
  cross join lateral unnest(a.tag_ids) as tid
  join public.tags g on g.id = tid
  where a.type = p_type
  group by g.id, g.name, g.color

  union all

  select null::uuid, 'Sem tag'::text, '#adb5bd'::text, sum(a.amount_cents)::bigint
  from public.all_transactions(p_from, p_to) a
  where a.type = p_type and cardinality(a.tag_ids) = 0
  having sum(a.amount_cents) is not null

  order by 4 desc;
$$;

create or replace function public.dashboard_series(p_from date, p_to date, p_unit text)
returns table (period date, income_cents bigint, expense_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g::date,
    coalesce(sum(a.amount_cents) filter (where a.type = 'income'), 0)::bigint,
    coalesce(sum(a.amount_cents) filter (where a.type = 'expense'), 0)::bigint
  from generate_series(
         date_trunc(case when p_unit = 'day' then 'day' else 'month' end, p_from::timestamp),
         date_trunc(case when p_unit = 'day' then 'day' else 'month' end, p_to::timestamp),
         case when p_unit = 'day' then interval '1 day' else interval '1 month' end
       ) as g
  left join public.all_transactions(p_from, p_to) a
    on date_trunc(case when p_unit = 'day' then 'day' else 'month' end, a.occurred_on::timestamp) = g
  group by g
  order by g;
$$;

create or replace function public.transactions_totals(
  p_from date,
  p_to date,
  p_type text default null,
  p_tags uuid[] default null
)
returns table (income_cents bigint, expense_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(a.amount_cents) filter (where a.type = 'income'), 0)::bigint,
    coalesce(sum(a.amount_cents) filter (where a.type = 'expense'), 0)::bigint
  from public.all_transactions(p_from, p_to) a
  where (p_type is null or a.type = p_type)
    and (p_tags is null or cardinality(p_tags) = 0 or a.tag_ids && p_tags);
$$;

------------------------------------------------------------------
-- Listagem do histórico (filtros, ordenação e paginação no banco)
-- p_sort: occurred_on | description | amount_cents | tag
------------------------------------------------------------------

drop function if exists public.transactions_page_by_tag(date, date, text, uuid[], text, int, int);

create or replace function public.list_transactions(
  p_from   date,
  p_to     date,
  p_type   text default null,
  p_tags   uuid[] default null,
  p_sort   text default 'occurred_on',
  p_dir    text default 'desc',
  p_limit  int default 10,
  p_offset int default 0
)
returns table (
  key           text,
  id            uuid,
  recurring_id  uuid,
  description   text,
  amount_cents  integer,
  type          text,
  occurred_on   date,
  tags          jsonb,
  total         bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select
      a.*,
      (select min(g.name) from public.tags g where g.id = any (a.tag_ids)) as tag_name
    from public.all_transactions(p_from, p_to) a
    where (p_type is null or a.type = p_type)
      and (p_tags is null or cardinality(p_tags) = 0 or a.tag_ids && p_tags)
  )
  select
    f.key, f.id, f.recurring_id, f.description, f.amount_cents, f.type, f.occurred_on,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color) order by g.name)
      from public.tags g where g.id = any (f.tag_ids)
    ), '[]'::jsonb),
    count(*) over ()
  from filtered f
  order by
    (case when p_sort = 'occurred_on'  and p_dir = 'asc'  then f.occurred_on end) asc,
    (case when p_sort = 'occurred_on'  and p_dir <> 'asc' then f.occurred_on end) desc,
    (case when p_sort = 'description'  and p_dir = 'asc'  then lower(f.description) end) asc,
    (case when p_sort = 'description'  and p_dir <> 'asc' then lower(f.description) end) desc,
    (case when p_sort = 'amount_cents' and p_dir = 'asc'  then f.amount_cents end) asc,
    (case when p_sort = 'amount_cents' and p_dir <> 'asc' then f.amount_cents end) desc,
    (case when p_sort = 'tag' and p_dir = 'asc'  then f.tag_name end) asc nulls last,
    (case when p_sort = 'tag' and p_dir <> 'asc' then f.tag_name end) desc nulls last,
    f.occurred_on desc, f.created_at desc, f.key
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke execute on function public.list_transactions(date, date, text, uuid[], text, text, int, int) from public, anon;
grant execute on function public.list_transactions(date, date, text, uuid[], text, text, int, int) to authenticated;
