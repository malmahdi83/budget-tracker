'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PhHoursEntry, PhProject, PhContract, PhDeveloperRate, KWD, currentYM } from '@/lib/ph-types';
import { Plus, Trash2, Clock, Users, Briefcase } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────

function round3(n: number) { return Math.round(n * 1000) / 1000; }

// ─── Add Entry Form ───────────────────────────────────────────────────────

function AddEntryForm({ userId, projects, onAdded }: {
  userId: string;
  projects: PhProject[];
  onAdded: () => void;
}) {
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');      // '' = Others
  const [resolvedRate, setResolvedRate] = useState<PhDeveloperRate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch applicable rate whenever work date changes
  useEffect(() => {
    if (!workDate) { setResolvedRate(null); return; }
    supabase
      .from('ph_developer_rates')
      .select('*')
      .eq('user_id', userId)
      .lte('effective_date', workDate)
      .order('effective_date', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setResolvedRate(data ?? null));
  }, [workDate, userId]);

  const computedCost = resolvedRate && hours
    ? round3((parseFloat(hours) || 0) * Number(resolvedRate.hourly_rate))
    : null;

  const validate = async (): Promise<string> => {
    const h = parseFloat(hours);
    if (!h || h <= 0) return 'Hours must be greater than zero.';
    if (!description.trim()) return 'Enter a description.';
    if (!resolvedRate) return 'No hourly rate found for this date. Add a rate in Expenses & Rates.';
    if (projectId) {
      // Check the project has an active contract covering this date
      const { data: contracts } = await supabase
        .from('ph_contracts')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .lte('start_date', workDate)
        .gte('end_date', workDate)
        .limit(1) as { data: PhContract[] | null };
      if (!contracts || contracts.length === 0)
        return 'The selected project has no active contract covering this date.';
    }
    return '';
  };

  const handleSave = async () => {
    const err = await validate();
    if (err) { setError(err); return; }
    setSaving(true); setError('');
    const h = parseFloat(hours);
    const rate = Number(resolvedRate!.hourly_rate);
    const { error: e } = await supabase.from('ph_hours').insert({
      user_id: userId,
      work_date: workDate,
      hours: h,
      description: description.trim(),
      project_id: projectId || null,
      applied_rate: rate,
      cost: round3(h * rate),
    });
    if (e) { setError(e.message); setSaving(false); return; }
    setHours(''); setDescription(''); setProjectId('');
    onAdded();
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <h2 className="font-semibold text-slate-900">Log Hours</h2>
      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Work Date</label>
          <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Hours</label>
          <input type="number" min="0.01" step="0.01" placeholder="e.g. 3.5"
            value={hours} onChange={(e) => setHours(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            <option value="">Others (non-billable)</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Rate / Cost</label>
          <div className="px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600 min-h-[38px]">
            {resolvedRate ? (
              <>
                <span className="font-medium text-slate-900">{KWD(Number(resolvedRate.hourly_rate))}</span>/hr
                {computedCost !== null && hours && (
                  <span className="ml-2 text-indigo-600 font-medium">→ {KWD(computedCost)}</span>
                )}
              </>
            ) : (
              <span className="text-amber-500 text-xs">No rate for this date</span>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Description</label>
        <input type="text" placeholder="What did you work on?"
          value={description} onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm">
          <Plus size={15} />
          {saving ? 'Saving…' : 'Log Entry'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function DeveloperHoursPage() {
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<PhHoursEntry[]>([]);
  const [projects, setProjects] = useState<PhProject[]>([]);
  const [filterMonth, setFilterMonth] = useState(currentYM());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ph_projects').select('id, name').eq('user_id', user.id).order('name');
    setProjects(data ?? []);
  }, [user]);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ph_hours')
      .select('*, ph_projects(name)')
      .eq('user_id', user.id)
      .gte('work_date', `${filterMonth}-01`)
      .lte('work_date', lastDayOfMonth(filterMonth))
      .order('work_date', { ascending: false });
    setEntries((data as PhHoursEntry[]) ?? []);
    setLoading(false);
  }, [user, filterMonth]);

  useEffect(() => { if (!authLoading) { fetchProjects(); fetchEntries(); } }, [authLoading, fetchProjects, fetchEntries]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this hours entry?')) return;
    setDeleting(id);
    await supabase.from('ph_hours').delete().eq('id', id).eq('user_id', user!.id);
    setEntries((p) => p.filter((e) => e.id !== id));
    setDeleting(null);
  };

  // ── Stats ────────────────────────────────────────────────────────────────

  const billable = entries.filter((e) => e.project_id !== null);
  const others = entries.filter((e) => e.project_id === null);

  const totalHours = round3(entries.reduce((s, e) => s + Number(e.hours), 0));
  const totalCost = round3(entries.reduce((s, e) => s + Number(e.cost), 0));
  const billableHours = round3(billable.reduce((s, e) => s + Number(e.hours), 0));
  const billableCost = round3(billable.reduce((s, e) => s + Number(e.cost), 0));
  const othersHours = round3(others.reduce((s, e) => s + Number(e.hours), 0));
  const othersCost = round3(others.reduce((s, e) => s + Number(e.cost), 0));

  if (authLoading) return <div className="animate-pulse h-96 bg-slate-200 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Developer Hours</h1>
          <p className="text-slate-500 text-sm mt-1">Log and review time entries</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Month</label>
          <input type="month" value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setLoading(true); }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={15} className="text-slate-400" />
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalHours} <span className="text-base font-normal text-slate-400">hrs</span></p>
          <p className="text-sm font-medium text-slate-600 mt-1">{KWD(totalCost)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase size={15} className="text-indigo-400" />
            <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Billable (Projects)</p>
          </div>
          <p className="text-2xl font-bold text-indigo-700">{billableHours} <span className="text-base font-normal text-indigo-300">hrs</span></p>
          <p className="text-sm font-medium text-indigo-600 mt-1">{KWD(billableCost)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} className="text-amber-400" />
            <p className="text-xs text-amber-500 font-medium uppercase tracking-wide">Others (Non-billable)</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{othersHours} <span className="text-base font-normal text-amber-300">hrs</span></p>
          <p className="text-sm font-medium text-amber-600 mt-1">{KWD(othersCost)}</p>
        </div>
      </div>

      {/* Add form */}
      {user && <AddEntryForm userId={user.id} projects={projects} onAdded={fetchEntries} />}

      {/* Entries table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Entries — {filterMonth}</h2>
          <span className="text-sm text-slate-400">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2 p-6">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={28} className="text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No entries for {filterMonth}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium text-right">Hours</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium">Project</th>
                  <th className="px-6 py-3 font-medium text-right">Rate</th>
                  <th className="px-6 py-3 font-medium text-right">Cost</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{e.work_date}</td>
                    <td className="px-6 py-3 text-right font-medium text-slate-900">{Number(e.hours).toFixed(2)}</td>
                    <td className="px-6 py-3 text-slate-700 max-w-xs truncate">{e.description}</td>
                    <td className="px-6 py-3">
                      {e.project_id ? (
                        <span className="inline-flex items-center gap-1 text-indigo-600 text-xs bg-indigo-50 px-2 py-0.5 rounded-full">
                          <Briefcase size={10} />{e.ph_projects?.name ?? '—'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 text-xs bg-amber-50 px-2 py-0.5 rounded-full">
                          <Users size={10} />Others
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-500 text-xs whitespace-nowrap">{KWD(Number(e.applied_rate))}/hr</td>
                    <td className="px-6 py-3 text-right font-medium text-slate-900 whitespace-nowrap">{KWD(Number(e.cost))}</td>
                    <td className="px-6 py-3">
                      <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-100 bg-slate-50">
                  <td className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide" colSpan={1}>Totals</td>
                  <td className="px-6 py-3 text-right font-bold text-slate-900">{totalHours.toFixed(2)}</td>
                  <td colSpan={3}></td>
                  <td className="px-6 py-3 text-right font-bold text-slate-900">{KWD(totalCost)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}
