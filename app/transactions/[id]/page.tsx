'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase, Transaction } from '@/lib/supabase';
import TransactionForm from '@/components/TransactionForm';
import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function EditTransactionPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setTransaction(data);
        setLoading(false);
      });
  }, [id]);

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
          <h1 className="text-2xl font-bold text-slate-900">Edit Transaction</h1>
          <p className="text-slate-500 text-sm mt-0.5">Update transaction details</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : transaction ? (
          transaction.user_id !== user?.id ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
              <Lock size={32} className="text-slate-300" />
              <p className="font-medium">Access Denied</p>
              <p className="text-sm text-slate-400">You can only edit your own transactions.</p>
              <Link href="/transactions" className="mt-2 text-sm text-indigo-600 hover:underline">Back to transactions</Link>
            </div>
          ) : (
            <TransactionForm initial={transaction} />
          )
        ) : (
          <p className="text-slate-400 text-sm">Transaction not found.</p>
        )}
      </div>
    </div>
  );
}
