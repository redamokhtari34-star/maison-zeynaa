import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { Toast, subscribe, dismiss } from '../lib/toast';

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map(toast => {
        const tone =
          toast.kind === 'error' ? 'border-red-200 bg-red-50' :
          toast.kind === 'success' ? 'border-green-200 bg-green-50' :
          'border-neutral-200 bg-white';
        const iconTone =
          toast.kind === 'error' ? 'text-red-600' :
          toast.kind === 'success' ? 'text-green-600' :
          'text-neutral-500';
        const Icon =
          toast.kind === 'error' ? AlertTriangle :
          toast.kind === 'success' ? CheckCircle2 :
          Info;

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-2xl border p-4 shadow-lg ${tone}`}
          >
            <Icon size={17} className={`mt-0.5 shrink-0 ${iconTone}`} />
            <p className="flex-1 text-[13px] leading-relaxed text-neutral-800">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Fermer"
              className="shrink-0 rounded-lg p-0.5 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
