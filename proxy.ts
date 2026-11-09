import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { BUDGET_TRACKER_ENABLED } from '@/lib/feature-flags';

const BUDGET_TRACKER_PATHS = ['/', '/transactions', '/add', '/reports', '/budgets', '/profile', '/afford'];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const isAuthPage = request.nextUrl.pathname.startsWith('/login');

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    if (user && isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = BUDGET_TRACKER_ENABLED ? '/' : '/project-hours';
      return NextResponse.redirect(url);
    }

    // Redirect Budget Tracker routes to Project Hours when the flag is off
    if (user && !BUDGET_TRACKER_ENABLED) {
      const isBudgetPath =
        BUDGET_TRACKER_PATHS.includes(pathname) || pathname.startsWith('/transactions/');
      if (isBudgetPath) {
        const url = request.nextUrl.clone();
        url.pathname = '/project-hours';
        return NextResponse.redirect(url);
      }
    }

  } catch (e) {
    // Auth check failed — deny by default (fail-closed).
    console.error(JSON.stringify({
      event: 'proxy_auth_error',
      path: request.nextUrl.pathname,
      ts: new Date().toISOString(),
      error: e instanceof Error ? e.message : 'unknown',
    }));
    if (!isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
