import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { avatarPublicUrl } from '@/lib/avatar';
import { createAdminClient } from '@/lib/supabase/admin';
import { UsersTable, type UserRow, type StatusFilter, type SortKey } from '@/components/admin/users-table';

export const metadata: Metadata = { title: 'Usuários' };
export const dynamic = 'force-dynamic';

const PAGE_SIZES = [10, 25, 50];
const SORT_KEYS: SortKey[] = ['name', 'role', 'created_at', 'last_sign_in_at', 'is_active'];

interface SearchParams {
  page?: string;
  size?: string;
  q?: string;
  status?: string;
  sort?: string;
  dir?: string;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireAdmin();
  const sp = await searchParams;

  const pageSize = PAGE_SIZES.includes(Number(sp.size)) ? Number(sp.size) : 10;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const status: StatusFilter = sp.status === 'active' || sp.status === 'inactive' ? sp.status : 'all';
  // sem ?sort= vale a ordem padrão (cadastro, mais recente primeiro)
  const sort: SortKey | null = SORT_KEYS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : null;
  const dir: 'asc' | 'desc' = sp.dir === 'desc' ? 'desc' : 'asc';
  // remove caracteres que têm significado na sintaxe de filtros do PostgREST
  const q = (sp.q ?? '').replace(/[,()"\\%*]/g, ' ').trim().slice(0, 80);

  const admin = createAdminClient();

  let query = admin
    .from('profiles')
    .select('id, name, email, role, is_active, created_at, last_sign_in_at, avatar_path', { count: 'exact' })
    .order(sort ?? 'created_at', { ascending: sort ? dir === 'asc' : false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
  if (status !== 'all') query = query.eq('is_active', status === 'active');

  const { data: profiles, count, error } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (page > pages) {
    // página fora do intervalo (ex.: filtro mudou): vai para a última
    const params = new URLSearchParams();
    if (pages > 1) params.set('page', String(pages));
    if (pageSize !== 10) params.set('size', String(pageSize));
    if (q) params.set('q', q);
    if (status !== 'all') params.set('status', status);
    if (sort) {
      params.set('sort', sort);
      params.set('dir', dir);
    }
    const qs = params.toString();
    redirect(`/admin/usuarios${qs ? `?${qs}` : ''}`);
  }

  const rows: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    is_active: p.is_active,
    created_at: p.created_at,
    last_sign_in_at: p.last_sign_in_at,
    avatar_url: avatarPublicUrl(p.avatar_path),
  }));

  return (
    <UsersTable
      users={rows}
      currentUserId={me.id}
      total={total}
      page={page}
      pageSize={pageSize}
      q={q}
      status={status}
      sort={sort}
      dir={dir}
    />
  );
}
