import { useState, type FormEvent, type ReactNode } from 'react';
import { checkPassword, passwordIsValid, PASSWORD_MIN_LENGTH } from '../lib/auth';
import { PasswordInput } from './PasswordInput';

interface Props {
  displayName: string;
  forced: boolean;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  onCancel?: () => void;
}

export function ChangePasswordScreen({ displayName, forced, onSubmit, onCancel }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const check = checkPassword(newPassword);
  const valid = passwordIsValid(newPassword);
  const matches = newPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError('Le mot de passe ne respecte pas tous les critères ci-dessous.');
      return;
    }
    if (!matches) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(currentPassword, newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du changement de mot de passe.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-[380px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              title="Retour"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
        <h1 className="text-[16px] font-semibold tracking-tight text-slate-900">
          {forced ? 'Choisissez votre mot de passe' : 'Changer le mot de passe'}
        </h1>
        <p className="mt-1 text-[12.5px] text-slate-500">
          {forced
            ? `Bonjour ${displayName} — pour continuer, remplacez le mot de passe temporaire par le vôtre.`
            : `Connecté en tant que ${displayName}.`}
        </p>

        <div className="mt-4 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
              Mot de passe {forced ? 'temporaire' : 'actuel'}
            </span>
            <PasswordInput autoFocus value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Nouveau mot de passe</span>
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Confirmer le nouveau mot de passe</span>
            <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            {confirmPassword.length > 0 && !matches && <span className="text-[11px] text-rose-600">Ne correspond pas.</span>}
          </label>

          <ul className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <Rule ok={check.minLength}>{PASSWORD_MIN_LENGTH} caractères minimum</Rule>
            <Rule ok={check.hasUpper}>Une majuscule</Rule>
            <Rule ok={check.hasDigit}>Un chiffre</Rule>
            <Rule ok={check.hasSpecial}>Un caractère spécial</Rule>
          </ul>

          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</div>}

          <div className="mt-1 flex items-center gap-2">
            {!forced && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:border-slate-300"
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !valid || !matches || !currentPassword}
              className="flex-1 rounded-lg bg-slate-900 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {saving ? 'Enregistrement…' : 'Valider le nouveau mot de passe'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 text-[12px] ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
      <span
        className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full ${ok ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}
      >
        {ok && (
          <svg className="h-2 w-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      {children}
    </li>
  );
}
