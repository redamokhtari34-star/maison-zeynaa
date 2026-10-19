import { useMemo } from 'react';
import { NICHES_PAR_CATEGORIE } from '../lib/niches';
import type { Client } from '../types';

interface Props {
  clients: Client[];
  open: boolean;
  onClose: () => void;
}

export function NichesOverview({ clients, open, onClose }: Props) {
  const stats = useMemo(() => {
    const nicheCounts = new Map<string, number>();
    clients.forEach((c) => {
      if (c.niche) {
        nicheCounts.set(c.niche, (nicheCounts.get(c.niche) || 0) + 1);
      }
    });

    return Object.entries(NICHES_PAR_CATEGORIE).map(([category, niches]) => ({
      category,
      niches: niches.map((niche) => ({
        niche,
        count: nicheCounts.get(niche) || 0,
      })),
      total: niches.reduce((sum, n) => sum + (nicheCounts.get(n) || 0), 0),
    }));
  }, [clients]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="h-[90vh] w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-slate-900">Aperçu des niches</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6l-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {stats.map(({ category, niches, total }) => (
            <div key={category} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 flex items-center justify-between text-[14px] font-semibold text-slate-900">
                {category}
                <span className="text-[12px] font-medium text-slate-500">{total} clients</span>
              </h3>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {niches.map(({ niche, count }) => (
                  <div
                    key={niche}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                      count > 0
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    <div className="font-medium">{niche}</div>
                    <div className="text-[10px] text-opacity-70">{count} client{count !== 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[12px] text-slate-600">
            <span className="font-medium">{stats.reduce((sum, s) => sum + s.total, 0)}</span> clients assignés sur{' '}
            <span className="font-medium">{Object.values(NICHES_PAR_CATEGORIE).flat().length}</span> niches possibles
          </p>
        </div>
      </div>
    </div>
  );
}
