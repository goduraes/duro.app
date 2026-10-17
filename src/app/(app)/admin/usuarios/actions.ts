'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult, Role } from '@/lib/types';

// ~100 anos. Com `ban_duration` o Auth recusa novos tokens e refresh do usuário.
const BAN_FOREVER = '876000h';

/** Confirma, no servidor e no banco, que quem chama é um admin ativo. */
async function assertAdmin(): Promise<{ id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin' || !profile.is_active) throw new Error('Acesso negado');
  return { id: user.id };
}

/** Existe pelo menos um OUTRO admin ativo além do usuário alvo? */
async function hasOtherActiveAdmin(excludeUserId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('is_active', true)
    .neq('id', excludeUserId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : 'Erro inesperado' };
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  try {
    const me = await assertAdmin();
    const admin = createAdminClient();

    if (!active) {
      if (userId === me.id) return { ok: false, error: 'Você não pode desativar a si mesmo.' };

      const { data: target } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (target?.role === 'admin' && !(await hasOtherActiveAdmin(userId))) {
        return { ok: false, error: 'Não é possível desativar o último administrador ativo.' };
      }
    }

    // 1) Fecha o acesso aos dados imediatamente (o RLS exige is_active = true).
    const { error: profileError } = await admin.from('profiles').update({ is_active: active }).eq('id', userId);
    if (profileError) return { ok: false, error: profileError.message };

    // 2) Impede novos logins/renovação de sessão no Auth.
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? 'none' : BAN_FOREVER,
    });
    if (banError) return { ok: false, error: banError.message };

    revalidatePath('/admin/usuarios');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setUserRole(userId: string, role: Role): Promise<ActionResult> {
  try {
    if (role !== 'admin' && role !== 'common') return { ok: false, error: 'Papel inválido.' };

    const me = await assertAdmin();
    if (userId === me.id) return { ok: false, error: 'Você não pode alterar o seu próprio papel.' };

    const admin = createAdminClient();

    if (role === 'common') {
      const { data: target } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (target?.role === 'admin' && !(await hasOtherActiveAdmin(userId))) {
        return { ok: false, error: 'Não é possível rebaixar o último administrador ativo.' };
      }
    }

    const { error } = await admin.from('profiles').update({ role }).eq('id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/admin/usuarios');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
