'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PhContract, PhInstallment, PhPayment, KWD } from '@/lib/ph-types';
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2, CheckCircle } from 'lucide-react';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [contract, setContract] = useState<PhContract | null>(null);
  const [installments, setInstallments] = useState<PhInstallment[]>([]);
  const [payments, setPayments] = useState<Record<string, PhPayment[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Payment form state per installment
  const [paymentForm, setPaymentForm] = useState<Record<string, { amount: string; date: string; notes: string }>>({});
  const [savingPayment, setSavingPayment] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<Record<string, string>>({});

  const fetchData = async () => {
    if (!user || !id) return;
    const [cRes, iRes] = await Promise.all([
      supabase
        .from('ph_contracts')
        .select('*, ph_projects(name), ph_clients(name)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('ph_installments')
        .select('*')
        .eq('contract_id', id)
        .eq('user_id', user.id)
        .order('installment_number'),
    ]);

    if (!cRes.data) { setLoading(false); return; }
    setContract(cRes.data as PhContract);

    const instList: PhInstallment[] = iRes.data ?? [];
    setInstallments(instList);

    if (instList.length > 0) {
      const pRes = await supabase
        .from('ph_payments')
        .select('*')
        .in('installment_id', instList.map((i) => i.id))
        .eq('user_id', user.id)
        .order('collection_date');
      const pMap: Record<string, PhPayment[]> = {};
      (pRes.data ?? []).forEach((p: PhPayment) => {
        (pMap[p.installment_id] ??= []).push(p);
      });
      setPayments(pMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [user, authLoading, id]);

  const collected = (instId: string) =>
    Math.round(((payments[instId] ?? []).reduce((s, p) => s + Number(p.amount), 0)) * 1000) / 1000;

  const handleRecordPayment = async (instId: string, maxAmount: number) => {
    const form = paymentForm[instId] ?? { amount: '', date: '', notes: '' };
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) {
      setPaymentError((p) => ({ ...p, [instId]: 'Enter a valid amount.' }));
      return;
    }
    if (!form.date) {
      setPaymentError((p) => ({ ...p, [instId]: 'Enter collection date.' }));
      return;
    }
    if (amt > maxAmount + 0.001) {
      setPaymentError((p) => ({ ...p, [instId]: `Amount exceeds outstanding (${KWD(maxAmount)}).` }));
      return;
    }
    setSavingPayment(instId);
    setPaymentError((p) => ({ ...p, [instId]: '' }));

    const { data, error } = await supabase.from('ph_payments').insert({
      installment_id: instId,
      user_id: user!.id,
      amount: amt,
      collection_date: form.date,
      notes: form.notes.trim() || null,
    }).select().single();

    if (error || !data) {
      setPaymentError((p) => ({ ...p, [instId]: 'Failed to save payment.' }));
      setSavingPayment(null);
      return;
    }
    setPayments((prev) => ({ ...prev, [instId]: [...(prev[instId] ?? []), data as PhPayment] }));
    setPaymentForm((prev) => ({ ...prev, [instId]: { amount: '', date: '', notes: '' } }));
    setExpandedRow(null);
    setSavingPayment(null);
  };

  const handleDeletePayment = async (instId: string, paymentId: string) => {
    if (!confirm('Delete this payment record?')) return;
    await supabase.from('ph_payments').delete().eq('id', paymentId).eq('user_id', user!.id);
    setPayments((prev) => ({ ...prev, [instId]: (prev[instId] ?? []).filter((p) => p.id !== paymentId) }));
  };

  if (authLoading || loading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-slate-200 rounded-lg" /><div className="h-64 bg-slate-200 rounded-2xl" /></div>;
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Contract not found.</p>
        <Link href="/project-hours/contracts" className="text-indigo-600 hover:underline text-sm mt-2 inline-block">Back to contracts</Link>
      </div>
    );
  }

  const totalCollected = Math.round(installments.reduce((s, i) => s + collected(i.id), 0) * 1000) / 1000;
  const totalOutstanding = Math.round((Number(contract.total_value) - totalCollected) * 1000) / 1000;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/project-hours/contracts" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{contract.ph_projects?.name}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{contract.ph_clients?.name} · {contract.contract_type === 'maintenance' ? 'Maintenance' : 'Implementation'}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Contract Value</p>
          <p className="text-2xl font-bold text-slate-900">{KWD(Number(contract.total_value))}</p>
          <p className="text-xs text-slate-400 mt-1">{contract.start_date} → {contract.end_date}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Collected</p>
          <p className="text-2xl font-bold text-emerald-600">{KWD(totalCollected)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {contract.total_value > 0 ? Math.round(totalCollected / Number(contract.total_value) * 100) : 0}% of contract
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Outstanding</p>
          <p className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{KWD(totalOutstanding)}</p>
          <p className="text-xs text-slate-400 mt-1 capitalize">{contract.status}</p>
        </div>
      </div>

      {/* Installments table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Payment Schedule</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-3 font-medium">#</th>
                {contract.contract_type === 'maintenance' && <th className="px-6 py-3 font-medium">Service Period</th>}
                <th className="px-6 py-3 font-medium">Due Date</th>
                <th className="px-6 py-3 font-medium text-right">Due</th>
                <th className="px-6 py-3 font-medium text-right">Collected</th>
                <th className="px-6 py-3 font-medium text-right">Outstanding</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {installments.map((inst) => {
                const col = collected(inst.id);
                const outstanding = Math.round((Number(inst.amount) - col) * 1000) / 1000;
                const isPaid = outstanding <= 0;
                const isExpanded = expandedRow === inst.id;
                const form = paymentForm[inst.id] ?? { amount: '', date: '', notes: '' };
                const setForm = (patch: Partial<typeof form>) =>
                  setPaymentForm((p) => ({ ...p, [inst.id]: { ...form, ...patch } }));

                return (
                  <>
                    <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500">
                        <div className="flex items-center gap-2">
                          {isPaid && <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />}
                          {inst.installment_number}
                        </div>
                      </td>
                      {contract.contract_type === 'maintenance' && (
                        <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                          {inst.period_start} → {inst.period_end}
                        </td>
                      )}
                      <td className="px-6 py-4 text-slate-600">{inst.due_date}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900">{KWD(Number(inst.amount))}</td>
                      <td className="px-6 py-4 text-right font-medium text-emerald-600">{KWD(col)}</td>
                      <td className="px-6 py-4 text-right font-medium">
                        <span className={outstanding > 0 ? 'text-amber-600' : 'text-slate-400'}>{KWD(outstanding)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : inst.id)}
                          className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                            isPaid
                              ? 'text-slate-400 hover:bg-slate-100'
                              : 'text-indigo-600 hover:bg-indigo-50'
                          }`}
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {isPaid ? 'History' : 'Collect'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${inst.id}-expanded`}>
                        <td colSpan={contract.contract_type === 'maintenance' ? 7 : 6} className="bg-slate-50 px-6 py-4">
                          {/* Payment history */}
                          {(payments[inst.id] ?? []).length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-medium text-slate-500 mb-2">Payment History</p>
                              <div className="space-y-1">
                                {(payments[inst.id] ?? []).map((p) => (
                                  <div key={p.id} className="flex items-center justify-between gap-3 bg-white rounded-lg px-4 py-2.5 border border-slate-100">
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="font-medium text-emerald-600">{KWD(Number(p.amount))}</span>
                                      <span className="text-slate-400">·</span>
                                      <span className="text-slate-500">{p.collection_date}</span>
                                      {p.notes && <span className="text-slate-400 text-xs">{p.notes}</span>}
                                    </div>
                                    <button
                                      onClick={() => handleDeletePayment(inst.id, p.id)}
                                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Record payment form */}
                          {!isPaid && (
                            <div className="space-y-3">
                              <p className="text-xs font-medium text-slate-500">Record Payment</p>
                              <div className="flex flex-wrap items-end gap-3">
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Amount (KWD)</label>
                                  <input
                                    type="number"
                                    min="0.001"
                                    step="0.001"
                                    placeholder={KWD(outstanding).replace('KWD ', '')}
                                    value={form.amount}
                                    onChange={(e) => setForm({ amount: e.target.value })}
                                    className="w-36 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Collection Date</label>
                                  <input
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm({ date: e.target.value })}
                                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. cheque #1234"
                                    value={form.notes}
                                    onChange={(e) => setForm({ notes: e.target.value })}
                                    className="w-48 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                  />
                                </div>
                                <button
                                  onClick={() => handleRecordPayment(inst.id, outstanding)}
                                  disabled={savingPayment === inst.id}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                  <Plus size={14} />
                                  {savingPayment === inst.id ? 'Saving…' : 'Record'}
                                </button>
                              </div>
                              {paymentError[inst.id] && (
                                <p className="text-xs text-red-600">{paymentError[inst.id]}</p>
                              )}
                            </div>
                          )}

                          {isPaid && (payments[inst.id] ?? []).length === 0 && (
                            <p className="text-xs text-slate-400">No payment records.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
