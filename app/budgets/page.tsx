'use client';

import { useEffect, useState } from 'react';
import { supabase, CATEGORIES, CATEGORY_COLORS } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Save, Trash2, AlertTriangle } from 'lucide-react';

type Limit = { id: string; category: string; monthly_limit: number };

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KWD' }).format(n);
}

export default function BudgetsPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('budgets.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('budgets.subtitle')}</p>
      </div>
      <BudgetsContent />
    </div>
  );
}

function BudgetsContent() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [limits, setLimits] = useState<Limit[]>([]);
  const [spending, setSpending] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const thisMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('budget_limits').select('*').eq('user_id', user.id),
      supabase.from('transactions').select('category, amount').eq('user_id', user.id).gte('date', `${thisMonth}-01`),
    ]).then(([limitsRes, txRes]) => {
      setLimits(limitsRes.data ?? []);
      const sp: Record<string, number> = {};
      (txRes.data ?? []).forEach((tx) => {
        sp[tx.category] = (sp[tx.category] ?? 0) + Number(tx.amount);
      });
      setSpending(sp);
      setLoading(false);
    });
  }, [user, thisMonth]);

  const getLimit = (cat: string) => limits.find((l) => l.category === cat);
  const getDraft = (cat: string) => drafts[cat] ?? String(getLimit(cat)?.monthly_limit ?? '');

  const handleSave = async (category: string) => {
    if (!user) return;
    const val = parseFloat(getDraft(category));
    if (!val || val <= 0) return;
    setSaving(category);
    const existing = getLimit(category);
    if (existing) {
      await supabase.from('budget_limits').update({ monthly_limit: val }).eq('id', existing.id).eq('user_id', user!.id);
      setLimits((prev) => prev.map((l) => l.category === category ? { ...l, monthly_limit: val } : l));
    } else {
      const { data } = await supabase.from('budget_limits').insert({ user_id: user.id, category, monthly_limit: val }).select().single();
      if (data) setLimits((prev) => [...prev, data]);
    }
    setDrafts((d) => { const n = { ...d }; delete n[category]; return n; });
    setSaving(null);
  };

  const handleDelete = async (category: string) => {
    const existing = getLimit(category);
    if (!existing) return;
    await supabase.from('budget_limits').delete().eq('id', existing.id).eq('user_id', user!.id);
    setLimits((prev) => prev.filter((l) => l.category !== category));
    setDrafts((d) => { const n = { ...d }; delete n[category]; return n; });
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {CATEGORIES.map((cat) => {
        const limit = getLimit(cat);
        const spent = spending[cat] ?? 0;
        const limitVal = limit?.monthly_limit ?? 0;
        const pct = limitVal > 0 ? Math.min((spent / limitVal) * 100, 100) : 0;
        const overBudget = limitVal > 0 && spent > limitVal;
        const nearBudget = limitVal > 0 && !overBudget && pct >= 80;
        const color = CATEGORY_COLORS[cat] ?? '#6b7280';
        const draft = getDraft(cat);
        const isDirty = draft !== String(limitVal || '');

        return (
          <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-medium text-slate-800 text-sm">{cat}</span>
                  {overBudget && (
                    <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={11} /> {t('budgets.overBudget')}
                    </span>
                  )}
                  {nearBudget && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={11} /> {pct.toFixed(0)}{t('budgets.used')}
                    </span>
                  )}
                </div>
                {limitVal > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{fmt(spent)} {t('budgets.spent')}</span>
                      <span>{fmt(limitVal)} {t('budgets.limit')}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: overBudget ? '#ef4444' : nearBudget ? '#f59e0b' : color }}
                      />
                    </div>
                  </>
                )}
                {!limitVal && (
                  <p className="text-xs text-slate-400">{t('budgets.noLimit')} — {fmt(spent)} {t('budgets.spentThisMonth')}</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">KD</span>
                  <input
                    type="number"
                    min="1"
                    max="10000000"
                    step="1"
                    placeholder={t('budgets.setLimit')}
                    value={draft}
                    onChange={(e) => setDrafts((d) => ({ ...d, [cat]: e.target.value }))}
                    className="pl-9 pr-3 py-2 w-36 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={() => handleSave(cat)}
                  disabled={saving === cat || !isDirty || !draft}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-40"
                  title={t('general.save')}
                >
                  <Save size={16} />
                </button>
                {limit && (
                  <button
                    onClick={() => handleDelete(cat)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
