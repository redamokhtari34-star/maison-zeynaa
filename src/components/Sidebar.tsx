import React, { useState } from 'react';
import {
  Home,
  Layers,
  Gem,
  Users,
  CalendarDays,
  Calendar,
  Wallet,
  BarChart3,
  RotateCcw,
  FileText,
  Settings,
  X,
  MoreHorizontal,
  Sparkles
} from 'lucide-react';
import { Language, Transaction } from '../types';
import { translations } from '../translations';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  transactions?: Transaction[];
}

export default function Sidebar({ currentTab, setCurrentTab, language, transactions = [] }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = translations[language];
  const isRtl = language === 'ar';

  // Treasury balance calculation
  const totalEntries = transactions
    .filter(tr => tr.type === 'entree')
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  const totalCaisseExpenses = transactions
    .filter(tr => tr.type === 'depense' && tr.source_argent !== 'tresorerie')
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  const totalEmptied = transactions
    .filter(tr => tr.type === 'vidage_caisse')
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  const caisseBalance = totalEntries - totalCaisseExpenses - totalEmptied;

  const formatDa = (amount: number) => {
    return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' DA';
  };

  // Each entry carries its own gradient so the rail reads as a colourful stack
  const menuItems = [
    { id: 'accueil', label: t.accueil, icon: Home, grad: 'from-violet-500 to-indigo-500' },
    { id: 'robes', label: t.robes, icon: Layers, grad: 'from-fuchsia-500 to-violet-500' },
    { id: 'bijoux', label: t.bijoux, icon: Gem, grad: 'from-amber-400 to-rose-500' },
    { id: 'clientes', label: t.clientes, icon: Users, grad: 'from-blue-500 to-teal-400' },
    { id: 'reservations', label: t.reservations, icon: CalendarDays, grad: 'from-indigo-500 to-blue-500' },
    { id: 'calendrier', label: (t as any).calendrier || 'Calendrier', icon: Calendar, grad: 'from-violet-500 to-fuchsia-500' },
    { id: 'caisse', label: t.caisse, icon: Wallet, grad: 'from-emerald-500 to-teal-400' },
    { id: 'statistiques', label: t.statistiques, icon: BarChart3, grad: 'from-teal-400 to-blue-500' },
    { id: 'retours', label: t.retours, icon: RotateCcw, grad: 'from-rose-500 to-amber-400' },
    { id: 'documents', label: t.documents, icon: FileText, grad: 'from-blue-500 to-indigo-500' },
    { id: 'parametres', label: t.parametres, icon: Settings, grad: 'from-neutral-500 to-neutral-700' },
  ];

  // Mobile bottom bar shows the four most-used destinations + a "more" sheet
  const primaryIds = ['accueil', 'robes', 'reservations', 'caisse'];
  const primary = menuItems.filter(m => primaryIds.includes(m.id));

  const go = (id: string) => {
    setCurrentTab(id);
    setIsOpen(false);
  };

  /* ── Desktop: floating rounded dark rail ─────────────────────────── */
  const desktopRail = (
    <div className="h-full flex flex-col gap-4">
      {/* Brand */}
      <div className="rounded-[26px] bg-neutral-950 p-5 text-white shadow-xl shadow-violet-900/20">
        <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-extrabold shadow-lg shadow-fuchsia-500/40">
            Z
          </div>
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <h1 className="font-display text-[17px] font-extrabold leading-none">Maison Zeyna</h1>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">Alger · DZ</p>
          </div>
        </div>

        {/* Treasury */}
        <button
          id="top-left-tresorerie-card"
          onClick={() => go('caisse')}
          className={`mt-5 w-full rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 p-4 shadow-lg shadow-emerald-500/30 transition-transform hover:-translate-y-0.5 ${isRtl ? 'text-right' : 'text-left'}`}
        >
          <div className={`flex items-center gap-1.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Wallet size={13} />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/85">
              {language === 'fr' ? 'Trésorerie' : 'الرصيد'}
            </span>
          </div>
          <div className="mt-1.5 font-display text-xl font-extrabold tabular-nums">{formatDa(caisseBalance)}</div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto rounded-[26px] bg-white p-3 shadow-lg shadow-neutral-300/40">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`menu-item-${item.id}`}
                onClick={() => go(item.id)}
                className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all ${
                  isActive
                    ? 'bg-neutral-950 font-bold text-white shadow-md'
                    : 'font-medium text-neutral-500 hover:bg-neutral-100'
                } ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}
              >
                <span
                  className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl transition-all ${
                    isActive
                      ? `bg-gradient-to-br ${item.grad} text-white shadow-md`
                      : 'bg-neutral-100 text-neutral-500 group-hover:bg-white'
                  }`}
                >
                  <Icon size={16} />
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Profile */}
      <div className={`flex items-center gap-3 rounded-[22px] bg-white p-3 shadow-lg shadow-neutral-300/40 ${isRtl ? 'flex-row-reverse text-right' : ''}`}>
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 font-bold text-white shadow-md shadow-fuchsia-500/30">
          Z
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-neutral-900">Zeyna</p>
          <p className="text-xs text-neutral-400">{language === 'fr' ? 'Gérante' : 'المديرة'}</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar: brand + treasury pill ─────────────────────── */}
      <header
        className={`fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-neutral-200/70 bg-white/85 px-4 backdrop-blur-xl lg:hidden ${
          isRtl ? 'flex-row-reverse' : ''
        }`}
      >
        <div className={`flex items-center gap-2.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-extrabold text-white shadow-md shadow-fuchsia-500/30">
            Z
          </div>
          <span className="font-display text-[15px] font-extrabold text-neutral-900">Maison Zeyna</span>
        </div>

        <button
          id="mobile-tresorerie-pill"
          onClick={() => setCurrentTab('caisse')}
          className={`flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 px-3 py-1.5 text-xs font-extrabold tabular-nums text-white shadow-md shadow-emerald-500/30 ${
            isRtl ? 'flex-row-reverse' : ''
          }`}
        >
          <Wallet size={13} />
          <span>{formatDa(caisseBalance)}</span>
        </button>
      </header>

      {/* ── Desktop floating rail ─────────────────────────────────────── */}
      <aside
        className={`fixed top-0 z-30 hidden h-screen w-[268px] p-4 lg:block ${isRtl ? 'right-0' : 'left-0'}`}
      >
        {desktopRail}
      </aside>

      {/* ── Mobile bottom tab bar ─────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="mx-3 mb-3 flex items-center justify-around rounded-[26px] border border-neutral-200/70 bg-white/90 p-2 shadow-2xl shadow-neutral-400/30 backdrop-blur-xl">
          {primary.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                onClick={() => go(item.id)}
                className="flex flex-1 flex-col items-center gap-1 py-1.5"
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-2xl transition-all ${
                    isActive
                      ? `bg-gradient-to-br ${item.grad} text-white shadow-lg`
                      : 'text-neutral-400'
                  }`}
                >
                  <Icon size={18} />
                </span>
                <span className={`text-[10px] font-bold ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          <button
            id="sidebar-toggle-btn"
            onClick={() => setIsOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-1.5"
          >
            <span className="grid h-9 w-9 place-items-center rounded-2xl text-neutral-400">
              <MoreHorizontal size={18} />
            </span>
            <span className="text-[10px] font-bold text-neutral-400">
              {language === 'fr' ? 'Plus' : 'المزيد'}
            </span>
          </button>
        </div>
      </nav>

      {/* ── Mobile "more" sheet ───────────────────────────────────────── */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-neutral-950/50 backdrop-blur-sm lg:hidden"
        />
      )}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-[30px] bg-white p-5 pb-8 shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className={`mb-4 flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h2 className={`flex items-center gap-2 font-display text-lg font-extrabold text-neutral-900 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Sparkles size={16} className="text-violet-500" />
            {language === 'fr' ? 'Tout le menu' : 'القائمة'}
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`menu-item-${item.id}`}
                onClick={() => go(item.id)}
                className={`flex flex-col items-center gap-2 rounded-3xl p-4 transition-all ${
                  isActive ? 'bg-neutral-950 text-white' : 'bg-neutral-50 text-neutral-600'
                }`}
              >
                <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${item.grad} text-white shadow-md`}>
                  <Icon size={19} />
                </span>
                <span className="text-[11px] font-bold leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
