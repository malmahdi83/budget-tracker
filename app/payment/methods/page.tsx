'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type PaymentMethod = {
  PaymentMethodId: number;
  PaymentMethodEn: string;
  PaymentMethodAr: string;
  ImageUrl: string;
  TotalAmount: number;
  CurrencyIso: string;
  ServiceCharge: number;
};

export default function PaymentMethodsPage() {
  const router = useRouter();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState<number | null>(null);

  useEffect(() => {
    supabase.functions.invoke('checkout-methods')
      .then(({ data, error }) => {
        if (error || data?.error) { setError(data?.error ?? error?.message ?? 'Failed to load methods'); }
        else { setMethods(data.methods ?? []); }
        setLoading(false);
      })
      .catch(() => { setError('Failed to load payment methods.'); setLoading(false); });
  }, []);

  const ALLOWED_PAYMENT_HOSTS = ['apitest.myfatoorah.com', 'api.myfatoorah.com'];

  const isSafePaymentUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && ALLOWED_PAYMENT_HOSTS.includes(parsed.hostname);
    } catch {
      return false;
    }
  };

  const isSafeImageUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && parsed.hostname.endsWith('myfatoorah.com');
    } catch {
      return false;
    }
  };

  const handlePay = async (methodId: number) => {
    setPaying(methodId);
    try {
      const { data, error } = await supabase.functions.invoke('checkout', { body: { methodId } });
      if (error || data?.error) throw new Error('Checkout failed. Please try again.');
      if (!isSafePaymentUrl(data.paymentUrl)) throw new Error('Invalid payment URL received.');
      window.location.href = data.paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPaying(null);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 py-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Choose Payment Method</h1>
          <p className="text-slate-500 text-sm">Budget Tracker Pro — 20 KD (one-time)</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="text-indigo-400 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm text-center py-6">{error}</p>
        ) : methods.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No payment methods available.</p>
        ) : (
          methods.map((m) => (
            <button
              key={m.PaymentMethodId}
              onClick={() => handlePay(m.PaymentMethodId)}
              disabled={paying !== null}
              className="w-full flex items-center justify-between gap-4 px-4 py-4 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-xl transition-all disabled:opacity-60 group"
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {isSafeImageUrl(m.ImageUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.ImageUrl}
                    alt={m.PaymentMethodEn}
                    className="h-8 w-16 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <span className="font-medium text-slate-800 group-hover:text-indigo-700">
                  {m.PaymentMethodEn}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {m.ServiceCharge > 0 && (
                  <span className="text-xs text-slate-400">
                    +{m.ServiceCharge.toFixed(3)} KD fee
                  </span>
                )}
                <span className="font-semibold text-slate-900">
                  {m.TotalAmount.toFixed(3)} {m.CurrencyIso}
                </span>
                {paying === m.PaymentMethodId && (
                  <Loader2 size={16} className="text-indigo-500 animate-spin" />
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <p className="text-center text-xs text-slate-400">
        Secured by MyFatoorah. You will be redirected to complete your payment.
      </p>
    </div>
  );
}
