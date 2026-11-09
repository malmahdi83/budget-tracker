'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, Transaction, CATEGORY_COLORS, getSignedAttachmentUrl } from '@/lib/supabase';
import StatCard from '@/components/StatCard';
import CategoryBadge from '@/components/CategoryBadge';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { DollarSign, TrendingUp, ShoppingBag, Calendar, ArrowRight, AlertTriangle, Paperclip, FileText } from 'lucide-react';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgetLimits, setBudgetLimits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvedAttachmentUrls, setResolvedAttachmentUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      const [txRes, limitsRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user?.id).order('date', { ascending: false }),
        user ? supabase.from('budget_limits').select('category, monthly_limit').eq('user_id', user.id) : Promise.resolve({ data: [] }),
      ]);
      if (txRes.error) setError('Could not load transactions. Please try again.');
      else setTransactions(txRes.data ?? []);
      const lm: Record<string, number> = {};
      (limitsRes.data ?? []).forEach((l: { category: string; monthly_limit: number }) => { lm[l.category] = l.monthly_limit; });
      setBudgetLimits(lm);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // Resolve signed URLs for transactions that have attachments
  useEffect(() => {
    const withAttachments = transactions.filter((tx) => tx.attachment_url);
    if (!withAttachments.length) return;
    Promise.all(
      withAttachments.map((tx) =>
        getSignedAttachmentUrl(tx.attachment_url!).then((url) => ({ id: tx.id, url }))
      )
    ).then((results) => {
      const map: Record<string, string> = {};
      results.forEach((r) => { if (r.url) map[r.id] = r.url; });
      setResolvedAttachmentUrls(map);
    });
  }, [transactions]);

  const totalExpenses = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyExpenses = transactions
    .filter((tx) => tx.date.startsWith(thisMonth))
    .reduce((s, tx) => s + Number(tx.amount), 0);

  const categoryTotals = transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.category] = (acc[tx.category] ?? 0) + Number(tx.amount);
    return acc;
  }, {});

  const pieData = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const recent = transactions.slice(0, 5);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KWD' }).format(n);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} t={t} />;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.totalExpenses')}
          value={fmt(totalExpenses)}
          subtitle={`${transactions.length} ${t('dashboard.transactions')}`}
          icon={<DollarSign size={20} className="text-indigo-600" />}
          color="bg-indigo-50"
        />
        <StatCard
          title={t('dashboard.thisMonth')}
          value={fmt(monthlyExpenses)}
          subtitle={new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
          icon={<Calendar size={20} className="text-emerald-600" />}
          color="bg-emerald-50"
        />
        <StatCard
          title={t('dashboard.categories')}
          value={String(Object.keys(categoryTotals).length)}
          subtitle={t('dashboard.spendingCategories')}
          icon={<ShoppingBag size={20} className="text-amber-600" />}
          color="bg-amber-50"
        />
        <StatCard
          title={t('dashboard.avgTransaction')}
          value={transactions.length ? fmt(totalExpenses / transactions.length) : '$0'}
          subtitle={t('dashboard.perTransaction')}
          icon={<TrendingUp size={20} className="text-pink-600" />}
          color="bg-pink-50"
        />
      </div>

      {/* Charts + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-4">{t('dashboard.spendingByCategory')}</h2>
          {pieData.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-12">{t('dashboard.noData')}</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={2}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {pieData.slice(0, 7).map(({ name, value }) => (
                  <div key={name} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[name] ?? '#6b7280' }}
                      />
                      <span className="text-slate-600 truncate">{name}</span>
                    </div>
                    <span className="font-medium text-slate-900 flex-shrink-0">{fmt(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">{t('dashboard.recentTransactions')}</h2>
            <Link href="/transactions" className="text-indigo-600 text-sm hover:underline flex items-center gap-1">
              {t('dashboard.viewAll')} <ArrowRight size={14} />
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-12">{t('dashboard.noTransactions')}</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {recent.map((tx) => (
                <div key={tx.id} className="py-3 gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{tx.merchant}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <CategoryBadge category={tx.category} />
                        <span className="text-xs text-slate-400">{tx.date}</span>
                      </div>
                    </div>
                    <span className="font-semibold text-slate-900 text-sm flex-shrink-0">{fmt(Number(tx.amount))}</span>
                  </div>
                  {(tx.notes || tx.attachment_url) && (
                    <div className="mt-1.5 flex items-center gap-3 pl-0.5">
                      {tx.notes && (
                        <p className="text-xs text-slate-400 truncate flex-1">{tx.notes}</p>
                      )}
                      {resolvedAttachmentUrls[tx.id] && (
                        <a href={resolvedAttachmentUrls[tx.id]} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-indigo-500 hover:underline flex-shrink-0">
                          {resolvedAttachmentUrls[tx.id].includes('.pdf')
                            ? <FileText size={11} />
                            : <Paperclip size={11} />}
                          {t('dashboard.attachment')}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">{t('dashboard.categoryBreakdown')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="pb-3 font-medium">{t('tx.category')}</th>
                <th className="pb-3 font-medium text-right">{t('dashboard.totalSpent')}</th>
                <th className="pb-3 font-medium text-right">{t('dashboard.transactions')}</th>
                <th className="pb-3 font-medium text-right">{t('dashboard.pctOfTotal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pieData.map(({ name, value }) => {
                const count = transactions.filter((tx) => tx.category === name).length;
                const pct = totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : '0';
                const limit = budgetLimits[name];
                const thisMonthSpent = transactions
                  .filter((tx) => tx.category === name && tx.date.startsWith(new Date().toISOString().slice(0, 7)))
                  .reduce((s, tx) => s + Number(tx.amount), 0);
                const budgetPct = limit ? (thisMonthSpent / limit) * 100 : 0;
                const overBudget = limit && thisMonthSpent > limit;
                const nearBudget = limit && !overBudget && budgetPct >= 80;
                return (
                  <tr key={name}>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <CategoryBadge category={name} />
                        {overBudget && <span title={t('dashboard.overBudget')}><AlertTriangle size={13} className="text-red-500" /></span>}
                        {nearBudget && <span title={`${budgetPct.toFixed(0)}% ${t('budgets.used')}`}><AlertTriangle size={13} className="text-amber-500" /></span>}
                      </div>
                    </td>
                    <td className="py-3 text-right font-medium text-slate-900">{fmt(value)}</td>
                    <td className="py-3 text-right text-slate-500">{count}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[name] ?? '#6b7280' }}
                          />
                        </div>
                        <span className="text-slate-600 w-10 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-200 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 bg-slate-200 rounded-2xl" />
        <div className="h-72 bg-slate-200 rounded-2xl" />
      </div>
    </div>
  );
}

function ErrorState({ message, t }: { message: string; t: (k: Parameters<ReturnType<typeof import('@/lib/translations').getT>>[0], ...args: unknown[]) => string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
      <p className="text-red-700 font-medium">{t('general.error')}</p>
      <p className="text-red-500 text-sm mt-1">{message}</p>
    </div>
  );
}
