-- Exceções por mês de uma recorrência: pular o mês (excluir só ele) ou alterar só aquele mês
-- (descrição, valor, tipo, data dentro do mês, tag). Campos nulos herdam da recorrência.

create table public.recurring_overrides (
  recurring_id  uuid not null references public.recurring_transactions (id) on delete cascade,
  ref_month     date not null check (ref_month = date_trunc('month', ref_month)::date),
  is_skipped    boolean not null default false,
  description   text check (description is null or char_length(btrim(description)) between 1 and 120),
  amount_cents  integer check (amount_cents is null or amount_cents > 0),
  type          text check (type is null or type in ('income', 'expense')),
  occurred_on   date,
  tag_ids       uuid[],                        -- nulo = herda as tags da recorrência
  created_at    timestamptz not null default now(),
  primary key (recurring_id, ref_month),
  check (occurred_on is null or date_trunc('month', occurred_on)::date = ref_month)
);

alter table public.recurring_overrides enable row level security;

create policy recurring_overrides_owner on public.recurring_overrides
  for all to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1 from public.recurring_transactions r
      where r.id = recurring_id and r.user_id = (select auth.uid())
    )
  )
  with check (
    public.is_active_user()
    and exists (
      select 1 from public.recurring_transactions r
      where r.id = recurring_id and r.user_id = (select auth.uid())
    )
  );

revoke all on public.recurring_overrides from anon;
revoke all on public.recurring_overrides from authenticated;
grant select, insert, update, delete on public.recurring_overrides to authenticated;

------------------------------------------------------------------
-- all_transactions passa a aplicar as exceções
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
    )
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

------------------------------------------------------------------
-- RPCs
------------------------------------------------------------------

-- Altera só um mês da recorrência.
create or replace function public.save_recurring_override(
  p_recurring_id uuid,
  p_ref_month    date,
  p_description  text,
  p_amount_cents integer,
  p_type         text,
  p_occurred_on  date,
  p_tag_ids      uuid[]
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.recurring_overrides
    (recurring_id, ref_month, is_skipped, description, amount_cents, type, occurred_on, tag_ids)
  values
    (p_recurring_id, date_trunc('month', p_ref_month::timestamp)::date, false,
     p_description, p_amount_cents, p_type, p_occurred_on, coalesce(p_tag_ids, '{}'::uuid[]))
  on conflict (recurring_id, ref_month) do update set
    is_skipped = false,
    description = excluded.description,
    amount_cents = excluded.amount_cents,
    type = excluded.type,
    occurred_on = excluded.occurred_on,
    tag_ids = excluded.tag_ids;
$$;

-- Exclui só um mês da recorrência.
create or replace function public.skip_recurring_occurrence(p_recurring_id uuid, p_ref_month date)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.recurring_overrides (recurring_id, ref_month, is_skipped)
  values (p_recurring_id, date_trunc('month', p_ref_month::timestamp)::date, true)
  on conflict (recurring_id, ref_month) do update set is_skipped = true;
$$;

revoke execute on function
  public.save_recurring_override(uuid, date, text, integer, text, date, uuid[]),
  public.skip_recurring_occurrence(uuid, date)
from public, anon;

grant execute on function
  public.save_recurring_override(uuid, date, text, integer, text, date, uuid[]),
  public.skip_recurring_occurrence(uuid, date)
to authenticated;
