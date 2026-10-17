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
