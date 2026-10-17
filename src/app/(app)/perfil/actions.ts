'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { profileSchema } from '@/lib/schemas';
import type { ActionResult } from '@/lib/types';

/**
 * Atualiza o nome do próprio usuário. `profiles` não tem policy de UPDATE (para ninguém
 * mexer em papel/status pelo navegador), então a escrita usa a service role — sempre
 * restrita ao id da sessão, nunca a um id vindo do cliente.
 */
export async function updateProfileName(input: { name: string }): Promise<ActionResult> {
  try {
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Nome inválido' };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Não autenticado' };

    const admin = createAdminClient();
    const { error } = await admin
      .from('profiles')
      .update({ name: parsed.data.name })
      .eq('id', user.id)
      .eq('is_active', true);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro inesperado' };
  }
}

const AVATAR_BUCKET = 'avatars';

/** Usuário da sessão ou null. O id nunca vem do cliente. */
async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Registra a foto de perfil já enviada ao Storage pelo navegador (na pasta do próprio usuário) e
 * apaga as fotos anteriores. Confere o caminho e se o arquivo existe antes de salvar.
 */
export async function saveAvatar(path: string): Promise<ActionResult> {
  try {
    const userId = await sessionUserId();
    if (!userId) return { ok: false, error: 'Não autenticado' };
    if (!new RegExp(`^${userId}/avatar-\\d+\\.jpg$`).test(path)) return { ok: false, error: 'Caminho da foto inválido.' };

    const admin = createAdminClient();
    const { data: files, error: listError } = await admin.storage.from(AVATAR_BUCKET).list(userId);
    if (listError) return { ok: false, error: listError.message };
    const fileName = path.slice(userId.length + 1);
    if (!(files ?? []).some((f) => f.name === fileName)) return { ok: false, error: 'A foto enviada não foi encontrada.' };

    const { error } = await admin
      .from('profiles')
      .update({ avatar_path: path })
      .eq('id', userId)
      .eq('is_active', true);
    if (error) return { ok: false, error: error.message };

    // Fotos antigas deixam de ocupar espaço
    const old = (files ?? []).filter((f) => f.name !== fileName).map((f) => `${userId}/${f.name}`);
    if (old.length > 0) await admin.storage.from(AVATAR_BUCKET).remove(old);

    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro inesperado' };
  }
}

/** Remove a foto de perfil (volta a aparecer a inicial do nome). */
export async function removeAvatar(): Promise<ActionResult> {
  try {
    const userId = await sessionUserId();
    if (!userId) return { ok: false, error: 'Não autenticado' };

    const admin = createAdminClient();
    const { error } = await admin.from('profiles').update({ avatar_path: null }).eq('id', userId);
    if (error) return { ok: false, error: error.message };

    const { data: files } = await admin.storage.from(AVATAR_BUCKET).list(userId);
    const all = (files ?? []).map((f) => `${userId}/${f.name}`);
    if (all.length > 0) await admin.storage.from(AVATAR_BUCKET).remove(all);

    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro inesperado' };
  }
}
