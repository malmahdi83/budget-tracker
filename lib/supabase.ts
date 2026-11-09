import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Transaction = {
  id: string;
  amount: number;
  category: string;
  date: string;
  payment_method: string;
  merchant: string;
  description: string | null;
  notes: string | null;
  attachment_url: string | null;
  user_id: string | null;
  created_at: string;
};

export type TransactionInput = Omit<Transaction, 'id' | 'created_at'>;

export const STORAGE_BUCKET = 'My_transactions_attach';

export const CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Health & Fitness',
  'Utilities',
  'Housing',
  'Travel',
  'Education',
  'Personal Care',
  'Other',
];

export const PAYMENT_METHODS = [
  'Credit Card',
  'Debit Card',
  'Cash',
  'Bank Transfer',
  'Digital Wallet',
  'Other',
];

// Returns a short-lived signed URL for an attachment path, or validates legacy public URLs.
// New uploads store the storage path; old records may store a full public URL.
export async function getSignedAttachmentUrl(pathOrUrl: string): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('https://')) {
    // Backward compat: old records store full public URLs — validate they're from our bucket
    try {
      const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
      const { hostname, protocol } = new URL(pathOrUrl);
      if (protocol !== 'https:' || hostname !== host) return null;
    } catch { return null; }
    return pathOrUrl;
  }
  // New records store the storage path — generate a 1-hour signed URL
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(pathOrUrl, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#f97316',
  Transportation: '#3b82f6',
  Shopping: '#a855f7',
  Entertainment: '#ec4899',
  'Health & Fitness': '#10b981',
  Utilities: '#f59e0b',
  Housing: '#6366f1',
  Travel: '#14b8a6',
  Education: '#8b5cf6',
  'Personal Care': '#f43f5e',
  Other: '#6b7280',
};
