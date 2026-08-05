import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Client, ClientUpdates } from '../types';
import { formatDate, toAbsoluteUrl } from '../lib/parse';
import { telHref, whatsappHref, formatPhoneDisplay } from '../lib/phone';
import { STATUT_MODIFICATION_OPTIONS, STATUT_SITE_OPTIONS } from '../lib/constants';
import { ModificationBadge, StatusBadge } from './StatusBadge';
import { SocialIcon } from './SocialIcons';

interface Props {
  client: Client | null;
  onClose: () => void;
  canEdit: boolean;
  onSave: (client: Client, updates: ClientUpdates) => Promise<void>;
}

interface FormState {
  statutSite: string;
  statutModification: string;
  notes: string;
  noteModification: string;
}

function toForm(client: Client): FormState {
  return {
    statutSite: client.statutSite ?? '',
    statutModification: client.statutModification ?? '',
    notes: client.notes ?? '',
    noteModification: client.noteModification ?? '',
  };
}

export function ClientDetail({ client, onClose, canEdit, onSave }: Props) {
  const [form, setForm] = useState<FormState | null>(client ? toForm(client) : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPulse, setSavedPulse] = useState(false);

  useEffect(() => {
    setForm(client ? toForm(client) : null);
    setError(null);
    setSaving(false);
    setSavedPulse(false);
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!client) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [client, onClose]);

  const open = Boolean(client);

  const dirty = useMemo(() => {
    if (!client || !form) return false;
    const original = toForm(client);
    return (Object.keys(form) as (keyof FormState)[]).some((k) => form[k] !== original[k]);
  }, [client, form]);

  async function handleSave() {
    if (!client || !form) return;
    const original = toForm(client);
    const updates: ClientUpdates = {};
    if (form.statutSite !== original.statutSite) updates.statutSite = form.statutSite;
    if (form.statutModification !== original.statutModification) updates.statutModification = form.statutModification;
    if (form.notes !== original.notes) updates.notes = form.notes;
    if (form.noteModification !== original.noteModification) updates.noteModification = form.noteModification;
    if (!Object.keys(updates).length) return;

    setSaving(true);
    setError(null);
    try {
      await onSave(client, updates);
      setSavedPulse(true);
      setTimeout(() => setSavedPulse(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-20 bg-slate-900/40 transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <div
        className={`fixed right-0 top-0 z-30 h-full w-full max-w-[440px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {client && form && (
          <div>
            <div className="border-b border-slate-200 px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-slate-900">{client.nomEntreprise}</h2>
                  <div className="text-[12.5px] text-slate-500">{client.secteur || 'Secteur non renseigné'}</div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4 px-5 pb-8 pt-4">
              <div className="flex gap-2">
                {whatsappHref(client.telephone) && (
                  <a
                    href={whatsappHref(client.telephone)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-indigo-700"
                  >
                    <SocialIcon url="wa.me" className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                )}
                {telHref(client.telephone) && (
                  <a
                    href={telHref(client.telephone)!}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] font-semibold text-slate-700 hover:border-indigo-300"
                  >
                    Appeler
                  </a>
                )}
              </div>

              {!canEdit && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
                  Édition indisponible — connectez l'écriture vers le Sheet (voir README.md, section "Modifier les
                  clients depuis l'app") pour changer le statut ou les notes directement ici.
                </div>
              )}

              {canEdit ? (
                <div className="grid grid-cols-2 gap-3.5">
                  <EditField label="Statut du site">
                    <select
                      value={form.statutSite}
                      onChange={(e) => setForm({ ...form, statutSite: e.target.value })}
                      className={selectCls}
                    >
                      {!STATUT_SITE_OPTIONS.includes(form.statutSite) && form.statutSite && (
                        <option value={form.statutSite}>{form.statutSite}</option>
                      )}
                      {STATUT_SITE_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </EditField>
                  <EditField label="Modification">
                    <select
                      value={form.statutModification}
                      onChange={(e) => setForm({ ...form, statutModification: e.target.value })}
                      className={selectCls}
                    >
                      {!STATUT_MODIFICATION_OPTIONS.includes(form.statutModification) && form.statutModification && (
                        <option value={form.statutModification}>{form.statutModification}</option>
                      )}
                      {STATUT_MODIFICATION_OPTIONS.map((s) => (
                        <option key={s || 'none'} value={s}>
                          {s || '—'}
                        </option>
                      ))}
                    </select>
                  </EditField>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Statut du site" value={<StatusBadge statut={client.statutSite} />} />
                  <Field
                    label="Modification"
                    value={client.statutModification ? <ModificationBadge statut={client.statutModification} /> : <Empty />}
                  />
                </div>
              )}

              <div className="h-px bg-slate-100" />

              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Date de demande" value={<span className="font-mono">{formatDate(client.dateDemande)}</span>} />
                <Field
                  label="Mise en ligne"
                  value={<span className="font-mono">{client.dateMiseEnLigne ? formatDate(client.dateMiseEnLigne) : '—'}</span>}
                />
                <Field label="Téléphone" value={<span className="font-mono">{formatPhoneDisplay(client.telephone)}</span>} />
                <Field label="N° dans le Sheet" value={<span className="font-mono">{client.numero ?? '—'}</span>} />
                {client.derniereMiseAJour && (
                  <Field label="Dernière mise à jour" value={<span className="font-mono">{formatDate(client.derniereMiseAJour)}</span>} />
                )}
                {client.compteDemarche && <Field label="Compte démarché" value={client.compteDemarche} />}
              </div>

              <div className="h-px bg-slate-100" />

              <Field
                label="Réseaux souhaités"
                value={client.reseauxSouhaites.length ? client.reseauxSouhaites.join(', ') : <Empty text="Aucun renseigné" />}
              />

              <div>
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Liens</div>
                {client.liens.length ? (
                  <div className="flex flex-col gap-1.5">
                    {client.liens.map((url) => (
                      <a
                        key={url}
                        href={toAbsoluteUrl(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 overflow-hidden rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12.5px] text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                      >
                        <SocialIcon url={url} className="h-3.5 w-3.5 flex-none" />
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{url}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <Empty text="Aucun lien" />
                )}
              </div>

              <div className="h-px bg-slate-100" />

              {canEdit ? (
                <>
                  <EditField label="Notes">
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={3}
                      className={textareaCls}
                      placeholder="Aucune note"
                    />
                  </EditField>
                  <EditField label="Note de modification">
                    <textarea
                      value={form.noteModification}
                      onChange={(e) => setForm({ ...form, noteModification: e.target.value })}
                      rows={2}
                      className={textareaCls}
                      placeholder="Aucune"
                    />
                  </EditField>

                  {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</div>}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={!dirty || saving}
                      className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
                    </button>
                    {savedPulse && !dirty && <span className="text-[12px] font-medium text-emerald-600">Enregistré ✓</span>}
                  </div>
                </>
              ) : (
                <>
                  <Field label="Notes" value={client.notes || <Empty text="Aucune note" />} />
                  <Field label="Note de modification" value={client.noteModification || <Empty text="Aucune" />} />
                </>
              )}
              {client.dateModification && (
                <Field label="Date de modification" value={<span className="font-mono">{formatDate(client.dateModification)}</span>} />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const selectCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400';
const textareaCls =
  'w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] leading-snug text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400';

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-[13.5px] leading-snug text-slate-700">{value}</div>
    </div>
  );
}

function Empty({ text = '—' }: { text?: string }) {
  return <span className="italic text-slate-400">{text}</span>;
}
