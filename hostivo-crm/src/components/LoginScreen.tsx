import { useState, type FormEvent } from 'react';
import { PasswordInput } from './PasswordInput';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
}

const ACCOUNTS = [
  { value: 'jules', label: 'Jules' },
  { value: 'anis', label: 'Anis' },
  { value: 'reda', label: 'Reda' },
];

export function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState(ACCOUNTS[0].value);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-[360px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-indigo-600 font-mono text-base font-bold text-white">
            H
          </div>
          <div>
            <h1 className="text-[16px] font-semibold tracking-tight text-slate-900">Hostivo CRM</h1>
            <div className="text-[11.5px] text-slate-400">Connexion requise</div>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Identifiant</span>
            <select
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13.5px] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {ACCOUNTS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Mot de passe</span>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>

          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</div>}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="mt-1 rounded-lg bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </div>
      </form>
    </div>
  );
}
