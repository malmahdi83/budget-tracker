'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PhProject, PhClient, KWD, generateMaintenanceSchedule, MaintenanceInstallmentRow } from '@/lib/ph-types';
import { ArrowLeft, Plus } from 'lucide-react';

interface ImplInstallment {
  dueDate: string;
  amount: string;
  percentage: string;
}

export default function AddContractPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<PhProject[]>([]);
  const [clients, setClients] = useState<PhClient[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [projectId, setProjectId] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [clientId, setClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [contractType, setContractType] = useState<'maintenance' | 'implementation'>('maintenance');
  const [totalValue, setTotalValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [notes, setNotes] = useState('');

  // Maintenance-specific
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [frequencyMonths, setFrequencyMonths] = useState<1 | 3 | 6>(3);

  // Implementation-specific (2 installments)
  const [implInstallments, setImplInstallments] = useState<ImplInstallment[]>([
    { dueDate: '', amount: '', percentage: '' },
    { dueDate: '', amount: '', percentage: '' },
  ]);

  // Computed maintenance schedule
  const [schedule, setSchedule] = useState<MaintenanceInstallmentRow[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('ph_projects').select('*').eq('user_id', user.id).order('name'),
      supabase.from('ph_clients').select('*').eq('user_id', user.id).order('name'),
    ]).then(([p, c]) => {
      setProjects(p.data ?? []);
      setClients(c.data ?? []);
    });
  }, [user]);

  // Recompute maintenance schedule whenever relevant fields change
  useEffect(() => {
    if (contractType !== 'maintenance') return;
    const tv = parseFloat(totalValue);
    const ia = parseFloat(installmentAmount);
    if (!startDate || !endDate || !firstDueDate || !tv || !ia || ia <= 0) {
      setSchedule([]);
      return;
    }
    setSchedule(generateMaintenanceSchedule(startDate, endDate, firstDueDate, ia, frequencyMonths, tv));
  }, [contractType, totalValue, installmentAmount, firstDueDate, frequencyMonths, startDate, endDate]);

  // Sync implementation percentage ↔ amount
  const updateImpl = (index: number, field: 'dueDate' | 'amount' | 'percentage', value: string) => {
    const tv = parseFloat(totalValue) || 0;
    setImplInstallments((prev) => {
      const next = prev.map((r) => ({ ...r }));
      if (field === 'amount' && tv > 0) {
        next[index].amount = value;
        next[index].percentage = value !== '' ? String(Math.round((parseFloat(value) / tv) * 100 * 1000) / 1000) : '';
      } else if (field === 'percentage' && tv > 0) {
        next[index].percentage = value;
        next[index].amount = value !== '' ? String(Math.round(parseFloat(value) / 100 * tv * 1000) / 1000) : '';
      } else {
        (next[index] as Record<string, string>)[field] = value;
      }
      return next;
    });
  };

  const validateForm = (): string => {
    if (!projectId && !newProjectName.trim()) return 'Select or enter a project name.';
    if (!clientId && !newClientName.trim()) return 'Select or enter a client name.';
    const tv = parseFloat(totalValue);
    if (!tv || tv <= 0) return 'Enter a valid total contract value.';
    if (!startDate || !endDate) return 'Enter start and end dates.';
    if (endDate <= startDate) return 'End date must be after start date.';
    if (contractType === 'maintenance') {
      if (!installmentAmount || parseFloat(installmentAmount) <= 0) return 'Enter installment amount.';
      if (!firstDueDate) return 'Enter first due date.';
      if (schedule.length === 0) return 'Could not generate schedule. Check dates and installment amount.';
      const scheduleTotal = Math.round(schedule.reduce((s, r) => s + r.amount, 0) * 1000) / 1000;
      if (Math.abs(scheduleTotal - tv) > 0.01) return `Schedule total (${KWD(scheduleTotal)}) does not equal contract value (${KWD(tv)}).`;
    } else {
      const a1 = parseFloat(implInstallments[0].amount);
      const a2 = parseFloat(implInstallments[1].amount);
      if (!implInstallments[0].dueDate || !implInstallments[1].dueDate) return 'Enter due dates for both installments.';
      if (!a1 || !a2 || a1 <= 0 || a2 <= 0) return 'Enter amounts for both installments.';
      const sum = Math.round((a1 + a2) * 1000) / 1000;
      if (Math.abs(sum - tv) > 0.01) return `Installment sum (${KWD(sum)}) must equal contract value (${KWD(tv)}).`;
    }
    return '';
  };

  const handleSave = async () => {
    const err = validateForm();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');

    // Create project/client if new
    let pid = projectId;
    let cid = clientId;

    if (!pid) {
      const { data, error: e } = await supabase.from('ph_projects').insert({ name: newProjectName.trim(), user_id: user!.id }).select().single();
      if (e || !data) { setError('Failed to create project.'); setSaving(false); return; }
      pid = data.id;
    }
    if (!cid) {
      const { data, error: e } = await supabase.from('ph_clients').insert({ name: newClientName.trim(), user_id: user!.id }).select().single();
      if (e || !data) { setError('Failed to create client.'); setSaving(false); return; }
      cid = data.id;
    }

    // Create contract
    const { data: contract, error: ce } = await supabase
      .from('ph_contracts')
      .insert({
        user_id: user!.id,
        project_id: pid,
        client_id: cid,
        contract_type: contractType,
        total_value: parseFloat(totalValue),
        start_date: startDate,
        end_date: endDate,
        status,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (ce || !contract) { setError('Failed to create contract.'); setSaving(false); return; }

    // Create installments
    let installmentsToInsert: object[];
    if (contractType === 'maintenance') {
      installmentsToInsert = schedule.map((r) => ({
        contract_id: contract.id,
        user_id: user!.id,
        installment_number: r.number,
        due_date: r.dueDate,
        amount: r.amount,
        period_start: r.periodStart,
        period_end: r.periodEnd,
        billing_frequency_months: frequencyMonths,
      }));
    } else {
      installmentsToInsert = implInstallments.map((r, i) => ({
        contract_id: contract.id,
        user_id: user!.id,
        installment_number: i + 1,
        due_date: r.dueDate,
        amount: parseFloat(r.amount),
        percentage: parseFloat(r.percentage) || null,
      }));
    }

    const { error: ie } = await supabase.from('ph_installments').insert(installmentsToInsert);
    if (ie) { setError('Contract saved but installments failed: ' + ie.message); setSaving(false); return; }

    router.push(`/project-hours/contracts/${contract.id}`);
  };

  if (authLoading) return <div className="animate-pulse h-96 bg-slate-200 rounded-2xl" />;

  const tv = parseFloat(totalValue) || 0;
  const implSum = implInstallments.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const implSumRounded = Math.round(implSum * 1000) / 1000;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/project-hours/contracts" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Contract</h1>
          <p className="text-slate-500 text-sm mt-0.5">Create a new project contract with payment schedule</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h2 className="font-semibold text-slate-900">Basic Information</h2>

        {/* Project */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Project</label>
            <select
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); if (e.target.value) setNewProjectName(''); }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">— New project —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {!projectId && (
              <input
                type="text"
                placeholder="Project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-xl border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-indigo-50"
              />
            )}
          </div>

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Client</label>
            <select
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); if (e.target.value) setNewClientName(''); }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">— New client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!clientId && (
              <input
                type="text"
                placeholder="Client name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-xl border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-indigo-50"
              />
            )}
          </div>
        </div>

        {/* Contract type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Contract Type</label>
          <div className="flex gap-3">
            {(['maintenance', 'implementation'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setContractType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  contractType === t
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                }`}
              >
                {t === 'maintenance' ? 'Maintenance' : 'Implementation'}
              </button>
            ))}
          </div>
        </div>

        {/* Total value + dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Value (KWD)</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              placeholder="0.000"
              value={totalValue}
              onChange={(e) => setTotalValue(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        {/* Status + notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'completed' | 'cancelled')}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (optional)</label>
            <input
              type="text"
              placeholder="Contract notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
      </div>

      {/* Maintenance settings */}
      {contractType === 'maintenance' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Maintenance Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Installment Amount (KWD)</label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                placeholder="0.000"
                value={installmentAmount}
                onChange={(e) => setInstallmentAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">First Due Date</label>
              <input
                type="date"
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Billing Frequency</label>
              <select
                value={frequencyMonths}
                onChange={(e) => setFrequencyMonths(Number(e.target.value) as 1 | 3 | 6)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value={1}>Monthly (1 month)</option>
                <option value={3}>Quarterly (3 months)</option>
                <option value={6}>Semi-annual (6 months)</option>
              </select>
            </div>
          </div>

          {schedule.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Generated Schedule ({schedule.length} installments)</span>
                <span className={`text-sm font-medium ${
                  Math.abs(schedule.reduce((s, r) => s + r.amount, 0) - tv) < 0.01 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  Total: {KWD(schedule.reduce((s, r) => s + r.amount, 0))}
                  {tv > 0 && ` / ${KWD(tv)}`}
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-left">
                      <th className="px-4 py-2 font-medium">#</th>
                      <th className="px-4 py-2 font-medium">Service Period</th>
                      <th className="px-4 py-2 font-medium">Due Date</th>
                      <th className="px-4 py-2 font-medium text-right">Amount (KWD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {schedule.map((r) => (
                      <tr key={r.number}>
                        <td className="px-4 py-2 text-slate-500">{r.number}</td>
                        <td className="px-4 py-2 text-slate-600">{r.periodStart} → {r.periodEnd}</td>
                        <td className="px-4 py-2 text-slate-600">{r.dueDate}</td>
                        <td className="px-4 py-2 text-right font-medium text-slate-900">{KWD(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Implementation settings */}
      {contractType === 'implementation' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Implementation Installments</h2>
          <p className="text-sm text-slate-500">Two installments — amounts must add up to the total contract value.</p>

          {implInstallments.map((r, i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-4 space-y-3">
              <div className="text-sm font-medium text-slate-700">
                Installment {i + 1} {i === 0 ? '(First / Start)' : '(Second / Completion)'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={r.dueDate}
                    onChange={(e) => updateImpl(i, 'dueDate', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Amount (KWD)</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    placeholder="0.000"
                    value={r.amount}
                    onChange={(e) => updateImpl(i, 'amount', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.001"
                    placeholder="0.000"
                    value={r.percentage}
                    onChange={(e) => updateImpl(i, 'percentage', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>
            </div>
          ))}

          {tv > 0 && (
            <div className={`text-sm font-medium ${Math.abs(implSumRounded - tv) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
              Sum: {KWD(implSumRounded)} / {KWD(tv)}
              {Math.abs(implSumRounded - tv) < 0.01 ? ' ✓' : ` (difference: ${KWD(Math.abs(implSumRounded - tv))})`}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pb-8">
        <Link href="/project-hours/contracts" className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          <Plus size={16} />
          {saving ? 'Saving…' : 'Save Contract'}
        </button>
      </div>
    </div>
  );
}
