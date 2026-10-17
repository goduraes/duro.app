import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Recebe o link enviado por e-mail (PKCE), troca o código por sessão e segue para `next`. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  // evita open redirect: só caminhos internos
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }

  const failure = safeNext === '/redefinir-senha' ? '/esqueci-senha' : '/login';
  return NextResponse.redirect(`${origin}${failure}?erro=link`);
}
