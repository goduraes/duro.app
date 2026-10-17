-- Novas tags padrão: todo usuário NOVO já nasce com estas 11. Quem já tem conta não é alterado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(btrim(new.raw_user_meta_data ->> 'name'), ''),
    coalesce(new.email, '')
  );

  insert into public.tags (user_id, name, color) values
    (new.id, 'Moradia',       '#4c6ef5'),
    (new.id, 'Alimentação',   '#40c057'),
    (new.id, 'Transporte',    '#fab005'),
    (new.id, 'Saúde',         '#fa5252'),
    (new.id, 'Educação',      '#15aabf'),
    (new.id, 'Lazer',         '#be4bdb'),
    (new.id, 'Vestuário',     '#e64980'),
    (new.id, 'Comunicação',   '#e8590c'),
    (new.id, 'Investimentos', '#0b8a2a'),
    (new.id, 'Salário',       '#12b886'),
    (new.id, 'Outros',        '#868e96');

  return new;
end;
$$;
