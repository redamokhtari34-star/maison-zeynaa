import { NICHES_PAR_CATEGORIE, PAYS } from '../lib/niches';

interface Props {
  niche: string;
  pays: string;
  onNicheChange: (niche: string) => void;
  onPaysChange: (pays: string) => void;
}

export function NicheFilters({ niche, pays, onNicheChange, onPaysChange }: Props) {
  const allNiches = Object.values(NICHES_PAR_CATEGORIE).flat().sort();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
      <div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Pays</span>
          <select
            value={pays}
            onChange={(e) => onPaysChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">Tous les pays</option>
            {PAYS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Niche</span>
          <select
            value={niche}
            onChange={(e) => onNicheChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">Toutes les niches</option>
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
        </label>
      </div>
    </div>
  );
}
