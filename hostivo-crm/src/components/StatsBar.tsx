import type { Client } from '../types';

interface Group {
  key: string;
  label: string;
  valueCls: string;
}

const GROUPS: Group[] = [
  { key: 'Mis en ligne', label: 'Mis en ligne', valueCls: 'text-emerald-600' },
  { key: 'Maquette envoyée', label: 'Maquette envoyée', valueCls: 'text-amber-600' },
  { key: 'En attente client', label: 'En attente client', valueCls: 'text-slate-500' },
  { key: 'Site en cours', label: 'Site en cours', valueCls: 'text-sky-600' },
  { key: 'Refus', label: 'Refus', valueCls: 'text-rose-600' },
];

interface Props {
  clients: Client[];
  activeStatut: string;
  onSelectStatut: (statut: string) => void;
}

export function StatsBar({ clients, activeStatut, onSelectStatut }: Props) {
  const counts = new Map<string, number>();
  for (const c of clients) counts.set(c.statutSite, (counts.get(c.statutSite) ?? 0) + 1);

  const modAFaire = clients.filter((c) => c.statutModification === 'Modification à faire').length;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      <Tile
        label="Total clients"
        value={clients.length}
        valueCls="text-indigo-600"
        active={activeStatut === ''}
        onClick={() => onSelectStatut('')}
      />
      {GROUPS.map((g) => (
        <Tile
          key={g.key}
          label={g.label}
          value={counts.get(g.key) ?? 0}
          valueCls={g.valueCls}
          active={activeStatut === g.key}
          onClick={() => onSelectStatut(activeStatut === g.key ? '' : g.key)}
        />
      ))}
      <Tile label="Modif. à faire" value={modAFaire} valueCls="text-amber-600" active={false} onClick={() => {}} className="hidden lg:block" />
    </div>
  );
}

function Tile({
  label,
  value,
  valueCls,
  active,
  onClick,
  className = '',
}: {
  label: string;
  value: number;
  valueCls: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border bg-white p-3 text-left shadow-sm transition-colors ${
        active ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-slate-200 hover:border-indigo-300'
      } ${className}`}
    >
      <div className={`font-mono text-xl font-semibold tabular-nums tracking-tight ${valueCls}`}>{value}</div>
      <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
    </button>
  );
}
