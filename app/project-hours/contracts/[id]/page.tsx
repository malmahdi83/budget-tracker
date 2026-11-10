'use client';

import { useEffect, useState, Fragment } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  PhContract, PhInstallment, PhPayment, PhProject, PhClient,
  KWD,
} from '@/lib/ph-types';
import {
  ArrowLeft, ChevronDown, ChevronUp, Plus,
  Trash2, CheckCircle, Pencil, X, Save, AlertTriangle,
} from 'lucide-react';

function round3(n: number) { return Math.round(n * 1000) / 1000; }

// ─── Contract header edit form ────────────────────────────────────────────

interface HeaderEditProps {
  contract: PhContract;
  projects: PhProject[];
  clients: PhClient[];
  onSaved: (updated: PhContract) => void;
  onCancel: () => void;
}

function HeaderEditForm({ contract, projects, clients, onSaved, onCancel }: HeaderEditProps) {
  const { user } = useAuth();
  const [projectId, setProjectId] = useState(contract.project_id);
  const [clientId, setClientId] = useState(contract.client_id);
  const [totalValue, setTotalValue] = useState(String(contract.total_value));
  const [startDate, setStartDate] = useState(contract.start_date);
  const [endDate, setEndDate] = useState(contract.end_date);
  const [status, setStatus] = useState(contract.status);
  const [notes, setNotes] = useState(contract.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const tv = parseFloat(totalValue);
    if (!tv || tv <= 0) { setError('Total value must be greater than zero.'); return; }
    if (!startDate || !endDate) { setError('Start and end dates are required.'); return; }
    if (endDate <= startDate) { setError('End date must be after start date.'); return; }
    setSaving(true); setError('');
    const { data, error: e } = await supabase
      .from('ph_contracts')
      .update({
        project_id: projectId,
        client_id: clientId,
        total_value: tv,
        start_date: startDate,
        end_date: endDate,
        status,
        notes: notes.trim() || null,
      })
      .eq('id', contract.id)
      .eq('user_id', user!.id)
      .select('*, ph_projects(name), ph_clients(name)')
      .single();
    if (e || !data) { setError(e?.message ?? 'Save failed.'); setSaving(false); return; }
    onSaved(data as PhContract);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 text-sm">Edit Contract</h3>
        <button onClick={onCancel} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={15} /></button>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Total Value (KWD)</label>
          <input type="number" min="0.001" step="0.001" value={totalValue}
            onChange={(e) => setTotalValue(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as PhContract['status'])}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-white transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
          <Save size={14} />{saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── Installment edit row ─────────────────────────────────────────────────

interface InstEditProps {
  inst: PhInstallment;
  isMaintenance: boolean;
  collectedAmount: number;
  userId: string;
  onSaved: (updated: PhInstallment) => void;
  onCancel: () => void;
}

function InstallmentEditRow({ inst, isMaintenance, collectedAmount, userId, onSaved, onCancel }: InstEditProps) {
  const [dueDate, setDueDate] = useState(inst.due_date);
  const [amount, setAmount] = useState(String(inst.amount));
  const [periodStart, setPeriodStart] = useState(inst.period_start ?? '');
  const [periodEnd, setPeriodEnd] = useState(inst.period_end ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Amount must be greater than zero.'); return; }
    if (amt < collectedAmount - 0.001) {
      setError(`Amount (${KWD(amt)}) cannot be less than what is already collected (${KWD(collectedAmount)}).`);
      return;
    }
    if (!dueDate) { setError('Due date is required.'); return; }
    setSaving(true); setError('');
    const patch: Partial<PhInstallment> = { due_date: dueDate, amount: amt };
    if (isMaintenance) {
      patch.period_start = periodStart || null;
      patch.period_end = periodEnd || null;
    }
    const { data, error: e } = await supabase
      .from('ph_installments')
      .update(patch)
      .eq('id', inst.id)
      .eq('user_id', userId)
      .select()
      .single();
    if (e || !data) { setError(e?.message ?? 'Save failed.'); setSaving(false); return; }
    onSaved(data as PhInstallment);
  };

  return (
    <td colSpan={isMaintenance ? 7 : 6} className="bg-indigo-50/60 px-6 py-4">
      <div className="space-y-3">
        <p className="text-xs font-medium text-slate-600">Edit Installment #{inst.installment_number}</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Amount (KWD)</label>
            <input type="number" min="0.001" step="0.001" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-36 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
            {collectedAmount > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">Min: {KWD(collectedAmount)} (collected)</p>
            )}
          </div>
          {isMaintenance && (
            <>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Period Start</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Period End</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
              </div>
            </>
          )}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
              <Save size={13} />{saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onCancel}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </td>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [contract, setContract] = useState<PhContract | null>(null);
  const [installments, setInstallments] = useState<PhInstallment[]>([]);
  const [payments, setPayments] = useState<Record<string, PhPayment[]>>({});
  const [projects, setProjects] = useState<PhProject[]>([]);
  const [clients, setClients] = useState<PhClient[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingInstId, setEditingInstId] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<Record<string, { amount: string; date: string; notes: string }>>({});
  const [savingPayment, setSavingPayment] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<Record<string, string>>({});

  const fetchData = async () => {
    if (!user || !id) return;
    const [cRes, iRes, pjRes, clRes] = await Promise.all([
      supabase.from('ph_contracts')
        .select('*, ph_projects(name), ph_clients(name)')
        .eq('id', id).eq('user_id', user.id).single(),
      supabase.from('ph_installments')
        .select('*').eq('contract_id', id).eq('user_id', user.id)
        .order('installment_number'),
      supabase.from('ph_projects').select('id, name').eq('user_id', user.id).order('name'),
      supabase.from('ph_clients').select('id, name').eq('user_id', user.id).order('name'),
    ]);
    if (!cRes.data) { setLoading(false); return; }
    setContract(cRes.data as PhContract);
    setInstallments(iRes.data ?? []);
    setProjects(pjRes.data ?? []);
    setClients(clRes.data ?? []);

    const instList: PhInstallment[] = iRes.data ?? [];
    if (instList.length > 0) {
      const pRes = await supabase.from('ph_payments').select('*')
        .in('installment_id', instList.map((i) => i.id))
        .eq('user_id', user.id).order('collection_date');
      const pMap: Record<string, PhPayment[]> = {};
      (pRes.data ?? []).forEach((p: PhPayment) => { (pMap[p.installment_id] ??= []).push(p); });
      setPayments(pMap);
    }
    setLoading(false);
  };

  useEffect(() => { if (!authLoading) fetchData(); }, [user, authLoading, id]);

  const collected = (instId: string) =>
    round3((payments[instId] ?? []).reduce((s, p) => s + Number(p.amount), 0));

  const handleRecordPayment = async (instId: string, maxAmount: number) => {
    const form = paymentForm[instId] ?? { amount: '', date: '', notes: '' };
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setPaymentError((p) => ({ ...p, [instId]: 'Enter a valid amount.' })); return; }
    if (!form.date) { setPaymentError((p) => ({ ...p, [instId]: 'Enter collection date.' })); return; }
    if (amt > maxAmount + 0.001) {
      setPaymentError((p) => ({ ...p, [instId]: `Amount exceeds outstanding (${KWD(maxAmount)}).` }));
      return;
    }
    setSavingPayment(instId);
    setPaymentError((p) => ({ ...p, [instId]: '' }));
    const { data, error } = await supabase.from('ph_payments').insert({
      installment_id: instId, user_id: user!.id,
      amount: amt, collection_date: form.date, notes: form.notes.trim() || null,
    }).select().single();
    if (error || !data) { setPaymentError((p) => ({ ...p, [instId]: 'Failed to save payment.' })); setSavingPayment(null); return; }
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

  const isMaintenance = contract.contract_type === 'maintenance';
  const colCount = isMaintenance ? 7 : 6;
  const totalCollected = round3(installments.reduce((s, i) => s + collected(i.id), 0));
  const totalOutstanding = round3(Number(contract.total_value) - totalCollected);
  const installmentSum = round3(installments.reduce((s, i) => s + Number(i.amount), 0));
  const sumMatchesContract = Math.abs(installmentSum - Number(contract.total_value)) < 0.005;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/project-hours/contracts" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{contract.ph_projects?.name}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {contract.ph_clients?.name} · {isMaintenance ? 'Maintenance' : 'Implementation'}
          </p>
        </div>
        {!editingHeader && (
          <button
            onClick={() => { setEditingHeader(true); setEditingInstId(null); setExpandedRow(null); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-indigo-200"
          >
            <Pencil size={14} /> Edit Contract
          </button>
        )}
      </div>

      {/* Contract header edit form */}
      {editingHeader && (
        <HeaderEditForm
          contract={contract}
          projects={projects}
          clients={clients}
          onSaved={(updated) => { setContract(updated); setEditingHeader(false); }}
          onCancel={() => setEditingHeader(false)}
        />
      )}

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
            {Number(contract.total_value) > 0 ? Math.round(totalCollected / Number(contract.total_value) * 100) : 0}% of contract
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Outstanding</p>
          <p className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{KWD(totalOutstanding)}</p>
          <p className="text-xs text-slate-400 mt-1 capitalize">{contract.status}{contract.notes ? ` · ${contract.notes}` : ''}</p>
        </div>
      </div>

      {/* Schedule total mismatch warning */}
      {!sumMatchesContract && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>
            Installment total ({KWD(installmentSum)}) does not equal contract value ({KWD(Number(contract.total_value))}).
            Difference: {KWD(round3(Math.abs(installmentSum - Number(contract.total_value))))}. Edit individual rows to fix.
          </span>
        </div>
      )}

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
                {isMaintenance && <th className="px-6 py-3 font-medium">Service Period</th>}
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
                const outstanding = round3(Number(inst.amount) - col);
                const isPaid = outstanding <= 0;
                const isExpanded = expandedRow === inst.id;
                const isEditing = editingInstId === inst.id;
                const form = paymentForm[inst.id] ?? { amount: '', date: '', notes: '' };
                const setForm = (patch: Partial<typeof form>) =>
                  setPaymentForm((p) => ({ ...p, [inst.id]: { ...form, ...patch } }));

                return (
                  <Fragment key={inst.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500">
                        <div className="flex items-center gap-2">
                          {isPaid && <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />}
                          {inst.installment_number}
                        </div>
                      </td>
                      {isMaintenance && (
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
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => {
                              if (isEditing) { setEditingInstId(null); return; }
                              setEditingInstId(inst.id);
                              setExpandedRow(null);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit installment"
                          >
                            {isEditing ? <X size={13} /> : <Pencil size={13} />}
                          </button>
                          <button
                            onClick={() => {
                              if (isExpanded) { setExpandedRow(null); return; }
                              setExpandedRow(inst.id);
                              setEditingInstId(null);
                            }}
                            className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                              isPaid ? 'text-slate-400 hover:bg-slate-100' : 'text-indigo-600 hover:bg-indigo-50'
                            }`}
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {isPaid ? 'History' : 'Collect'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Installment edit form */}
                    {isEditing && (
                      <tr>
                        <InstallmentEditRow
                          inst={inst}
                          isMaintenance={isMaintenance}
                          collectedAmount={col}
                          userId={user!.id}
                          onSaved={(updated) => {
                            setInstallments((prev) => prev.map((i) => i.id === updated.id ? updated : i));
                            setEditingInstId(null);
                          }}
                          onCancel={() => setEditingInstId(null)}
                        />
                      </tr>
                    )}

                    {/* Collect / history panel */}
                    {isExpanded && !isEditing && (
                      <tr>
                        <td colSpan={colCount} className="bg-slate-50 px-6 py-4">
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
                                    <button onClick={() => handleDeletePayment(inst.id, p.id)}
                                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {!isPaid && (
                            <div className="space-y-3">
                              <p className="text-xs font-medium text-slate-500">Record Payment</p>
                              <div className="flex flex-wrap items-end gap-3">
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Amount (KWD)</label>
                                  <input type="number" min="0.001" step="0.001"
                                    placeholder="0.000"
                                    value={form.amount} onChange={(e) => setForm({ amount: e.target.value })}
                                    className="w-36 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Collection Date</label>
                                  <input type="date" value={form.date} onChange={(e) => setForm({ date: e.target.value })}
                                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                                  <input type="text" placeholder="e.g. cheque #1234"
                                    value={form.notes} onChange={(e) => setForm({ notes: e.target.value })}
                                    className="w-48 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                                </div>
                                <button onClick={() => handleRecordPayment(inst.id, outstanding)}
                                  disabled={savingPayment === inst.id}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                                  <Plus size={14} />
                                  {savingPayment === inst.id ? 'Saving…' : 'Record'}
                                </button>
                              </div>
                              {paymentError[inst.id] && <p className="text-xs text-red-600">{paymentError[inst.id]}</p>}
                            </div>
                          )}
                          {isPaid && (payments[inst.id] ?? []).length === 0 && (
                            <p className="text-xs text-slate-400">No payment records.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            {installments.length > 0 && (
              <tfoot>
                <tr className={`border-t-2 ${sumMatchesContract ? 'border-slate-200' : 'border-amber-300'}`}>
                  <td colSpan={isMaintenance ? 2 : 1} className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Schedule Total</td>
                  <td className="px-6 py-3"></td>
                  <td className={`px-6 py-3 text-right font-bold ${sumMatchesContract ? 'text-slate-900' : 'text-amber-600'}`}>
                    {KWD(installmentSum)}
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-emerald-600">{KWD(totalCollected)}</td>
                  <td className="px-6 py-3 text-right font-bold text-amber-600">{KWD(totalOutstanding)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
