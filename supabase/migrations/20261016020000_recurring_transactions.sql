-- Transações recorrentes (mensais).
-- Cada recorrência vira lançamentos reais em `transactions`, um por mês, do início até o fim
-- (sem data final = sem prazo). Os lançamentos são criados por `generate_recurring_transactions`,
-- chamada pelo app, e só até a data informada (hoje): meses futuros ainda não existem.

------------------------------------------------------------------
-- Tabelas
------------------------------------------------------------------

create table public.recurring_transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  description       text not null check (char_length(btrim(description)) between 1 and 120),
  amount_cents      integer not null check (amount_cents > 0),
  type              text not null check (type in ('income', 'expense')),
  start_date        date not null,
  end_date          date,                      -- nulo = sem data final
  -- dia do mês do lançamento (em meses mais curtos, cai no último dia)
  day_of_month      integer generated always as (extract(day from start_date)::integer) stored,
  -- até quando os lançamentos já foram gerados (evita recriar o que o usuário excluiu)
  last_generated_on date,
  created_at        timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index recurring_transactions_user_idx on public.recurring_transactions (user_id);

create table public.recurring_transaction_tags (
  recurring_id  uuid not null references public.recurring_transactions (id) on delete cascade,
  tag_id        uuid not null references public.tags (id) on delete cascade,
  primary key (recurring_id, tag_id)
);

create index recurring_transaction_tags_tag_idx on public.recurring_transaction_tags (tag_id);

-- Lançamentos gerados guardam de qual recorrência vieram.
-- Excluir a recorrência mantém os lançamentos já criados.
alter table public.transactions
  add column recurring_id uuid references public.recurring_transactions (id) on delete set null;

create unique index transactions_recurring_day_idx
  on public.transactions (recurring_id, occurred_on)
  where recurring_id is not null;

------------------------------------------------------------------
-- RLS: estritamente do dono e só com a conta ativa
------------------------------------------------------------------

alter table public.recurring_transactions     enable row level security;
alter table public.recurring_transaction_tags enable row level security;

create policy recurring_transactions_owner on public.recurring_transactions
  for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()) and public.is_active_user());

create policy recurring_transaction_tags_owner on public.recurring_transaction_tags
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
    and exists (
      select 1 from public.tags g
      where g.id = tag_id and g.user_id = (select auth.uid())
    )
  );

revoke all on public.recurring_transactions, public.recurring_transaction_tags from anon;
revoke all on public.recurring_transactions, public.recurring_transaction_tags from authenticated;
grant select, insert, update, delete on public.recurring_transactions, public.recurring_transaction_tags to authenticated;

------------------------------------------------------------------
-- Criação/edição atômica de recorrência + tags
-- (editar vale só para os próximos lançamentos; os já criados não mudam)
------------------------------------------------------------------

create or replace function public.save_recurring_transaction(
  p_id           uuid,
  p_description  text,
  p_amount_cents integer,
  p_type         text,
  p_start_date   date,
  p_end_date     date,
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
    insert into public.recurring_transactions (user_id, description, amount_cents, type, start_date, end_date)
    values ((select auth.uid()), p_description, p_amount_cents, p_type, p_start_date, p_end_date)
    returning id into v_id;
  else
    update public.recurring_transactions
       set description = p_description,
           amount_cents = p_amount_cents,
           type = p_type,
           start_date = p_start_date,
           end_date = p_end_date
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

------------------------------------------------------------------
-- Geração dos lançamentos que já venceram. Idempotente.
-- Retorna quantos lançamentos novos foram criados.
------------------------------------------------------------------

create or replace function public.generate_recurring_transactions(p_today date default current_date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r         record;
  m         date;
  occ       date;
  v_tx      uuid;
  v_count   integer := 0;
begin
  for r in
    select * from public.recurring_transactions
    where user_id = (select auth.uid())
      and start_date <= p_today
      and (last_generated_on is null or last_generated_on < p_today)
  loop
    for m in
      select gs::date
      from generate_series(
        date_trunc('month', r.start_date::timestamp),
        date_trunc('month', p_today::timestamp),
        interval '1 month'
      ) as gs
    loop
      -- dia do lançamento: o dia de início, ou o último dia do mês se ele não existir
      occ := m + (least(
        r.day_of_month,
        extract(day from (m + interval '1 month' - interval '1 day'))::integer
      ) - 1);

      continue when occ < r.start_date
                 or occ > p_today
                 or (r.end_date is not null and occ > r.end_date)
                 or (r.last_generated_on is not null and occ <= r.last_generated_on);

      v_tx := null;
      insert into public.transactions (user_id, description, amount_cents, type, occurred_on, recurring_id)
      values (r.user_id, r.description, r.amount_cents, r.type, occ, r.id)
      on conflict (recurring_id, occurred_on) where recurring_id is not null do nothing
      returning id into v_tx;

      if v_tx is not null then
        insert into public.transaction_tags (transaction_id, tag_id)
        select v_tx, rt.tag_id
        from public.recurring_transaction_tags rt
        where rt.recurring_id = r.id;
        v_count := v_count + 1;
      end if;
    end loop;

    update public.recurring_transactions set last_generated_on = p_today where id = r.id;
  end loop;

  return v_count;
end;
$$;

revoke execute on function
  public.save_recurring_transaction(uuid, text, integer, text, date, date, uuid[]),
  public.generate_recurring_transactions(date)
from public, anon;

grant execute on function
  public.save_recurring_transaction(uuid, text, integer, text, date, date, uuid[]),
  public.generate_recurring_transactions(date)
to authenticated;
