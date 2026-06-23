'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function useIsPro() {
  const { user } = useAuth();
  return user?.user_metadata?.is_pro === true;
}

export default function ProGate({
  children,
  feature,
  compact = false,
}: {
  children: React.ReactNode;
  feature?: string;
  compact?: boolean;
}) {
  const isPro = useIsPro();
  if (isPro) return <>{children}</>;

  if (compact) {
    return (
      <Link
        href="/payment/methods"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors"
      >
        <Lock size={12} />
        Pro only
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
        <Lock size={24} className="text-indigo-500" />
      </div>
      <div>
        <p className="font-semibold text-slate-900 text-lg">
          {feature ?? 'This feature'} is Pro-only
        </p>
        <p className="text-slate-500 text-sm mt-1">Upgrade once for lifetime access — 20 KD</p>
      </div>
      <Link
        href="/payment/methods"
        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
      >
        <Sparkles size={15} />
        Upgrade to Pro
      </Link>
    </div>
  );
}
