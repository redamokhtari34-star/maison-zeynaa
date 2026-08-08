import type { StatutModification, StatutSite } from '../types';

const STATUT_STYLES: Record<string, string> = {
  'Mis en ligne': 'bg-emerald-50 text-emerald-700',
  'Site fini': 'bg-blue-50 text-blue-700',
  'En attente client': 'bg-slate-100 text-slate-600',
  'Maquette envoyée': 'bg-amber-50 text-amber-700',
  Refus: 'bg-rose-50 text-rose-700',
  'Site en cours': 'bg-violet-50 text-violet-700',
  'Site à faire': 'bg-orange-50 text-orange-700',
};

const DOT_STYLES: Record<string, string> = {
  'Mis en ligne': 'bg-emerald-500',
  'Site fini': 'bg-blue-500',
  'En attente client': 'bg-slate-400',
  'Maquette envoyée': 'bg-amber-500',
  Refus: 'bg-rose-500',
  'Site en cours': 'bg-violet-500',
  'Site à faire': 'bg-orange-500',
};

export function StatusBadge({ statut }: { statut: StatutSite }) {
  const label = statut && statut.trim() ? statut : 'Non renseigné';
  const cls = STATUT_STYLES[label] ?? 'bg-slate-100 text-slate-600';
  const dot = DOT_STYLES[label] ?? 'bg-slate-400';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function ModificationBadge({ statut }: { statut: StatutModification | undefined }) {
  if (!statut || !statut.trim()) return null;
  const done = statut.toLowerCase().includes('faite');
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${
        done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {done ? 'Faite' : 'À faire'}
    </span>
  );
}
