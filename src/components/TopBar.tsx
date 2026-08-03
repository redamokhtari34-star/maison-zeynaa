import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Bell, ShieldCheck, RefreshCw, CloudOff, X } from 'lucide-react';
import { Language, Dress, Bijou, Cliente } from '../types';

interface TopBarProps {
  language: Language;
  dresses: Dress[];
  bijoux: Bijou[];
  clientes: Cliente[];
  alertCount: number;
  syncing: boolean;
  cloudConnected: boolean;
  setCurrentTab: (tab: string) => void;
}

type Hit = { id: string; tab: string; title: string; kind: string };

export default function TopBar({
  language,
  dresses,
  bijoux,
  clientes,
  alertCount,
  syncing,
  cloudConnected,
  setCurrentTab
}: TopBarProps) {
  const isRtl = language === 'ar';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close the result list when focus moves outside the search box
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const out: Hit[] = [];
    const labels = language === 'fr'
      ? { robe: 'Robe', bijou: 'Bijou', cliente: 'Cliente' }
      : { robe: 'فستان', bijou: 'مجوهرات', cliente: 'زبونة' };

    for (const d of dresses) {
      if (d.nom.toLowerCase().includes(q) || d.categorie.toLowerCase().includes(q) || d.taille.toLowerCase().includes(q)) {
        out.push({ id: `d-${d.id}`, tab: 'robes', title: d.nom, kind: labels.robe });
      }
    }
    for (const b of bijoux) {
      if (b.nom.toLowerCase().includes(q) || b.categorie.toLowerCase().includes(q)) {
        out.push({ id: `b-${b.id}`, tab: 'bijoux', title: b.nom, kind: labels.bijou });
      }
    }
    for (const c of clientes) {
      if (c.nom_complet.toLowerCase().includes(q) || c.telephone.includes(q)) {
        out.push({ id: `c-${c.id}`, tab: 'clientes', title: c.nom_complet, kind: labels.cliente });
      }
    }
    return out.slice(0, 8);
  }, [query, dresses, bijoux, clientes, language]);

  const pick = (hit: Hit) => {
    setCurrentTab(hit.tab);
    setQuery('');
    setOpen(false);
  };

  return (
    <header
      className={`fixed top-0 z-20 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white px-4 sm:px-6 ${
        isRtl ? 'right-0 left-0 lg:right-[272px]' : 'left-0 right-0 lg:left-[272px]'
      }`}
    >
      {/* Brand (mobile shifts right of the menu button) */}
      <div className={`hidden shrink-0 sm:block ${isRtl ? 'mr-12 lg:mr-0 text-right' : 'ml-12 lg:ml-0'}`}>
        <p className="font-display text-[15px] font-semibold leading-none text-neutral-900">Maison Zeyna</p>
        <p className="eyebrow mt-1 leading-none">
          {language === 'fr' ? 'Gestion haute couture' : 'إدارة الأزياء الراقية'}
        </p>
      </div>

      {/* Global search */}
      <div ref={boxRef} className="relative mx-auto w-full max-w-xl">
        <Search
          size={17}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-neutral-400 ${isRtl ? 'right-4' : 'left-4'}`}
        />
        <input
          id="global-search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={language === 'fr' ? 'Rechercher une robe, une cliente…' : 'ابحث عن فستان أو زبونة…'}
          className={`w-full rounded-full border border-neutral-200 bg-neutral-50 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white ${
            isRtl ? 'pr-11 pl-10 text-right' : 'pl-11 pr-10'
          }`}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); }}
            aria-label={language === 'fr' ? 'Effacer' : 'مسح'}
            className={`absolute top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 ${isRtl ? 'left-3' : 'right-3'}`}
          >
            <X size={13} />
          </button>
        )}

        {open && query.trim().length >= 2 && (
          <div className={`absolute top-[calc(100%+8px)] z-30 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg ${isRtl ? 'text-right' : ''}`}>
            {hits.length === 0 ? (
              <p className="px-4 py-3.5 text-sm text-neutral-500">
                {language === 'fr' ? 'Aucun résultat.' : 'لا توجد نتائج.'}
              </p>
            ) : (
              hits.map((hit) => (
                <button
                  key={hit.id}
                  onClick={() => pick(hit)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50 ${isRtl ? 'flex-row-reverse text-right' : ''}`}
                >
                  <span className="truncate text-sm text-neutral-800">{hit.title}</span>
                  <span className="eyebrow shrink-0">{hit.kind}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Status + notifications */}
      <div className={`flex shrink-0 items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <span
          className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium md:inline-flex ${
            syncing
              ? 'border-neutral-200 bg-neutral-50 text-neutral-600'
              : cloudConnected
                ? 'border-neutral-200 bg-white text-neutral-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {syncing ? (
            <><RefreshCw size={13} className="animate-spin" />{language === 'fr' ? 'Synchronisation…' : 'جاري المزامنة…'}</>
          ) : cloudConnected ? (
            <><ShieldCheck size={13} className="text-green-600" />{language === 'fr' ? 'Données synchronisées' : 'البيانات متزامنة'}</>
          ) : (
            <><CloudOff size={13} />{language === 'fr' ? 'Mode hors ligne' : 'وضع دون اتصال'}</>
          )}
        </span>

        <button
          onClick={() => setCurrentTab('accueil')}
          aria-label={language === 'fr' ? 'Alertes' : 'التنبيهات'}
          className="relative grid h-9 w-9 place-items-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          <Bell size={16} />
          {alertCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-600 px-1 text-[10px] font-semibold text-white">
              {alertCount}
            </span>
          )}
        </button>

        <div className="grid h-9 w-9 place-items-center rounded-full bg-neutral-950 font-display text-sm text-white">
          Z
        </div>
      </div>
    </header>
  );
}
