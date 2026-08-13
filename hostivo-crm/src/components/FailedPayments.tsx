import { useEffect, useState } from 'react';
import { fetchFailedPayments, sendPaymentReminder, deleteFailedPayment } from '../lib/stripePayments';
import type { StripePayment } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function FailedPayments({ open, onClose }: Props) {
  const [payments, setPayments] = useState<StripePayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    loadPayments();
  }, [open]);

  async function loadPayments() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFailedPayments();
      setPayments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendReminder(paymentId: string) {
    setSending(paymentId);
    try {
      await sendPaymentReminder(paymentId);
      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentId
            ? { ...p, last_reminder_sent_at: new Date().toISOString() }
            : p
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi du rappel');
    } finally {
      setSending(null);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    setDeleting(paymentId);
    try {
      await deleteFailedPayment(paymentId);
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="h-[90vh] w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-slate-900">Paiements échoués</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6l-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-[13px] text-slate-500">Chargement…</div>
        ) : payments.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-[13px] text-slate-500">
            Aucun paiement échoué
          </div>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{payment.customer_name}</p>
                    <p className="text-[12px] text-slate-500">{payment.customer_email}</p>
                    <p className="mt-1 text-[12px] text-slate-600">
                      <span className="font-medium">{(payment.amount / 100).toFixed(2)}</span>{' '}
                      {payment.currency.toUpperCase()}
                    </p>
                    {payment.failure_reason && (
                      <p className="mt-1 text-[12px] text-rose-600">{payment.failure_reason}</p>
                    )}
                    <p className="mt-2 text-[11px] text-slate-500">
                      {new Date(payment.created_at).toLocaleString('fr-FR')}
                    </p>
                    {payment.last_reminder_sent_at && (
                      <p className="mt-1 text-[11px] text-emerald-600">
                        Rappel envoyé le {new Date(payment.last_reminder_sent_at).toLocaleString('fr-FR')}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleResendReminder(payment.id)}
                      disabled={sending === payment.id}
                      className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="1" />
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {sending === payment.id ? 'Envoi…' : 'Rappeler'}
                    </button>
                    <button
                      onClick={() => handleDeletePayment(payment.id)}
                      disabled={deleting === payment.id}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-600 hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6v12M16 6v12M5 6l1 14a2 2 0 002 2h8a2 2 0 002-2l1-14" />
                      </svg>
                      {deleting === payment.id ? 'Suppression…' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
