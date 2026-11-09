'use client';

import { Clock } from 'lucide-react';

export default function DeveloperHoursPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Developer Hours</h1>
        <p className="text-slate-500 text-sm mt-1">Log and review developer time entries</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
          <Clock size={32} className="text-indigo-400" />
        </div>
        <p className="text-slate-500 text-center">Developer Hours is coming soon.</p>
      </div>
    </div>
  );
}
