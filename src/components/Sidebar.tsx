import React, { useState } from 'react';
import {
  LayoutGrid,
  ShoppingBag,
  Users,
  FolderHeart,
  Wallet,
  Archive,
  Gem,
  CalendarDays,
  RotateCcw,
  BarChart3,
  Settings,
  Menu,
  X,
  Download,
  Sparkles,
  Search,
  ShieldCheck
} from 'lucide-react';
import { Language, Transaction } from '../types';
import { translations } from '../translations';
import { exportDatabaseToFile } from '../lib/storage';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  transactions?: Transaction[];
}

export default function Sidebar({ currentTab, setCurrentTab, language }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exported, setExported] = useState(false);
  const t = translations[language];
  const isRtl = language === 'ar';

  const fr = language === 'fr';

  const menuItems = [
    { id: 'accueil', label: fr ? 'Tableau de bord' : 'لوحة القيادة', icon: LayoutGrid },
    { id: 'reservations', label: fr ? 'Réservations' : 'الحجوزات', icon: ShoppingBag },
    { id: 'calendrier', label: (t as any).calendrier || 'Calendrier', icon: CalendarDays },
    { id: 'retours', label: t.retours, icon: RotateCcw },
    { id: 'caisse', label: fr ? 'Finances & Caisse' : 'المالية والصندوق', icon: Wallet },
    { id: 'disponibilite', label: fr ? 'Disponibilité d’un article' : 'توفر قطعة', icon: Search },
    { id: 'clientes', label: fr ? 'Base Clientes' : 'قاعدة الزبونات', icon: Users },
    { id: 'robes', label: fr ? 'Catalogue Robes' : 'كتالوج الفساتين', icon: FolderHeart },
    { id: 'documents', label: fr ? 'Documents' : 'الوثائق', icon: Archive },
    { id: 'equipe', label: fr ? 'Équipe & Logs' : 'الفريق والسجلات', icon: ShieldCheck },
  ];

  // Kept reachable below the main menu so no feature becomes orphaned.
  const secondaryItems = [
    { id: 'bijoux', label: t.bijoux, icon: Gem },
    { id: 'statistiques', label: t.statistiques, icon: BarChart3 },
    { id: 'parametres', label: t.parametres, icon: Settings },
  ];

  const go = (id: string) => {
    setCurrentTab(id);
    setIsOpen(false);
  };

  const handleExport = () => {
    exportDatabaseToFile();
    setExported(true);
    window.setTimeout(() => setExported(false), 2600);
  };

  const panel = (
    <div className={`flex h-full flex-col bg-white ${isRtl ? 'border-l' : 'border-r'} border-neutral-200`}>
      {/* Brand */}
      <div className="px-6 pt-6 pb-5">
        <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse text-right' : ''}`}>
          <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-neutral-950 font-display text-base font-semibold text-white">
            MZ
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold leading-none text-neutral-900">Maison Zeyna</h1>
            <p className="eyebrow mt-1.5 leading-tight">
              {language === 'fr' ? 'Gestion haute couture' : 'إدارة الأزياء الراقية'}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-6 h-px bg-neutral-200" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`menu-item-${item.id}`}
                onClick={() => go(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-colors ${
                  isActive
                    ? 'border border-neutral-200 bg-neutral-100 font-semibold text-neutral-900'
                    : 'border border-transparent font-normal text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                } ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}
              >
                <Icon size={19} strokeWidth={1.6} className="flex-shrink-0 text-neutral-500" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        <p className="eyebrow mt-6 mb-2 px-3.5">{fr ? 'Plus' : 'المزيد'}</p>
        <div className="space-y-1">
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`menu-item-${item.id}`}
                onClick={() => go(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] transition-colors ${
                  isActive
                    ? 'border border-neutral-200 bg-neutral-100 font-semibold text-neutral-900'
                    : 'border border-transparent font-normal text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                } ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}
              >
                <Icon size={19} strokeWidth={1.6} className="flex-shrink-0 text-neutral-500" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer: quick help + the one orange action */}
      <div className="space-y-3 px-4 pb-5">
        <div className={`rounded-2xl border border-neutral-200 bg-neutral-50 p-4 ${isRtl ? 'text-right' : ''}`}>
          <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Sparkles size={13} className="text-neutral-500" />
            <span className="eyebrow">{language === 'fr' ? "Mode d'emploi rapide" : 'دليل سريع'}</span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
            {language === 'fr'
              ? 'Utilisez la recherche en haut pour retrouver une robe, une cliente ou une réservation.'
              : 'استخدم البحث في الأعلى للعثور على فستان أو زبونة أو حجز.'}
          </p>
        </div>

        <button
          id="export-data-btn"
          onClick={handleExport}
          className={`flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-700 ${
            isRtl ? 'flex-row-reverse' : ''
          }`}
        >
          <Download size={16} />
          {exported
            ? (language === 'fr' ? 'Sauvegarde téléchargée' : 'تم تنزيل النسخة')
            : (language === 'fr' ? 'Exporter les données' : 'تصدير البيانات')}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: menu button lives in the top bar area */}
      <button
        id="sidebar-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={language === 'fr' ? 'Ouvrir le menu' : 'فتح القائمة'}
        className={`fixed top-3.5 z-50 grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-700 lg:hidden ${
          isRtl ? 'right-4' : 'left-4'
        }`}
      >
        {isOpen ? <X size={19} /> : <Menu size={19} />}
      </button>

      {/* Desktop panel */}
      <aside
        className={`fixed top-0 z-30 hidden h-screen w-[272px] lg:block ${isRtl ? 'right-0' : 'left-0'}`}
      >
        {panel}
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-neutral-950/40 lg:hidden"
        />
      )}
      <aside
        className={`fixed top-0 z-40 h-full w-[272px] transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'
        } ${isRtl ? 'right-0' : 'left-0'}`}
      >
        {panel}
      </aside>
    </>
  );
}
