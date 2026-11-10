import React, { useEffect, useState } from 'react';
import { Brand, brandDb, useBrand } from '../lib/brand';
import { fileToDataUrl } from '../utils/common';
import { BrandLogo } from './BrandLogo';
import { toast } from './Toaster';

const FIELDS: { key: keyof Brand; label: string; type?: string }[] = [
  { key: 'name', label: 'Gym name' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'address', label: 'Address' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'website', label: 'Website' },
  { key: 'gstin', label: 'GSTIN / Tax ID' },
  { key: 'upiId', label: 'UPI ID (payment QR)' },
  { key: 'currency', label: 'Currency symbol' },
  { key: 'countryCode', label: 'Phone country code' },
  { key: 'taxRate', label: 'Tax rate %', type: 'number' },
  { key: 'receiptNote', label: 'Receipt footer note' },
];

export function BrandingPanel() {
  const brand = useBrand();
  const [draft, setDraft] = useState(brand);
  useEffect(() => setDraft(brand), [brand]);

  const set = (key: keyof Brand, value: string | number) => setDraft(d => ({ ...d, [key]: value }));

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) set('logoUrl', await fileToDataUrl(file, 256));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return toast('Gym name is required', 'error');
    await brandDb.update({ ...draft, name: draft.name.trim(), taxRate: Number(draft.taxRate) || 0 });
    toast('Branding saved');
  };

  const input = 'mt-1 w-full text-xs rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100';

  return (
    <form onSubmit={save} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm text-left space-y-5">
      <div>
        <h3 className="font-black text-lg text-slate-900 dark:text-slate-100">Gym Branding</h3>
        <p className="text-xs text-slate-500">Name, logo and contact details shown across the console, receipts, invoices and messages.</p>
      </div>
      <div className="flex items-center gap-4">
        <BrandLogo size={72} />
        <div className="space-y-2">
          <input type="file" accept="image/*" onChange={onLogo} className="text-xs" />
          <input
            className={input}
            placeholder="…or logo image URL"
            value={draft.logoUrl.startsWith('data:') ? '' : draft.logoUrl}
            onChange={e => set('logoUrl', e.target.value)}
          />
          {draft.logoUrl && (
            <button type="button" onClick={() => set('logoUrl', '')} className="text-xs font-bold text-rose-500">
              Remove logo
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map(({ key, label, type }) => (
          <label key={key} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {label}
            <input type={type || 'text'} className={input} value={String(draft[key])} onChange={e => set(key, e.target.value)} />
          </label>
        ))}
      </div>
      <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl">
        Save branding
      </button>
    </form>
  );
}
