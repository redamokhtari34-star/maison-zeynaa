import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { subscribeToConfirm, type ConfirmRequest } from '../lib/confirm';

type Pending = ConfirmRequest & { resolve: (ok: boolean) => void };

export default function ConfirmDialog() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => subscribeToConfirm(setPending as (p: unknown) => void), []);

  // Escape cancels, as any dialog should.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') pending.resolve(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={() => pending.resolve(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-neutral-100 p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          {pending.danger && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle size={17} />
            </span>
          )}
          <div className="min-w-0">
            <h2 id="confirm-title" className="font-display text-xl leading-snug text-neutral-900">
              {pending.title}
            </h2>
            <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-neutral-600">
              {pending.message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => pending.resolve(false)}
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            {pending.cancelLabel}
          </button>
          <button
            autoFocus
            onClick={() => pending.resolve(true)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
              pending.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {pending.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
