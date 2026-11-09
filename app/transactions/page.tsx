'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase, Transaction, CATEGORIES, PAYMENT_METHODS } from '@/lib/supabase';
import CategoryBadge from '@/components/CategoryBadge';
import DeleteModal from '@/components/DeleteModal';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Pencil, Trash2, PlusCircle, Search, ChevronUp, ChevronDown, X, Lock, Download } from 'lucide-react';

type SortKey = 'date' | 'amount' | 'merchant' | 'category';
type SortDir = 'asc' | 'desc';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();

  // Prefix cells starting with formula chars to prevent CSV injection in spreadsheet apps
  const sanitizeCsvCell = (v: string) => /^[=+\-@\t\r]/.test(v) ? `\t${v}` : v;

  const exportCSV = () => {
    const headers = ['Date','Merchant','Category','Payment Method','Description','Notes','Amount'];
    const rows = filtered.map((tx) => [
      tx.date,
      sanitizeCsvCell(tx.merchant),
      sanitizeCsvCell(tx.category),
      tx.payment_method,
      sanitizeCsvCell(tx.description ?? ''),
      sanitizeCsvCell(tx.notes ?? ''),
      tx.amount,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `transactions-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from('transactions').select('*').eq('user_id', user.id);
    if (error) setError('Could not load transactions. Please try again.');
    else setTransactions(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTransactions(); }, [user]);

  const filtered = useMemo(() => {
    let r = [...transactions];
    if (search) r = r.filter((tx) => tx.merchant.toLowerCase().includes(search.toLowerCase()));
    if (category) r = r.filter((tx) => tx.category === category);
    if (paymentMethod) r = r.filter((tx) => tx.payment_method === paymentMethod);
    if (dateFrom) r = r.filter((tx) => tx.date >= dateFrom);
    if (dateTo) r = r.filter((tx) => tx.date <= dateTo);
    r.sort((a, b) => {
      const av = sortKey === 'amount' ? Number(a[sortKey]) : String(a[sortKey]);
      const bv = sortKey === 'amount' ? Number(b[sortKey]) : String(b[sortKey]);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return r;
  }, [transactions, search, category, paymentMethod, dateFrom, dateTo, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from('transactions').delete().eq('id', deleteId).eq('user_id', user!.id);
    setTransactions((prev) => prev.filter((tx) => tx.id !== deleteId));
    setDeleteId(null);
    setDeleting(false);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KWD' }).format(n);

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === 'asc' ? <ChevronUp size={14} className="inline" /> : <ChevronDown size={14} className="inline" />
    ) : (
      <span className="opacity-30 inline"><ChevronDown size={14} className="inline" /></span>
    );

  const hasFilters = search || category || paymentMethod || dateFrom || dateTo;
  const clearFilters = () => { setSearch(''); setCategory(''); setPaymentMethod(''); setDateFrom(''); setDateTo(''); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('tx.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('tx.count', filtered.length, transactions.length)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            <Download size={16} />
            {t('tx.exportCSV')}
          </button>
          <Link
            href="/add"
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusCircle size={16} />
            {t('tx.addTransaction')}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('tx.searchMerchant')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          >
            <option value="">{t('tx.allCategories')}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          >
            <option value="">{t('tx.allMethods')}</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
            />
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">{t('tx.loading')}</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 font-medium">{t('tx.noFound')}</p>
            <p className="text-slate-300 text-sm mt-1">{t('tx.adjustFilters')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-slate-700">
                      {t('tx.date')} <SortIcon k="date" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    <button onClick={() => toggleSort('merchant')} className="flex items-center gap-1 hover:text-slate-700">
                      {t('tx.merchant')} <SortIcon k="merchant" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 hidden sm:table-cell">
                    <button onClick={() => toggleSort('category')} className="flex items-center gap-1 hover:text-slate-700">
                      {t('tx.category')} <SortIcon k="category" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 hidden md:table-cell">{t('tx.payment')}</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 hidden lg:table-cell">{t('tx.description')}</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">
                    <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 ml-auto hover:text-slate-700">
                      {t('tx.amount')} <SortIcon k="amount" />
                    </button>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{tx.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{tx.merchant}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <CategoryBadge category={tx.category} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{tx.payment_method}</td>
                    <td className="px-4 py-3 text-slate-400 hidden lg:table-cell max-w-xs truncate">{tx.description}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                      {fmt(Number(tx.amount))}
                    </td>
                    <td className="px-4 py-3">
                      {tx.user_id === user?.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Link
                            href={`/transactions/${tx.id}`}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Pencil size={15} />
                          </Link>
                          <button
                            onClick={() => setDeleteId(tx.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end pr-1">
                          <Lock size={13} className="text-slate-300" />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Total row */}
      {filtered.length > 0 && (
        <div className="flex justify-end">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-6 py-3 flex items-center gap-4">
            <span className="text-slate-500 text-sm">{t('tx.total')} ({filtered.length} {t('tx.items')})</span>
            <span className="font-bold text-slate-900 text-lg">
              {fmt(filtered.reduce((s, tx) => s + Number(tx.amount), 0))}
            </span>
          </div>
        </div>
      )}

      {deleteId && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
