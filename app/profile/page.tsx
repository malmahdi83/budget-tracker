'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Save, User, Wallet, TrendingDown, PiggyBank } from 'lucide-react';

type Profile = {
  monthly_salary: number;
  monthly_loans: number;
  savings: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KWD' }).format(n);
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile>({ monthly_salary: 0, monthly_loans: 0, savings: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_profiles')
      .select('monthly_salary, monthly_loans, savings')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError('');
    const { error } = await supabase.from('user_profiles').upsert({
      user_id: user.id,
      monthly_salary: profile.monthly_salary,
      monthly_loans: profile.monthly_loans,
      savings: profile.savings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      setSaveError('Could not save profile. Please try again.');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const disposable = profile.monthly_salary - profile.monthly_loans;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-lg">
        <div className="h-8 w-48 bg-slate-200 rounded-lg" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('profile.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('profile.subtitle')}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">

        {/* Monthly Salary */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Wallet size={14} className="text-emerald-600" />
            </div>
            {t('profile.salary')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">KD</span>
            <input
              type="number"
              min="0"
              max="10000000"
              step="0.001"
              autoComplete="off"
              value={profile.monthly_salary || ''}
              onChange={(e) => setProfile((p) => ({ ...p, monthly_salary: parseFloat(e.target.value) || 0 }))}
              placeholder="0.000"
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Monthly Loans / Obligations */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
              <TrendingDown size={14} className="text-red-500" />
            </div>
            {t('profile.loans')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">KD</span>
            <input
              type="number"
              min="0"
              max="10000000"
              step="0.001"
              autoComplete="off"
              value={profile.monthly_loans || ''}
              onChange={(e) => setProfile((p) => ({ ...p, monthly_loans: parseFloat(e.target.value) || 0 }))}
              placeholder="0.000"
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{t('profile.loansHint')}</p>
        </div>

        {/* Savings */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <PiggyBank size={14} className="text-indigo-600" />
            </div>
            {t('profile.savings')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">KD</span>
            <input
              type="number"
              min="0"
              max="10000000"
              step="0.001"
              autoComplete="off"
              value={profile.savings || ''}
              onChange={(e) => setProfile((p) => ({ ...p, savings: parseFloat(e.target.value) || 0 }))}
              placeholder="0.000"
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Summary */}
        {profile.monthly_salary > 0 && (
          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-slate-500">{t('profile.disposable')}</span>
            <span className={`font-semibold text-sm ${disposable >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmt(disposable)}
            </span>
          </div>
        )}

        {saveError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {saveError}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? t('profile.saving') : saved ? t('profile.saved') : t('profile.save')}
        </button>
      </div>
    </div>
  );
}
