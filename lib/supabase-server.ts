import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        sameSite: 'lax',
        // COOKIE_SECURE=true lets staging/preview envs enforce secure cookies without NODE_ENV=production
        secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
        httpOnly: true,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[supabase-server] Failed to set cookies (expected in Server Components):', e);
            }
          }
        },
      },
    }
  );
}
