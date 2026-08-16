import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck, Activity, UserRound } from 'lucide-react';
import { Language, HistoriqueAction } from '../types';

interface EquipeProps {
  language: Language;
  history: HistoriqueAction[];
}

export default function Equipe({ language, history }: EquipeProps) {
  const isRtl = language === 'ar';
  const [search, setSearch] = useState('');
  const [who, setWho] = useState<string>('tous');

  // The team is whoever actually appears in the log — no invented roster.
  const members = useMemo(() => {
    const counts = new Map<string, { n: number; last: string }>();
    history.forEach(h => {
      const prev = counts.get(h.utilisateur);
      counts.set(h.utilisateur, {
        n: (prev?.n ?? 0) + 1,
        last: prev?.last && prev.last > `${h.date} ${h.heure}` ? prev.last : `${h.date} ${h.heure}`
      });
    });
    return [...counts.entries()]
      .map(([nom, v]) => ({ nom, ...v }))
      .sort((a, b) => b.n - a.n);
  }, [history]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter(h => {
      if (who !== 'tous' && h.utilisateur !== who) return false;
      if (!q) return true;
      return (
        h.action.toLowerCase().includes(q) ||
        h.details.toLowerCase().includes(q) ||
        h.utilisateur.toLowerCase().includes(q)
      );
    });
  }, [history, search, who]);

  return (
    <div className={`mx-auto max-w-[1200px] space-y-6 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Head */}
      <div>
        <h2 className="font-display text-[2rem] leading-tight text-neutral-900">
          {language === 'fr' ? 'Équipe & Logs' : 'الفريق والسجلات'}
        </h2>
        <p className="mt-1 text-[15px] text-neutral-500">
          {language === 'fr'
            ? "Qui a fait quoi, et quand — l'historique complet des opérations du showroom."
            : 'من قام بماذا ومتى — السجل الكامل لعمليات الصالة.'}
        </p>
      </div>

      {/* Team */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {members.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-100 px-5 py-4 sm:col-span-3">
            <p className="text-[15px] italic text-neutral-400">
              {language === 'fr' ? 'Aucune activité enregistrée pour le moment.' : 'لا يوجد نشاط مسجل حالياً.'}
            </p>
          </div>
        ) : (
          members.map(m => (
            <div key={m.nom} className="rounded-2xl border border-neutral-200 bg-neutral-100 p-5">
              <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600 font-display text-sm text-white">
                  {m.nom.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{m.nom}</p>
                  <p className="eyebrow mt-0.5">{language === 'fr' ? 'Collaboratrice' : 'موظفة'}</p>
                </div>
              </div>
              <div className={`mt-4 flex items-baseline gap-1.5 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                <span className="figure text-2xl text-neutral-900">{m.n}</span>
                <span className="text-xs text-neutral-500">
                  {language === 'fr' ? 'opérations' : 'عملية'}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-neutral-500">
                {language === 'fr' ? 'Dernière : ' : 'الأخيرة: '}{m.last}
              </p>
            </div>
          ))
        )}
      </section>

      {/* Log */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-100">
        <div className={`flex flex-col gap-3 border-b border-neutral-200 p-5 sm:flex-row sm:items-center sm:justify-between ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
          <h3 className={`flex items-center gap-2 text-base text-neutral-900 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Activity size={16} className="text-neutral-400" />
            {language === 'fr' ? "Journal d'activité" : 'سجل النشاط'}
            <span className="eyebrow">({filtered.length})</span>
          </h3>

          <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="relative">
              <Search size={15} className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-neutral-400 ${isRtl ? 'right-3' : 'left-3'}`} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={language === 'fr' ? 'Rechercher…' : 'بحث…'}
                className={`w-48 rounded-xl border border-neutral-200 bg-neutral-50 py-2 text-sm outline-none focus:border-neutral-400 focus:bg-neutral-100 ${isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3'}`}
              />
            </div>
            <select
              value={who}
              onChange={(e) => setWho(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-neutral-400"
            >
              <option value="tous">{language === 'fr' ? 'Tout le monde' : 'الجميع'}</option>
              {members.map(m => (
                <option key={m.nom} value={m.nom}>{m.nom}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="p-5 text-[15px] italic text-neutral-400">
            {language === 'fr' ? 'Aucune opération ne correspond.' : 'لا توجد عملية مطابقة.'}
          </p>
        ) : (
          <div className="max-h-[560px] divide-y divide-neutral-200 overflow-y-auto">
            {filtered.map(log => (
              <div key={log.id} className={`flex gap-3 p-4 ${isRtl ? 'flex-row-reverse text-right' : ''}`}>
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-500">
                  <ShieldCheck size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`flex flex-wrap items-baseline justify-between gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <h4 className="text-[13px] font-semibold text-neutral-900">{log.action}</h4>
                    <span className="text-[11px] tabular-nums text-neutral-400">{log.date} · {log.heure}</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{log.details}</p>
                  <span className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <UserRound size={11} />
                    {log.utilisateur}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
