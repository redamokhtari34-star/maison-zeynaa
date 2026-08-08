interface Props {
  secteurs: string[];
  statuts: string[];
  secteur: string;
  statut: string;
  modification: string;
  onSecteurChange: (v: string) => void;
  onStatutChange: (v: string) => void;
  onModificationChange: (v: string) => void;
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
  onSecteurChange,
  onStatutChange,
  onModificationChange,
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
