'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Transaction, TransactionInput, CATEGORIES, PAYMENT_METHODS, STORAGE_BUCKET, getSignedAttachmentUrl } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Save, X, Paperclip, Upload, FileText, Image as ImageIcon, Trash2, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';

type Props = {
  initial?: Transaction;
  onSuccess?: () => void;
};

const empty: TransactionInput = {
  amount: 0,
  category: '',
  date: new Date().toISOString().split('T')[0],
  payment_method: '',
  merchant: '',
  description: '',
  notes: '',
  attachment_url: null,
  user_id: null,
};

export default function TransactionForm({ initial, onSuccess }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const merchantDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionCallsRef = useRef(0);

  const [form, setForm] = useState<TransactionInput>(
    initial
      ? {
          amount: initial.amount,
          category: initial.category,
          date: initial.date,
          payment_method: initial.payment_method,
          merchant: initial.merchant,
          description: initial.description ?? '',
          notes: initial.notes ?? '',
          attachment_url: initial.attachment_url ?? null,
          user_id: initial.user_id ?? null,
        }
      : empty
  );

  const [errors, setErrors] = useState<Partial<Record<keyof TransactionInput, string>>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  // Category suggestion state
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [suggestionAccepted, setSuggestionAccepted] = useState(false);

  // Resolved signed URL for existing attachment display
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  useEffect(() => {
    if (form.attachment_url) {
      getSignedAttachmentUrl(form.attachment_url).then(setResolvedUrl);
    } else {
      setResolvedUrl(null);
    }
  }, [form.attachment_url]);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Strip control chars, Unicode direction overrides, invisible chars, and cap length
  const sanitizeForLLM = (s: string, max: number) =>
    s
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/[​-‏‪-‮⁠-⁩﻿]/g, '')
      .replace(/[-]/g, '')
      .normalize('NFC')
      .slice(0, max);

  const fetchSuggestion = useCallback(async (merchant: string, description: string) => {
    if (!merchant.trim()) return;
    if (suggestionCallsRef.current >= 20) return; // cap LLM calls per page load (LLM10)
    suggestionCallsRef.current += 1;
    setSuggesting(true);
    setSuggestedCategory(null);
    setSuggestionAccepted(false);
    try {
      const res = await supabase.functions.invoke('suggest-category', {
        body: {
          // XML delimiters tell the Edge Function to treat these as data, not instructions
          merchant: '<merchant>' + sanitizeForLLM(merchant.trim(), 100) + '</merchant>',
          description: '<description>' + sanitizeForLLM(description.trim(), 200) + '</description>',
        },
      });
      if (res.error) throw res.error;
      const category: string = res.data?.category;
      if (category && CATEGORIES.includes(category)) {
        setSuggestedCategory(category);
      }
    } catch {
      // silently ignore suggestion errors — non-critical
    } finally {
      setSuggesting(false);
    }
  }, []);

  const handleMerchantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, merchant: value }));
    setSuggestedCategory(null);
    setSuggestionAccepted(false);
    if (merchantDebounceRef.current) clearTimeout(merchantDebounceRef.current);
    merchantDebounceRef.current = setTimeout(() => {
      fetchSuggestion(value, form.description ?? '');
    }, 700);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, description: value }));
    if (merchantDebounceRef.current) clearTimeout(merchantDebounceRef.current);
    merchantDebounceRef.current = setTimeout(() => {
      fetchSuggestion(form.merchant, value);
    }, 700);
  };

  const acceptSuggestion = () => {
    if (!suggestedCategory) return;
    setForm((f) => ({ ...f, category: suggestedCategory }));
    setSuggestionAccepted(true);
    setErrors((e) => ({ ...e, category: undefined }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.amount || !isFinite(form.amount) || form.amount <= 0) e.amount = 'Amount must be greater than 0';
    if (form.amount > 10_000_000) e.amount = 'Amount exceeds maximum allowed value';
    if (!form.category) e.category = 'Category is required';
    if (!form.date) e.date = 'Date is required';
    if (!form.payment_method) e.payment_method = 'Payment method is required';
    if (!form.merchant.trim()) e.merchant = 'Merchant is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
    'application/pdf': 'pdf',
  };

  const uploadFile = async (file: File): Promise<string> => {
    if (!user) throw new Error('You must be signed in to upload files.');
    setUploading(true);
    setUploadProgress(10);
    const ext = MIME_TO_EXT[file.type] ?? 'bin';
    const folder = user.id;
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    setUploadProgress(40);
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    setUploadProgress(100);
    setUploading(false);
    // Store the storage path (not a public URL) — display via signed URL generated in useEffect
    return path;
  };

  const checkMagicBytes = async (file: File): Promise<boolean> => {
    const buf = await file.slice(0, 12).arrayBuffer();
    const b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return true; // JPEG
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return true; // PNG
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true; // GIF
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return true; // PDF
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return true; // WebP
    return false;
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setServerError('Only images (JPEG, PNG, GIF, WebP, HEIC) and PDF files are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setServerError('File size must be under 10 MB.');
      return;
    }
    // Validate actual file content via magic bytes (MIME type from browser is spoofable)
    const validBytes = await checkMagicBytes(file);
    if (!validBytes && file.type !== 'image/heic' && file.type !== 'image/heif') {
      setServerError('File content does not match the expected type. Please upload a valid image or PDF.');
      return;
    }
    setServerError('');
    setSelectedFile(file);
  };

  const handleRemoveAttachment = () => {
    setSelectedFile(null);
    setForm((f) => ({ ...f, attachment_url: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      let attachmentUrl = form.attachment_url ?? null;
      if (selectedFile) attachmentUrl = await uploadFile(selectedFile);
      const payload = {
        ...form,
        description: form.description || null,
        notes: form.notes || null,
        attachment_url: attachmentUrl,
        user_id: initial ? form.user_id : (user?.id ?? null),
      };
      if (initial) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', initial.id).eq('user_id', user?.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transactions').insert(payload);
        if (error) throw error;
      }
      if (onSuccess) onSuccess();
      else router.push('/transactions');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      // Show user-friendly messages; never leak internal DB/storage details.
      if (msg.includes('sign in') || msg.includes('authenticated')) {
        setServerError('You must be signed in to save transactions.');
      } else if (msg.includes('upload') || msg.includes('storage')) {
        setServerError('File upload failed. Please check the file and try again.');
      } else {
        setServerError('Could not save transaction. Please try again.');
      }
      setUploading(false);
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof TransactionInput) => ({
    value: String(form[key] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: key === 'amount' ? parseFloat(e.target.value) || 0 : e.target.value })),
  });

  const inputCls = (key: keyof TransactionInput) =>
    `w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
      errors[key] ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
    }`;

  const isImage = (url: string) => /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(url);
  // resolvedUrl is either a validated signed URL or a host-validated legacy public URL (set via useEffect above)
  const existingAttachment = resolvedUrl;
  const previewFile = selectedFile ? URL.createObjectURL(selectedFile) : null;
  const showPreview = previewFile ?? existingAttachment;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {serverError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {serverError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="number" step="0.01" min="0" max="10000000" className={`${inputCls('amount')} pl-7`} {...field('amount')} />
          </div>
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input type="date" className={inputCls('date')} {...field('date')} />
          {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
        </div>
      </div>

      {/* Merchant — triggers AI suggestion */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Merchant <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="e.g. Starbucks"
            maxLength={100}
            className={inputCls('merchant')}
            value={form.merchant}
            onChange={handleMerchantChange}
          />
          {suggesting && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 size={15} className="text-indigo-400 animate-spin" />
            </div>
          )}
        </div>
        {errors.merchant && <p className="text-red-500 text-xs mt-1">{errors.merchant}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <input
          type="text"
          placeholder="Brief description..."
          maxLength={255}
          className={inputCls('description')}
          value={String(form.description ?? '')}
          onChange={handleDescriptionChange}
        />
      </div>

      {/* Category — with AI suggestion banner */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
          Category <span className="text-red-500">*</span>
          {suggesting && (
            <span className="flex items-center gap-1 text-xs text-indigo-500 font-normal">
              <Loader2 size={11} className="animate-spin" /> AI suggesting...
            </span>
          )}
        </label>

        {/* Suggestion banner */}
        {suggestedCategory && !suggestionAccepted && !suggesting && (
          <div className="mb-2 flex items-center justify-between gap-3 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-indigo-700">
              <Sparkles size={14} className="text-indigo-500 flex-shrink-0" />
              {/* suggestedCategory is allowlist-validated via CATEGORIES.includes() before being set — safe to render */}
              <span>AI suggests: <strong className="font-semibold">{suggestedCategory}</strong></span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={acceptSuggestion}
                className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setSuggestedCategory(null)}
                className="text-xs px-2 py-1 text-indigo-400 hover:text-indigo-600 rounded-md transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Accepted confirmation */}
        {suggestionAccepted && (
          <div className="mb-2 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
            <CheckCircle2 size={13} className="text-emerald-500" />
            AI suggestion applied
          </div>
        )}

        <select
          className={inputCls('category')}
          value={form.category}
          onChange={(e) => {
            setForm((f) => ({ ...f, category: e.target.value }));
            setSuggestionAccepted(false);
            setSuggestedCategory(null);
          }}
        >
          <option value="">Select category...</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
      </div>

      {/* Payment Method */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Payment Method <span className="text-red-500">*</span>
        </label>
        <select className={inputCls('payment_method')} {...field('payment_method')}>
          <option value="">Select method...</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {errors.payment_method && <p className="text-red-500 text-xs mt-1">{errors.payment_method}</p>}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea
          rows={3}
          placeholder="Additional notes..."
          maxLength={500}
          className={`${inputCls('notes')} resize-none`}
          value={String(form.notes ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>

      {/* Attachment */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
          <Paperclip size={14} />
          Attachment
          <span className="text-slate-400 font-normal text-xs">(image or PDF, max 10 MB)</span>
        </label>

        {!showPreview && !selectedFile && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileChange(e.dataTransfer.files[0] ?? null); }}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'
            }`}
          >
            <Upload size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-600">Drop file here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">JPEG, PNG, GIF, WebP, HEIC, PDF</p>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
          </div>
        )}

        {(selectedFile || existingAttachment) && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {selectedFile && selectedFile.type.startsWith('image/') && previewFile ? (
              <div className="bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewFile} alt="Preview" className="max-h-56 w-full object-contain" />
              </div>
            ) : existingAttachment && isImage(existingAttachment) && !selectedFile ? (
              <div className="bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={existingAttachment} alt="Attachment" className="max-h-56 w-full object-contain" />
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                {(selectedFile?.type === 'application/pdf') || (existingAttachment && existingAttachment.endsWith('.pdf')) ? (
                  <FileText size={18} className="text-red-500 flex-shrink-0" />
                ) : (
                  <ImageIcon size={18} className="text-indigo-500 flex-shrink-0" />
                )}
                <span className="text-sm text-slate-700 truncate font-medium">
                  {selectedFile ? selectedFile.name : existingAttachment?.split('/').pop()}
                </span>
                {selectedFile && <span className="text-xs text-slate-400 flex-shrink-0">{(selectedFile.size / 1024).toFixed(0)} KB</span>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {existingAttachment && !selectedFile && (
                  <a href={existingAttachment} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">View</a>
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">Replace</button>
                <button type="button" onClick={handleRemoveAttachment} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove"><Trash2 size={15} /></button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
          </div>
        )}

        {uploading && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Uploading...</span><span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || uploading}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Save size={16} />
          {uploading ? 'Uploading...' : loading ? 'Saving...' : initial ? 'Update Transaction' : 'Add Transaction'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
        >
          <X size={16} />
          Cancel
        </button>
      </div>
    </form>
  );
}
