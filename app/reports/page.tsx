'use client';

import { useEffect, useState } from 'react';
import { supabase, Transaction, CATEGORY_COLORS } from '@/lib/supabase';
import CategoryBadge from '@/components/CategoryBadge';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KWD' }).format(n);
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ReportsPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('reports.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('reports.subtitle')}</p>
      </div>
      <ReportsContent />
    </div>
  );
}

function ReportsContent() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .then(({ data }) => { setTransactions(data ?? []); setLoading(false); });
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-slate-100 rounded-2xl" />)}
      </div>
    );
  }

  const now = new Date();
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const total = transactions
      .filter((tx) => tx.date.startsWith(key))
      .reduce((s, tx) => s + Number(tx.amount), 0);
    return { month: MONTH_NAMES[d.getMonth()], total };
  });

  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;
  const yoyData = MONTH_NAMES.map((month, idx) => {
    const m = String(idx + 1).padStart(2, '0');
    const ty = transactions.filter((tx) => tx.date.startsWith(`${thisYear}-${m}`)).reduce((s, tx) => s + Number(tx.amount), 0);
    const ly = transactions.filter((tx) => tx.date.startsWith(`${lastYear}-${m}`)).reduce((s, tx) => s + Number(tx.amount), 0);
    return { month, [thisYear]: ty, [lastYear]: ly };
  });

  const merchantTotals = transactions.reduce<Record<string, { amount: number; count: number }>>((acc, tx) => {
    if (!acc[tx.merchant]) acc[tx.merchant] = { amount: 0, count: 0 };
    acc[tx.merchant].amount += Number(tx.amount);
    acc[tx.merchant].count += 1;
    return acc;
  }, {});
  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 8)
    .map(([name, { amount, count }]) => ({ name, amount, count }));

  const catTotals = transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.category] = (acc[tx.category] ?? 0) + Number(tx.amount);
    return acc;
  }, {});
  const totalAll = Object.values(catTotals).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">{t('reports.monthly')}</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={55} />
            <Tooltip formatter={(v) => fmt(Number(v))} />
            <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">{t('reports.yoy', thisYear, lastYear)}</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={yoyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={55} />
            <Tooltip formatter={(v) => fmt(Number(v))} />
            <Legend />
            <Line type="monotone" dataKey={String(thisYear)} stroke="#6366f1" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={String(lastYear)} stroke="#cbd5e1" strokeWidth={2} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-4">{t('reports.topMerchants')}</h2>
          {topMerchants.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">{t('reports.noData')}</p>
          ) : (
            <div className="space-y-3">
              {topMerchants.map(({ name, amount, count }, i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-300 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate">{name}</span>
                      <span className="text-sm font-semibold text-slate-900 flex-shrink-0">{fmt(amount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(amount / topMerchants[0].amount) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">{count} {t('reports.txn')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-4">{t('reports.categoryBreakdown')}</h2>
          {Object.keys(catTotals).length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">{t('reports.noData')}</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <CategoryBadge category={cat} />
                    <span className="text-sm font-semibold text-slate-900">{fmt(amount)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(amount / totalAll) * 100}%`, backgroundColor: CATEGORY_COLORS[cat] ?? '#6b7280' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
