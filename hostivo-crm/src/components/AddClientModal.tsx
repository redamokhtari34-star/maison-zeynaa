import { useState, type FormEvent, type ReactNode } from 'react';
import { RESEAUX_OPTIONS, STATUT_SITE_OPTIONS } from '../lib/constants';
import type { NewClientInput } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewClientInput) => Promise<void>;
  secteurs: string[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = {
  nomEntreprise: '',
  telephone: '',
  secteur: '',
  dateDemande: today(),
  statutSite: 'En attente client',
  notes: '',
};

export function AddClientModal({ open, onClose, onCreate, secteurs }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [reseaux, setReseaux] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function toggleReseau(network: string) {
    setReseaux((prev) => (prev.includes(network) ? prev.filter((n) => n !== network) : [...prev, network]));
  }

  function reset() {
    setForm(emptyForm);
    setReseaux([]);
    setError(null);
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.nomEntreprise.trim()) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        nomEntreprise: form.nomEntreprise.trim(),
        telephone: form.telephone.trim() || undefined,
        secteur: form.secteur.trim() || undefined,
        dateDemande: form.dateDemande || undefined,
        statutSite: form.statutSite || undefined,
        notes: form.notes.trim() || undefined,
        reseauxSouhaites: reseaux.length ? reseaux : undefined,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'ajout du client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div onClick={handleClose} className="fixed inset-0 z-40 bg-slate-900/40" />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-2xl">
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Nouveau client</h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fermer"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-3.5 overflow-y-auto px-5 py-4">
            <FormField label="Nom entreprise *">
              <input
                autoFocus
                value={form.nomEntreprise}
                onChange={(e) => setForm({ ...form, nomEntreprise: e.target.value })}
                className={inputCls}
                placeholder="ex. Salon Belle Vue"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Téléphone">
                <input
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  className={inputCls}
                  placeholder="06 12 34 56 78"
                />
              </FormField>
              <FormField label="Date de la demande">
                <input
                  type="date"
                  value={form.dateDemande}
                  onChange={(e) => setForm({ ...form, dateDemande: e.target.value })}
                  className={inputCls}
                />
              </FormField>
            </div>

            <FormField label="Secteur">
              <input
                value={form.secteur}
                onChange={(e) => setForm({ ...form, secteur: e.target.value })}
                className={inputCls}
                placeholder="ex. Salon de coiffure"
                list="secteurs-existants"
              />
              <datalist id="secteurs-existants">
                {secteurs.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </FormField>

            <FormField label="Réseaux souhaités">
              <div className="flex flex-wrap gap-1.5">
                {RESEAUX_OPTIONS.map((network) => {
                  const active = reseaux.includes(network);
                  return (
                    <button
                      type="button"
                      key={network}
                      onClick={() => toggleReseau(network)}
                      className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium ${
                        active
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300'
                      }`}
                    >
                      {network}
                    </button>
                  );
                })}
              </div>
            </FormField>

            <FormField label="Statut du site">
              <select
                value={form.statutSite}
                onChange={(e) => setForm({ ...form, statutSite: e.target.value })}
                className={inputCls}
              >
                {STATUT_SITE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder="Optionnel"
              />
            </FormField>

            {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</div>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-medium text-slate-600 hover:border-slate-300"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !form.nomEntreprise.trim()}
              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {saving ? 'Ajout…' : 'Créer le client'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400';

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
