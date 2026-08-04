import React, { useState } from 'react';
import { Loader2, LogIn, UserPlus, AlertTriangle, MailCheck } from 'lucide-react';
import { signIn, signUp } from '../lib/auth';

type Mode = 'signin' | 'signup';

/**
 * Gate in front of the shop's records. Without it the publishable key alone
 * would give any visitor read and write access to every client and every sale.
 */
export default function Login() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        const { needsEmailConfirmation } = await signUp(email.trim(), password);
        if (needsEmailConfirmation) setConfirmSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck size={28} className="text-green-600" />
          <h2 className="font-display text-xl text-neutral-900">Vérifiez votre courriel</h2>
          <p className="text-[15px] leading-relaxed text-neutral-600">
            Un lien de confirmation vient d’être envoyé à <strong>{email}</strong>.
            Ouvrez-le, puis revenez vous connecter.
          </p>
          <button
            onClick={() => { setConfirmSent(false); setMode('signin'); }}
            className="mt-2 text-sm font-semibold text-orange-700 hover:underline"
          >
            Retour à la connexion
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <h2 className="font-display text-2xl text-neutral-900">
          {mode === 'signin' ? 'Connexion' : 'Créer un accès'}
        </h2>
        <p className="mt-1.5 text-[15px] text-neutral-500">
          {mode === 'signin'
            ? 'Accédez au showroom et à ses registres.'
            : 'Un accès par collaboratrice, pour savoir qui fait quoi.'}
        </p>
      </div>

      <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Adresse électronique</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="zeyna@maisonzeyna.dz"
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition-colors focus:border-neutral-400 focus:bg-white"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Mot de passe</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Au moins 6 caractères"
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition-colors focus:border-neutral-400 focus:bg-white"
          />
        </label>

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] leading-relaxed text-red-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-600" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" />
                : mode === 'signin' ? <LogIn size={16} /> : <UserPlus size={16} />}
          {mode === 'signin' ? 'Se connecter' : 'Créer l’accès'}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-neutral-500">
        {mode === 'signin' ? 'Pas encore d’accès ?' : 'Vous avez déjà un accès ?'}{' '}
        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
          className="font-semibold text-orange-700 hover:underline"
        >
          {mode === 'signin' ? 'En créer un' : 'Se connecter'}
        </button>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-neutral-950 font-display text-lg font-semibold text-white">
            MZ
          </div>
          <div className="text-center">
            <p className="font-display text-lg leading-none text-neutral-900">Maison Zeyna</p>
            <p className="eyebrow mt-1.5">Gestion haute couture</p>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-7">{children}</div>
      </div>
    </div>
  );
}
