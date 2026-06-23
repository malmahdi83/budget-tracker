'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentId = searchParams.get('paymentId');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!paymentId) {
      setErrorMsg('No payment ID found in the URL.');
      setStatus('error');
      return;
    }

    supabase.functions.invoke('verify-payment', { body: { paymentId } })
      .then(({ data, error }) => {
        if (data?.success) {
          setStatus('success');
          setTimeout(() => router.refresh(), 1500);
        } else {
          setErrorMsg(data?.error ?? error?.message ?? 'Verification failed.');
          setStatus('error');
        }
      })
      .catch(() => {
        setErrorMsg('Network error during verification.');
        setStatus('error');
      });
  }, [paymentId, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 max-w-md w-full text-center space-y-5">
        {status === 'verifying' && (
          <>
            <Loader2 size={48} className="mx-auto text-indigo-500 animate-spin" />
            <h1 className="text-xl font-bold text-slate-900">Verifying your payment…</h1>
            <p className="text-slate-500 text-sm">Please wait, this only takes a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
            <h1 className="text-2xl font-bold text-slate-900">You're now Pro!</h1>
            <p className="text-slate-500 text-sm">
              Your payment of <strong>20 KD</strong> was confirmed. Your account has been upgraded.
            </p>
            <Link
              href="/"
              className="inline-block mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go to Dashboard
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={56} className="mx-auto text-red-400" />
            <h1 className="text-xl font-bold text-slate-900">Verification Failed</h1>
            <p className="text-slate-500 text-sm">{errorMsg}</p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/"
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
