import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/cadastro', '/esqueci-senha'];

/**
 * Renova a sessão e aplica as regras de acesso de rota:
 *  - sem login            → /login
 *  - conta desativada     → encerra a sessão e vai para /login?erro=desativado
 *  - logado em /login     → /dashboard
 *  - /admin sem ser admin → /dashboard
 *
 * Isto é só UX/primeira barreira. A segurança real está no RLS e nas Server Actions.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  const redirect = (pathname: string, search = '') => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirected = NextResponse.redirect(url);
    // preserva cookies de sessão (renovados ou removidos) e headers de cache
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('cache-control') || key.toLowerCase() === 'expires' || key.toLowerCase() === 'pragma') {
        redirected.headers.set(key, value);
      }
    });
    return redirected;
  };

  const { pathname } = request.nextUrl;
  // Callback dos links enviados por e-mail: troca o código por sessão, não pode ser redirecionado.
  if (pathname.startsWith('/auth/')) return response;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return isPublic ? response : redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return isPublic && pathname === '/login' ? response : redirect('/login', '?erro=desativado');
  }

  if (isPublic) return redirect('/dashboard');
  if (pathname.startsWith('/admin') && profile.role !== 'admin') return redirect('/dashboard');

  return response;
}
