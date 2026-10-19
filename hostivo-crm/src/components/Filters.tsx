import { NICHES_PAR_CATEGORIE, PAYS } from '../lib/niches';

interface Props {
  secteurs: string[];
  statuts: string[];
  secteur: string;
  statut: string;
  modification: string;
  niche: string;
  pays: string;
  onSecteurChange: (v: string) => void;
  onStatutChange: (v: string) => void;
  onModificationChange: (v: string) => void;
  onNicheChange: (v: string) => void;
  onPaysChange: (v: string) => void;
  onReset: () => void;
  count: number;
  total: number;
}

const selectCls =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] text-slate-600 outline-none focus:ring-2 focus:ring-slate-400';

export function Filters({
  secteurs,
  statuts,
  secteur,
  statut,
  modification,
  niche,
  pays,
  onSecteurChange,
  onStatutChange,
  onModificationChange,
  onNicheChange,
  onPaysChange,
  onReset,
  count,
  total,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={selectCls} value={secteur} onChange={(e) => onSecteurChange(e.target.value)}>
        <option value="">Tous secteurs</option>
        {secteurs.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select className={selectCls} value={statut} onChange={(e) => onStatutChange(e.target.value)}>
        <option value="">Tous statuts</option>
        {statuts.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select className={selectCls} value={modification} onChange={(e) => onModificationChange(e.target.value)}>
        <option value="">Toute modification</option>
        <option value="Modification à faire">Modification à faire</option>
        <option value="Modification faite">Modification faite</option>
      </select>

      <select className={selectCls} value={pays} onChange={(e) => onPaysChange(e.target.value)}>
        <option value="">Tous pays</option>
        {PAYS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <select className={selectCls} value={niche} onChange={(e) => onNicheChange(e.target.value)}>
        <option value="">Toutes niches</option>
        {Object.entries(NICHES_PAR_CATEGORIE).map(([category, niches]) => (
          <optgroup key={category} label={category}>
            {niches.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <button
        onClick={onReset}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] text-slate-500 hover:border-slate-400 hover:text-slate-900"
      >
        Réinitialiser
      </button>

      <div className="ml-auto text-xs text-slate-400">
        {count} / {total} clients
      </div>
    </div>
  );
}
