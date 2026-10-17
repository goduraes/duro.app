-- Contador de parcelas: quando a recorrência tem mês de fim, cada ocorrência sabe em que
-- parcela está ("2 de 3"). Sem mês de fim, os dois campos ficam nulos.

drop function if exists public.list_transactions(date, date, text, uuid[], text, text, int, int, text);
drop function if exists public.all_transactions(date, date);

create function public.all_transactions(p_from date, p_to date)
returns table (
  key           text,
  id            uuid,
  recurring_id  uuid,
  description   text,
  amount_cents  integer,
  type          text,
  occurred_on   date,
  created_at    timestamptz,
  tag_ids       uuid[],
  installment   integer,
  installments  integer
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
    coalesce((select array_agg(tt.tag_id) from public.transaction_tags tt where tt.transaction_id = t.id), '{}'::uuid[]),
    null::integer,
    null::integer
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.occurred_on between p_from and p_to

  union all

  select
    -- a chave usa a data original da ocorrência (estável mesmo se a data do mês for alterada)
    r.id::text || ':' || o.occ::text,
    null::uuid,
    r.id,
    coalesce(ov.description, r.description),
    coalesce(ov.amount_cents, r.amount_cents),
    coalesce(ov.type, r.type),
    coalesce(ov.occurred_on, o.occ),
    r.created_at,
    coalesce(
      ov.tag_ids,
      (select array_agg(rt.tag_id) from public.recurring_transaction_tags rt where rt.recurring_id = r.id),
      '{}'::uuid[]
    ),
    -- parcela atual e total de parcelas (só quando há mês de fim)
    case when r.end_date is null then null else
      ((extract(year from o.occ) - extract(year from r.start_date)) * 12
        + extract(month from o.occ) - extract(month from r.start_date))::integer + 1
    end,
    case when r.end_date is null then null else
      ((extract(year from r.end_date) - extract(year from r.start_date)) * 12
        + extract(month from r.end_date) - extract(month from r.start_date))::integer + 1
    end
  from public.recurring_transactions r
  cross join lateral (
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
  left join public.recurring_overrides ov
    on ov.recurring_id = r.id
   and ov.ref_month = date_trunc('month', o.occ::timestamp)::date
  where r.user_id = (select auth.uid())
    and o.occ between greatest(r.start_date, p_from) and least(coalesce(r.end_date, p_to), p_to)
    and not coalesce(ov.is_skipped, false);
$$;

revoke execute on function public.all_transactions(date, date) from public, anon;
grant execute on function public.all_transactions(date, date) to authenticated;

create function public.list_transactions(
  p_from   date,
  p_to     date,
  p_type   text default null,
  p_tags   uuid[] default null,
  p_sort   text default 'occurred_on',
  p_dir    text default 'desc',
  p_limit  int default 10,
  p_offset int default 0,
  p_search text default null
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
  installment   integer,
  installments  integer,
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
      and (
        p_search is null or btrim(p_search) = ''
        or extensions.unaccent(lower(a.description)) like
           '%' || extensions.unaccent(lower(replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_'))) || '%'
           escape '\'
      )
  )
  select
    f.key, f.id, f.recurring_id, f.description, f.amount_cents, f.type, f.occurred_on,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color) order by g.name)
      from public.tags g where g.id = any (f.tag_ids)
    ), '[]'::jsonb),
    f.installment,
    f.installments,
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

revoke execute on function public.list_transactions(date, date, text, uuid[], text, text, int, int, text) from public, anon;
grant execute on function public.list_transactions(date, date, text, uuid[], text, text, int, int, text) to authenticated;
