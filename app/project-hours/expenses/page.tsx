'use client';

import { DollarSign } from 'lucide-react';

export default function ExpensesRatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Expenses &amp; Rates</h1>
        <p className="text-slate-500 text-sm mt-1">Manage project expenses and billing rates</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
          <DollarSign size={32} className="text-indigo-400" />
        </div>
        <p className="text-slate-500 text-center">Expenses &amp; Rates is coming soon.</p>
      </div>
    </div>
  );
}
