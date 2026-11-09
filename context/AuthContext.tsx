'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-browser';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // getUser() verifies the token server-side; getSession() only reads localStorage unverified
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (!user) setSession(null); // clear stale unverified session if server says no user
      setLoading(false);
    });
    // Keep session for token access (e.g. edge function calls)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Idle session timeout — sign out after 30 min of no user activity
  useEffect(() => {
    if (!user) return;
    let idleTimer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { supabase.auth.signOut(); }, IDLE_TIMEOUT_MS);
    };
    const events = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
