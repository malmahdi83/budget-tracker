'use client';

import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function PaymentErrorPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 max-w-md w-full text-center space-y-5">
        <XCircle size={56} className="mx-auto text-red-400" />
        <h1 className="text-xl font-bold text-slate-900">Payment Cancelled</h1>
        <p className="text-slate-500 text-sm">
          Your payment was not completed. You have not been charged.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/"
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Try Again
          </Link>
        </div>
      </div>
    </div>
  );
}
