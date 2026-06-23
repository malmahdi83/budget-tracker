import TransactionForm from '@/components/TransactionForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AddTransactionPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/transactions"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Transaction</h1>
          <p className="text-slate-500 text-sm mt-0.5">Record a new expense</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <TransactionForm />
      </div>
    </div>
  );
}
