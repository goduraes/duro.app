-- A recorrência passa a ser definida por mês de início e mês de fim, com o dia do lançamento
-- escolhido à parte. start_date = 1º dia do mês inicial; end_date = último dia do mês final.

-- day_of_month deixa de ser derivado de start_date e vira um campo próprio.
alter table public.recurring_transactions add column day_num integer;
update public.recurring_transactions set day_num = extract(day from start_date)::integer;
alter table public.recurring_transactions drop column day_of_month;
alter table public.recurring_transactions rename column day_num to day_of_month;
alter table public.recurring_transactions
  alter column day_of_month set not null,
  add constraint recurring_transactions_day_check check (day_of_month between 1 and 31);

drop function if exists public.save_recurring_transaction(uuid, text, integer, text, date, date, uuid[]);

create or replace function public.save_recurring_transaction(
  p_id           uuid,
  p_description  text,
  p_amount_cents integer,
  p_type         text,
  p_start_date   date,
  p_end_date     date,
  p_day_of_month integer,
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
    insert into public.recurring_transactions (user_id, description, amount_cents, type, start_date, end_date, day_of_month)
    values ((select auth.uid()), p_description, p_amount_cents, p_type, p_start_date, p_end_date, p_day_of_month)
    returning id into v_id;
  else
    update public.recurring_transactions
       set description = p_description,
           amount_cents = p_amount_cents,
           type = p_type,
           start_date = p_start_date,
           end_date = p_end_date,
           day_of_month = p_day_of_month
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

revoke execute on function public.save_recurring_transaction(uuid, text, integer, text, date, date, integer, uuid[]) from public, anon;
grant execute on function public.save_recurring_transaction(uuid, text, integer, text, date, date, integer, uuid[]) to authenticated;
