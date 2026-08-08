import type { Session, SourceMode } from '../types';

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  source: SourceMode;
  loading: boolean;
  onRefresh: () => void;
  session: Session | null;
  onChangePassword: () => void;
  onLogout: () => void;
}

export function TopBar({ query, onQueryChange, source, loading, onRefresh, session, onChangePassword, onLogout }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-white">
          H
        </div>
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-slate-900">Hostivo CRM</h1>
          <div className="text-[11.5px] text-slate-400">Suivi clients — sites &amp; réseaux sociaux</div>
        </div>
      </div>

      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <svg className="h-3.5 w-3.5 flex-none text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          type="text"
          placeholder="Rechercher une entreprise, un secteur, un téléphone…"
          className="w-full bg-transparent text-[13.5px] text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11.5px] font-medium text-slate-500 hover:border-slate-400 hover:text-slate-900 disabled:opacity-60"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${source === 'supabase' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {loading ? 'Synchronisation…' : source === 'supabase' ? 'Connecté à Supabase' : 'Mode démo'}
      </button>

      {session && (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[12px] text-slate-500">
            <span className="font-medium text-slate-700">{session.displayName}</span>
          </span>
          <button
            onClick={onChangePassword}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11.5px] font-medium text-slate-500 hover:border-slate-400 hover:text-slate-900"
          >
            Mot de passe
          </button>
          <button
            onClick={onLogout}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11.5px] font-medium text-slate-500 hover:border-rose-300 hover:text-rose-600"
          >
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}
