-- Recorrência parcelada: o usuário informa o valor TOTAL e o número de parcelas.
--   amount_cents = valor de cada parcela (total dividido, arredondado para baixo)
--   total_cents  = total informado; a última parcela leva a diferença de arredondamento
-- Sem total_cents (recorrência sem fim ou criada antes), todos os meses valem amount_cents.

alter table public.recurring_transactions
  add column total_cents integer check (total_cents is null or total_cents > 0);

drop function if exists public.save_recurring_transaction(uuid, text, integer, text, date, date, integer, uuid[]);

create function public.save_recurring_transaction(
  p_id           uuid,
  p_description  text,
  p_amount_cents integer,
  p_type         text,
  p_start_date   date,
  p_end_date     date,
  p_day_of_month integer,
  p_total_cents  integer,
  p_tag_ids      uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.recurring_transactions
      (user_id, description, amount_cents, type, start_date, end_date, day_of_month, total_cents)
    values
      ((select auth.uid()), p_description, p_amount_cents, p_type, p_start_date, p_end_date, p_day_of_month, p_total_cents)
    returning id into v_id;
  else
    update public.recurring_transactions
       set description = p_description,
           amount_cents = p_amount_cents,
           type = p_type,
           start_date = p_start_date,
           end_date = p_end_date,
           day_of_month = p_day_of_month,
           total_cents = p_total_cents
     where id = p_id and user_id = (select auth.uid())
    returning id into v_id;

    if v_id is null then
      raise exception 'Recorrência não encontrada';
    end if;

    delete from public.recurring_transaction_tags where recurring_id = v_id;
  end if;

  if p_tag_ids is not null and cardinality(p_tag_ids) > 0 then
    insert into public.recurring_transaction_tags (recurring_id, tag_id)
    select v_id, tag from unnest(p_tag_ids) as tag;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.save_recurring_transaction(uuid, text, integer, text, date, date, integer, integer, uuid[]) from public, anon;
grant execute on function public.save_recurring_transaction(uuid, text, integer, text, date, date, integer, integer, uuid[]) to authenticated;

------------------------------------------------------------------
-- all_transactions: a última parcela fecha o total
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
    r.id::text || ':' || o.occ::text,
    null::uuid,
    r.id,
    coalesce(ov.description, r.description),
    coalesce(
      ov.amount_cents,
      case
        -- última parcela: total informado menos o que as anteriores somam
        when r.total_cents is not null and o.inst is not null and o.inst = o.tot
          then r.total_cents - r.amount_cents * (o.tot - 1)
        else r.amount_cents
      end
    ),
    coalesce(ov.type, r.type),
    coalesce(ov.occurred_on, o.occ),
    r.created_at,
    coalesce(
      ov.tag_ids,
      (select array_agg(rt.tag_id) from public.recurring_transaction_tags rt where rt.recurring_id = r.id),
      '{}'::uuid[]
    ),
    o.inst,
    o.tot
  from public.recurring_transactions r
  cross join lateral (
    select
      (m::date + (least(
         r.day_of_month,
         extract(day from (m::date + interval '1 month' - interval '1 day'))::integer
       ) - 1)) as occ,
      case when r.end_date is null then null else
        ((extract(year from m) - extract(year from r.start_date)) * 12
          + extract(month from m) - extract(month from r.start_date))::integer + 1
      end as inst,
      case when r.end_date is null then null else
        ((extract(year from r.end_date) - extract(year from r.start_date)) * 12
          + extract(month from r.end_date) - extract(month from r.start_date))::integer + 1
      end as tot
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
