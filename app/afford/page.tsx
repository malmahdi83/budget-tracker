'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { CheckCircle, XCircle, AlertCircle, Calculator } from 'lucide-react';
import Link from 'next/link';

type Profile = { monthly_salary: number; monthly_loans: number; savings: number };

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KWD' }).format(n);
}

type Result = {
  status: 'yes' | 'savings' | 'save-up' | 'no-profile';
  leftThisMonth: number;
  fromSavingsLeft: number;
  savingsPercent: number;
  monthsToSave: number;
};

export default function AffordPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [spentThisMonth, setSpentThisMonth] = useState(0);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!user) return;
    const thisMonth = new Date().toISOString().slice(0, 7);
    Promise.all([
      supabase.from('user_profiles').select('monthly_salary, monthly_loans, savings').eq('user_id', user.id).single(),
      supabase.from('transactions').select('amount').eq('user_id', user.id).gte('date', `${thisMonth}-01`),
    ]).then(([profileRes, txRes]) => {
      if (profileRes.data) setProfile(profileRes.data);
      const spent = (txRes.data ?? []).reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
      setSpentThisMonth(spent);
    });
  }, [user]);

  const check = () => {
    const price = parseFloat(itemPrice);
    if (!price || price <= 0) return;

    if (!profile || profile.monthly_salary === 0) {
      setResult({ status: 'no-profile', leftThisMonth: 0, fromSavingsLeft: 0, savingsPercent: 0, monthsToSave: 0 });
      return;
    }

    const leftThisMonth = profile.monthly_salary - profile.monthly_loans - spentThisMonth;
    const fromSavingsLeft = profile.savings - price;
    const savingsPercent = profile.savings > 0 ? (price / profile.savings) * 100 : 0;
    const monthlyLeftover = profile.monthly_salary - profile.monthly_loans;
    const monthsToSave = monthlyLeftover > 0 ? Math.ceil(price / monthlyLeftover) : 0;

    if (price <= leftThisMonth) {
      setResult({ status: 'yes', leftThisMonth, fromSavingsLeft, savingsPercent, monthsToSave });
    } else if (price <= profile.savings) {
      setResult({ status: 'savings', leftThisMonth, fromSavingsLeft, savingsPercent, monthsToSave });
    } else {
      setResult({ status: 'save-up', leftThisMonth, fromSavingsLeft, savingsPercent, monthsToSave });
    }
  };

  // Gate render until auth resolves — prevents stale result state flashing across sessions
  if (loading) return <div className="space-y-4 animate-pulse max-w-lg"><div className="h-8 w-48 bg-slate-200 rounded-lg" /><div className="h-48 bg-slate-200 rounded-2xl" /></div>;
  if (!user) return null;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('afford.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('afford.subtitle')}</p>
      </div>

      {/* Input card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t('afford.itemName')}</label>
          <input
            type="text"
            placeholder={t('afford.itemPlaceholder')}
            maxLength={100}
            value={itemName}
            onChange={(e) => { setItemName(e.target.value); setResult(null); }}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t('afford.price')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">KD</span>
            <input
              type="number"
              min="0"
              max="999999"
              step="0.001"
              placeholder="0.000"
              value={itemPrice}
              onChange={(e) => { setItemPrice(e.target.value); setResult(null); }}
              onKeyDown={(e) => e.key === 'Enter' && check()}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <button
          onClick={check}
          disabled={!itemPrice || parseFloat(itemPrice) <= 0}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40"
        >
          <Calculator size={16} />
          {t('afford.check')}
        </button>
      </div>

      {/* Result card */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          {result.status === 'no-profile' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle size={36} className="text-amber-400" />
              <p className="font-semibold text-slate-800">{t('afford.noProfile')}</p>
              <p className="text-sm text-slate-500">{t('afford.noProfileMsg')}</p>
              <Link href="/profile" className="mt-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                {t('afford.goToProfile')}
              </Link>
            </div>
          )}

          {result.status === 'yes' && (
            <>
              <div className="flex items-center gap-3">
                <CheckCircle size={28} className="text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-800">{t('afford.yes', (itemName || t('afford.thisItem')).replace(/[<>&"']/g, ''))}</p>
                  <p className="text-sm text-slate-500">{t('afford.yesMsg')}</p>
                </div>
              </div>
              <ResultRow label={t('afford.leftThisMonth')} value={fmt(result.leftThisMonth)} color="text-emerald-600" />
              <ResultRow label={t('afford.afterPurchase')} value={fmt(result.leftThisMonth - parseFloat(itemPrice))} color="text-slate-700" />
            </>
          )}

          {result.status === 'savings' && (
            <>
              <div className="flex items-center gap-3">
                <AlertCircle size={28} className="text-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-800">{t('afford.fromSavings', (itemName || t('afford.thisItem')).replace(/[<>&"']/g, ''))}</p>
                  <p className="text-sm text-slate-500">{t('afford.fromSavingsMsg')}</p>
                </div>
              </div>
              <ResultRow label={t('afford.leftThisMonth')} value={fmt(result.leftThisMonth)} color="text-slate-600" />
              <ResultRow label={t('afford.savingsAfter')} value={fmt(result.fromSavingsLeft)} color={result.fromSavingsLeft >= 0 ? 'text-emerald-600' : 'text-red-500'} />
              <ResultRow label={t('afford.savingsUsed')} value={`${result.savingsPercent.toFixed(1)}%`} color="text-amber-600" />
            </>
          )}

          {result.status === 'save-up' && (
            <>
              <div className="flex items-center gap-3">
                <XCircle size={28} className="text-red-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-800">{t('afford.no', (itemName || t('afford.thisItem')).replace(/[<>&"']/g, ''))}</p>
                  <p className="text-sm text-slate-500">{t('afford.noMsg')}</p>
                </div>
              </div>
              <ResultRow label={t('afford.leftThisMonth')} value={fmt(result.leftThisMonth)} color="text-red-500" />
              <ResultRow label={t('afford.currentSavings')} value={fmt(profile!.savings)} color="text-slate-600" />
              {result.monthsToSave > 0 && (
                <ResultRow label={t('afford.saveUpIn')} value={`${result.monthsToSave} ${t('afford.months')}`} color="text-indigo-600" />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-slate-50">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}
