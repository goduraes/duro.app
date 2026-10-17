import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente com a SERVICE ROLE KEY — ignora o RLS.
 * `server-only` faz o build falhar se este arquivo for importado por código do navegador.
 * Só use depois de confirmar que quem chamou é admin.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
