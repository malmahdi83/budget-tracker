'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PhContract, KWD } from '@/lib/ph-types';
import { Plus, Briefcase, Trash2 } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  maintenance: 'Maintenance',
  implementation: 'Implementation',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-50 text-red-600',
};

export default function ContractsPage() {
  const { user, loading: authLoading } = useAuth();
  const [contracts, setContracts] = useState<PhContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchContracts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ph_contracts')
      .select('*, ph_projects(name), ph_clients(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setContracts((data as PhContract[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) fetchContracts();
  }, [user, authLoading]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contract and all its installments and payments? This cannot be undone.')) return;
    setDeleting(id);
    await supabase.from('ph_contracts').delete().eq('id', id).eq('user_id', user!.id);
    setContracts((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
  };

  if (authLoading || loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-56 bg-slate-200 rounded-lg" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects &amp; Contracts</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your project contracts and payment schedules</p>
        </div>
        <Link
          href="/project-hours/contracts/add"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Add Contract
        </Link>
      </div>

      {contracts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
            <Briefcase size={32} className="text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="font-medium text-slate-700">No contracts yet</p>
            <p className="text-slate-500 text-sm mt-1">Add your first contract to get started.</p>
          </div>
          <Link
            href="/project-hours/contracts/add"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Add Contract
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 font-medium">Project</th>
                  <th className="px-6 py-3 font-medium">Client</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium text-right">Value (KWD)</th>
                  <th className="px-6 py-3 font-medium">Period</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <Link href={`/project-hours/contracts/${c.id}`} className="hover:text-indigo-600 hover:underline">
                        {c.ph_projects?.name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{c.ph_clients?.name ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.contract_type === 'maintenance'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        {TYPE_LABELS[c.contract_type]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">{KWD(Number(c.total_value))}</td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{c.start_date} → {c.end_date}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/project-hours/contracts/${c.id}`}
                          className="px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deleting === c.id}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
