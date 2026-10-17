-- Guarda o último acesso no próprio profile para poder ordenar/filtrar a lista de usuários no banco.
alter table public.profiles add column if not exists last_sign_in_at timestamptz;

update public.profiles p
set last_sign_in_at = u.last_sign_in_at
from auth.users u
where u.id = p.id;

create or replace function public.sync_last_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set last_sign_in_at = new.last_sign_in_at where id = new.id;
  return new;
end;
$$;

revoke execute on function public.sync_last_sign_in() from public, anon, authenticated;

drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in
  after update of last_sign_in_at on auth.users
  for each row
  when (old.last_sign_in_at is distinct from new.last_sign_in_at)
  execute function public.sync_last_sign_in();
