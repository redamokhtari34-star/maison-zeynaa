import type { Client } from '../types';
import { formatDate } from '../lib/parse';
import { formatPhoneDisplay } from '../lib/phone';
import { ModificationBadge, StatusBadge } from './StatusBadge';
import { SocialLinkRow } from './SocialIcons';

export type SortKey = 'numero' | 'nomEntreprise' | 'secteur' | 'statutSite' | 'dateMiseEnLigne';

interface Props {
  clients: Client[];
  sortKey: SortKey;
  sortDir: 1 | -1;
  onSort: (key: SortKey) => void;
  onSelect: (client: Client) => void;
}

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: 'numero', label: '#' },
  { key: 'nomEntreprise', label: 'Entreprise' },
  { key: 'secteur', label: 'Secteur' },
  { key: null, label: 'Téléphone' },
  { key: null, label: 'Réseaux' },
  { key: 'statutSite', label: 'Statut site' },
  { key: 'dateMiseEnLigne', label: 'Mise en ligne' },
  { key: null, label: 'Modif.' },
];

export function ClientTable({ clients, sortKey, sortDir, onSort, onSelect }: Props) {
  if (!clients.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400 shadow-sm">
        Aucun client ne correspond à ces filtres.
      </div>
    );
  }

  return (
    <div className="max-h-[64vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1000px] border-collapse">
        <thead>
          <tr className="sticky top-0 z-10 bg-slate-50">
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                onClick={() => col.key && onSort(col.key)}
                className={`whitespace-nowrap border-b border-slate-200 px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 ${
                  col.key ? 'cursor-pointer select-none hover:text-slate-600' : ''
                }`}
              >
                {col.label}
                {col.key === sortKey && <span className="ml-1 text-slate-400">{sortDir === 1 ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect(c)}
              className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
            >
              <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{c.numero ?? '—'}</td>
              <td className="px-3 py-2.5 text-[13px] font-semibold text-slate-800">{c.nomEntreprise}</td>
              <td className="px-3 py-2.5 text-[12.5px] text-slate-500">{c.secteur || '—'}</td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[12.5px] text-slate-500">
                {formatPhoneDisplay(c.telephone)}
              </td>
              <td className="px-3 py-2.5">
                <SocialLinkRow links={c.liens} />
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge statut={c.statutSite} />
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-400">
                {c.dateMiseEnLigne ? formatDate(c.dateMiseEnLigne) : '—'}
              </td>
              <td className="px-3 py-2.5">
                <ModificationBadge statut={c.statutModification} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
