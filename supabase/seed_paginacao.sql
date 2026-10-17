-- Adiciona 40 transações extras (últimos ~60 dias) para usuario@duro.app, só para testar paginação.
-- Pode rodar mais de uma vez: cada execução adiciona mais 40 lançamentos.
do $$
declare
  v_user uuid;
  v_tx   uuid;
  v_tag  uuid;
  i      int;
  v_type text;
  v_desc text[] := array['Mercado','Padaria','Uber','Cinema','Farmácia','Restaurante','Streaming','Combustível','Academia','Livraria'];
begin
  select id into v_user from public.profiles where email = 'usuario@duro.app';
  if v_user is null then
    raise exception 'usuario@duro.app não encontrado (rode o seed primeiro)';
  end if;

  for i in 1..40 loop
    v_type := case when i % 8 = 0 then 'income' else 'expense' end;
    insert into public.transactions (user_id, description, amount_cents, type, occurred_on)
    values (
      v_user,
      case when v_type = 'income' then 'Freela #' || i else v_desc[1 + (i % 10)] || ' #' || i end,
      case when v_type = 'income' then 80000 + (i * 1370) % 90000 else 1500 + (i * 7919) % 28000 end,
      v_type,
      current_date - ((i * 3) % 60)
    ) returning id into v_tx;

    select id into v_tag from public.tags where user_id = v_user order by random() limit 1;
    if v_tag is not null then
      insert into public.transaction_tags (transaction_id, tag_id) values (v_tx, v_tag);
    end if;
  end loop;
end $$;
