import { useEffect, useState } from 'react';

type Toast = { id: number; text: string; kind: 'success' | 'error' | 'info' };

export const toast = (text: string, kind: Toast['kind'] = 'success') =>
  window.dispatchEvent(new CustomEvent<Omit<Toast, 'id'>>('app-toast', { detail: { text, kind } }));

const COLORS = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-slate-800' };

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const t = { ...(e as CustomEvent<Omit<Toast, 'id'>>).detail, id: Date.now() + Math.random() };
      setToasts(list => [...list, t]);
      setTimeout(() => setToasts(list => list.filter(x => x.id !== t.id)), 5000);
    };
    window.addEventListener('app-toast', onToast);
    return () => window.removeEventListener('app-toast', onToast);
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 print:hidden">
      {toasts.map(t => (
        <div key={t.id} className={`${COLORS[t.kind]} text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg max-w-sm`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
