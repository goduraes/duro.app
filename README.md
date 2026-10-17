# Duro.app

Controle financeiro pessoal: **transações**, **tags** para categorizar e um **dashboard** com a visão consolidada.
Dois níveis de acesso: `common` (usuário) e `admin` (que gerencia os logins: lista, ativa/desativa e altera papel).

**Stack:** Next.js 16 (App Router) · TypeScript · Mantine 9 · TanStack Query · Zod · Supabase (Auth + Postgres + RLS)

## Como rodar localmente

Pré-requisitos: Node 20+ e Docker (o Supabase local roda em containers).

```bash
npm install

# 1. sobe Postgres + Auth + API + Studio locais.
#    Na primeira vez aplica supabase/migrations e supabase/seed.sql sozinho.
npm run sb:start

# 2. copie as chaves exibidas (ou rode `npm run sb:status`) para o .env.local
cp .env.example .env.local
#    NEXT_PUBLIC_SUPABASE_URL       -> API URL (http://127.0.0.1:54321)
#    NEXT_PUBLIC_SUPABASE_ANON_KEY  -> anon / publishable key
#    SUPABASE_SERVICE_ROLE_KEY      -> service_role / secret key

# 3. app
npm run dev        # http://localhost:3000
```

Logins criados pelo seed (**só local**):

| E-mail | Senha | Papel |
|---|---|---|
| `admin@duro.app` | `admin123456` | admin |
| `usuario@duro.app` | `usuario123456` | common (com tags e ~20 transações de exemplo) |

O cadastro é aberto: qualquer pessoa cria conta em `/cadastro` e entra como `common`.

Recriar o banco do zero (migrations + seed): `npm run sb:reset`.
Aplicar só migrations novas, **sem apagar dados**: `npx supabase migration up`.
Studio (painel do banco): http://127.0.0.1:54323

## Como funciona

```
Navegador ──supabase-js──▶ Supabase (RLS)      transações, tags, dashboard (RPC), login
Navegador ──Server Action─▶ Next.js ─▶ Supabase Admin API   só /admin/usuarios
```

- **Não há API própria para CRUD.** O front fala direto com o Supabase e o **RLS** garante que cada usuário só vê o que é seu.
- **Dinheiro em centavos** (`amount_cents integer`). Formatação em `src/lib/money.ts`.
- **Dashboard** vem de funções SQL (`dashboard_summary`, `dashboard_by_tag`, `dashboard_series`): a soma roda no banco.
  A série temporal é **por dia** para períodos de até ~2 meses e **por mês** para períodos maiores.
  Uma transação com várias tags conta integralmente em cada tag; sem tag aparece como "Sem tag".
- **`save_transaction`** (RPC) cria/edita a transação e suas tags de forma atômica.
- **Admin NÃO vê transações nem tags de outros usuários** (decisão de privacidade/LGPD): só gerencia contas.

### Desativar usuário
`setUserActive` (`src/app/(app)/admin/usuarios/actions.ts`) faz duas coisas:
1. `profiles.is_active = false` — o RLS passa a negar tudo imediatamente, mesmo com token ainda válido;
2. bane o usuário no Auth (`ban_duration`) — impede novo login e renovação de sessão.

O `src/proxy.ts` também derruba a sessão de quem está desativado na próxima navegação.
Regras: o admin não desativa nem rebaixa a si mesmo, e o último admin ativo não pode ser desativado/rebaixado.

### Segurança — leia antes de publicar
- `SUPABASE_SERVICE_ROLE_KEY` ignora o RLS. Fica **só no servidor** (`src/lib/supabase/admin.ts` usa `server-only`) e nunca recebe prefixo `NEXT_PUBLIC_`. `.env.local` está no `.gitignore`.
- O `proxy.ts` é só a primeira barreira (UX). A segurança real está no RLS (`supabase/migrations`) e na checagem de admin dentro das Server Actions.
- `profiles` não tem policy de UPDATE: ninguém consegue se promover a admin pelo cliente. Papel e status só mudam via Server Action com service role.
- O papel de novos usuários é sempre `common` (trigger `handle_new_user`); nunca vem de metadados enviados pelo cliente.

## Publicar (produção)

1. Crie um projeto no Supabase e vincule: `npx supabase login` → `npx supabase link --project-ref <ref>`
2. Envie o schema: `npx supabase db push` (**não** rode o `seed.sql` em produção — as senhas dele são públicas).
3. No painel: *Authentication → Providers → Email*: defina o mínimo de senha (8) e decida sobre confirmação de e-mail. Em *URL Configuration*, ajuste *Site URL* para o domínio do app.
4. Primeiro admin: crie sua conta normalmente em `/cadastro` e promova **uma única vez** no SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'voce@exemplo.com';
   ```
5. Hospedagem (ex.: Vercel): configure as 3 variáveis de ambiente do `.env.example` com os valores do projeto na nuvem.

## Estrutura

```
supabase/
  config.toml
  migrations/20261015000000_init.sql   tabelas, RLS, grants, RPCs
  seed.sql                             admin + usuário de exemplo (só local)
src/
  proxy.ts                             renova sessão e protege rotas (Next 16)
  lib/supabase/{client,server,admin,session}.ts
  lib/{auth,money,schemas,types}.ts
  app/(public)/{login,cadastro}
  app/(app)/{dashboard,transacoes,tags,admin/usuarios}
  components/                          telas e formulários (Mantine)
```

## Próximos passos sugeridos
- Gerar tipos do banco: `npx supabase gen types typescript --local > src/lib/database.types.ts` e passar `Database` para `createClient`.
- Recuperação de senha (`supabase.auth.resetPasswordForEmail`).
- Importação de extratos (OFX/CSV), transações recorrentes, orçamento por tag.
- Testes (Vitest para utilitários, Playwright para fluxos de login/admin).
