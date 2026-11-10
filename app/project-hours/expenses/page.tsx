'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  PhExpenseType, PhExpensePeriod, PhDeveloperRate,
  KWD, prevMonth, currentYM,
} from '@/lib/ph-types';
import { Plus, ChevronDown, ChevronUp, Trash2, History } from 'lucide-react';

// ─── Developer Rate Section ───────────────────────────────────────────────

function RateSection({ userId }: { userId: string }) {
  const [rates, setRates] = useState<PhDeveloperRate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchRates = useCallback(async () => {
    const { data } = await supabase
      .from('ph_developer_rates')
      .select('*')
      .eq('user_id', userId)
      .order('effective_date', { ascending: false });
    setRates(data ?? []);
  }, [userId]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const handleSave = async () => {
    const r = parseFloat(rateInput);
    if (!r || r <= 0) { setError('Enter a valid rate.'); return; }
    if (!dateInput) { setError('Enter effective date.'); return; }
    setSaving(true);
    setError('');
    const { error: e } = await supabase.from('ph_developer_rates').insert({
      user_id: userId, hourly_rate: r, effective_date: dateInput,
    });
    if (e) { setError(e.message); setSaving(false); return; }
    setRateInput(''); setDateInput(''); setShowForm(false);
    await fetchRates();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rate record?')) return;
    await supabase.from('ph_developer_rates').delete().eq('id', id).eq('user_id', userId);
    setRates((p) => p.filter((r) => r.id !== id));
  };

  const current = rates[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Developer Hourly Rate</h2>
        <button
          onClick={() => { setShowForm((v) => !v); setError(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <Plus size={14} /> Add Rate
        </button>
      </div>

      {current ? (
        <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-xl">
          <div>
            <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide mb-0.5">Current Rate</p>
            <p className="text-2xl font-bold text-indigo-700">{KWD(Number(current.hourly_rate))}<span className="text-base font-normal text-indigo-400">/hr</span></p>
          </div>
          <div className="text-sm text-indigo-600">effective {current.effective_date}</div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">No rate set yet. Add a rate to enable hours logging.</p>
      )}

      {showForm && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">New rate entry</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Hourly Rate (KWD)</label>
              <input type="number" min="0.001" step="0.001" placeholder="0.000"
                value={rateInput} onChange={(e) => setRateInput(e.target.value)}
                className="w-36 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Effective Date</label>
              <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {rates.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5"><History size={12} /> Rate History</p>
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-left text-xs">
                  <th className="px-4 py-2 font-medium">Effective Date</th>
                  <th className="px-4 py-2 font-medium text-right">Rate (KWD/hr)</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rates.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-600">{r.effective_date}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">{KWD(Number(r.hourly_rate))}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => handleDelete(r.id)}
                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Single Expense Type Row ──────────────────────────────────────────────

function ExpenseRow({
  expense, userId, onDeleted,
}: { expense: PhExpenseType; userId: string; onDeleted: () => void }) {
  const [periods, setPeriods] = useState<PhExpensePeriod[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<'change' | 'end' | null>(null);
  const [month, setMonth] = useState(currentYM());
  const [newAmount, setNewAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const fetchPeriods = useCallback(async () => {
    const { data } = await supabase
      .from('ph_expense_periods')
      .select('*')
      .eq('expense_type_id', expense.id)
      .eq('user_id', userId)
      .order('start_month', { ascending: false });
    setPeriods(data ?? []);
  }, [expense.id, userId]);

  useEffect(() => { fetchPeriods(); }, [fetchPeriods]);

  const activePeriod = periods.find((p) => p.end_month === null);
  const currentAmount = activePeriod ? Number(activePeriod.amount) : null;

  const handleChangeAmount = async () => {
    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt < 0) { setErr('Enter a valid amount (0 or more).'); return; }
    if (!month) { setErr('Select a month.'); return; }
    setSaving(true); setErr('');

    if (activePeriod) {
      if (month > activePeriod.start_month) {
        // Close current period at previous month, open new one
        await supabase.from('ph_expense_periods')
          .update({ end_month: prevMonth(month) })
          .eq('id', activePeriod.id);
      } else {
        // month <= start_month: just update amount on existing period
        await supabase.from('ph_expense_periods')
          .update({ amount: amt })
          .eq('id', activePeriod.id);
        await fetchPeriods(); setSaving(false); setAction(null); setNewAmount(''); return;
      }
    }

    await supabase.from('ph_expense_periods').insert({
      expense_type_id: expense.id, user_id: userId,
      amount: amt, start_month: month, end_month: null,
    });

    await fetchPeriods(); setSaving(false); setAction(null); setNewAmount('');
  };

  const handleEndExpense = async () => {
    if (!activePeriod) return;
    if (!month) { setErr('Select the last active month.'); return; }
    if (month < activePeriod.start_month) { setErr('Cannot end before the start month.'); return; }
    setSaving(true); setErr('');
    await supabase.from('ph_expense_periods')
      .update({ end_month: month })
      .eq('id', activePeriod.id);
    await fetchPeriods(); setSaving(false); setAction(null);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete expense type "${expense.name}" and all its history?`)) return;
    await supabase.from('ph_expense_types').delete().eq('id', expense.id).eq('user_id', userId);
    onDeleted();
  };

  return (
    <div className="rounded-xl border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-medium text-slate-900 truncate">{expense.name}</span>
          {currentAmount !== null ? (
            <span className="text-sm text-slate-500">{KWD(currentAmount)}<span className="text-slate-400">/mo</span></span>
          ) : (
            <span className="text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">ended</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {currentAmount !== null && (
            <>
              <button onClick={() => { setAction('change'); setMonth(currentYM()); setNewAmount(String(currentAmount)); setErr(''); }}
                className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                Change
              </button>
              <button onClick={() => { setAction('end'); setMonth(currentYM()); setErr(''); }}
                className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                End
              </button>
            </>
          )}
          {currentAmount === null && activePeriod === undefined && (
            <button onClick={() => { setAction('change'); setMonth(currentYM()); setNewAmount(''); setErr(''); }}
              className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              Reactivate
            </button>
          )}
          <button onClick={() => { setExpanded((v) => !v); }}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={handleDelete}
            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Inline action form */}
      {action && (
        <div className="px-5 py-3 bg-indigo-50/60 border-t border-indigo-100 space-y-3">
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex flex-wrap gap-3 items-end">
            {action === 'change' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">New Amount (KWD/mo)</label>
                <input type="number" min="0" step="0.001" placeholder="0.000"
                  value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
                  className="w-32 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                {action === 'change' ? 'Effective from month' : 'Last active month'}
              </label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={action === 'change' ? handleChangeAmount : handleEndExpense}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : action === 'change' ? 'Save' : 'End Expense'}
              </button>
              <button onClick={() => setAction(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {expanded && periods.length > 0 && (
        <div className="border-t border-slate-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-left">
                <th className="px-5 py-2 font-medium">From</th>
                <th className="px-5 py-2 font-medium">To</th>
                <th className="px-5 py-2 font-medium text-right">Amount (KWD/mo)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {periods.map((p) => (
                <tr key={p.id} className={p.end_month === null ? 'bg-emerald-50/50' : ''}>
                  <td className="px-5 py-2 text-slate-600">{p.start_month}</td>
                  <td className="px-5 py-2 text-slate-500">{p.end_month ?? <span className="text-emerald-600 font-medium">active</span>}</td>
                  <td className="px-5 py-2 text-right font-medium text-slate-900">{KWD(Number(p.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ExpensesRatesPage() {
  const { user, loading: authLoading } = useAuth();
  const [expenseTypes, setExpenseTypes] = useState<PhExpenseType[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [addErr, setAddErr] = useState('');
  const [addingSaving, setAddingSaving] = useState(false);

  const fetchTypes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ph_expense_types')
      .select('*')
      .eq('user_id', user.id)
      .order('name');
    setExpenseTypes(data ?? []);
  }, [user]);

  useEffect(() => { if (!authLoading) fetchTypes(); }, [authLoading, fetchTypes]);

  const handleAddType = async () => {
    if (!newExpenseName.trim()) { setAddErr('Enter a name.'); return; }
    setAddingSaving(true); setAddErr('');
    const { error } = await supabase.from('ph_expense_types').insert({
      user_id: user!.id, name: newExpenseName.trim(),
    });
    if (error) { setAddErr(error.message); setAddingSaving(false); return; }
    setNewExpenseName(''); setShowAddExpense(false);
    await fetchTypes();
    setAddingSaving(false);
  };

  if (authLoading) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-slate-200 rounded-lg" /><div className="h-48 bg-slate-200 rounded-2xl" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Expenses &amp; Rates</h1>
        <p className="text-slate-500 text-sm mt-1">Manage recurring expenses and developer billing rates</p>
      </div>

      {/* Developer rate */}
      {user && <RateSection userId={user.id} />}

      {/* Monthly expenses */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Monthly Fixed Expenses</h2>
          <button
            onClick={() => { setShowAddExpense((v) => !v); setAddErr(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Plus size={14} /> Add Expense
          </button>
        </div>

        {showAddExpense && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
            {addErr && <p className="text-xs text-red-600">{addErr}</p>}
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Expense Name</label>
                <input type="text" placeholder="e.g. Office Rent"
                  value={newExpenseName} onChange={(e) => setNewExpenseName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
                  className="w-56 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddType} disabled={addingSaving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  {addingSaving ? 'Adding…' : 'Add'}
                </button>
                <button onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400">You can set the monthly amount after adding the expense type.</p>
          </div>
        )}

        {expenseTypes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No expenses added yet.</p>
        ) : (
          <div className="space-y-2">
            {expenseTypes.map((e) => (
              <ExpenseRow key={e.id} expense={e} userId={user!.id}
                onDeleted={() => setExpenseTypes((p) => p.filter((x) => x.id !== e.id))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
