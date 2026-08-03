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
  Menu, 
  X,
  Crown
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

export default function Sidebar({ currentTab, setCurrentTab, language, setLanguage, transactions = [] }: SidebarProps) {
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

  const menuItems = [
    { id: 'accueil', label: t.accueil, icon: Home },
    { id: 'robes', label: t.robes, icon: Layers },
    { id: 'bijoux', label: t.bijoux, icon: Gem },
    { id: 'clientes', label: t.clientes, icon: Users },
    { id: 'reservations', label: t.reservations, icon: CalendarDays },
    { id: 'calendrier', label: (t as any).calendrier || 'Calendrier', icon: Calendar },
    { id: 'caisse', label: t.caisse, icon: Wallet },
    { id: 'statistiques', label: t.statistiques, icon: BarChart3 },
    { id: 'retours', label: t.retours, icon: RotateCcw },
    { id: 'documents', label: t.documents, icon: FileText },
    { id: 'parametres', label: t.parametres, icon: Settings },
  ];

  const activeClass = 'bg-violet-100/90 text-violet-700 font-semibold rounded-[20px] shadow-sm';
  const inactiveClass = 'text-gray-500 hover:bg-gray-50/80 hover:text-gray-900 rounded-[20px] transition-all duration-200';

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-6 bg-white border-r border-gray-200/80 shadow-sm overflow-y-auto">
      {/* Brand Logo & Name */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-fuchsia-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
            Z
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-500 font-sans">Maison Zeyna</h1>
            <p className="text-[10px] text-violet-500 uppercase font-semibold tracking-wider font-mono">Alger, DZ 🇩🇿</p>
          </div>
        </div>

        {/* Treasury Widget (Top-Left Sidebar) */}
        <button
          id="top-left-tresorerie-card"
          onClick={() => {
            setCurrentTab('caisse');
            setIsOpen(false);
          }}
          className={`w-full mb-6 p-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl shadow-md hover:shadow-lg hover:brightness-105 transition-all group cursor-pointer ${
            isRtl ? 'text-right' : 'text-left'
          }`}
        >
          <div className={`flex items-center justify-between mb-1.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-1.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="p-1 bg-white/20 rounded-lg">
                <Wallet size={14} className="text-white" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-100">
                {language === 'fr' ? 'Trésorerie / Caisse' : 'الرصيد / الصندوق'}
              </span>
            </div>
            <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold group-hover:bg-white/30 transition-colors">
              {language === 'fr' ? 'Caisse' : 'الصندوق'}
            </span>
          </div>
          <div className="text-lg font-black tracking-tight font-mono text-white">
            {formatDa(caisseBalance)}
          </div>
        </button>

        {/* Menu Items */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`menu-item-${item.id}`}
                onClick={() => {
                  setCurrentTab(item.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-[20px] text-sm font-medium cursor-pointer transition-all ${
                  isActive ? activeClass : inactiveClass
                } ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}
              >
                <Icon size={18} className={isActive ? 'text-violet-700' : 'text-gray-400 group-hover:text-violet-600'} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Profile */}
      <div className="pt-6 border-t border-gray-200/80 mt-6">
        <div className={`flex items-center gap-3 p-2.5 bg-slate-50 rounded-2xl ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-500 to-fuchsia-400 flex items-center justify-center text-white font-bold text-base shadow-sm">
            Z
          </div>
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <p className="text-sm font-semibold text-gray-900 leading-tight">Zeyna</p>
            <p className="text-xs text-gray-500">Gérante</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header */}
      <header className={`lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200/80 flex items-center justify-between px-4 z-40 ${
        isRtl ? 'flex-row-reverse' : ''
      }`}>
        <div className={`flex items-center gap-2.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className="p-1.5 bg-gradient-to-tr from-violet-600 to-fuchsia-500 rounded-lg text-white">
            <Crown size={16} />
          </div>
          <span className="font-bold text-gray-900 text-sm hidden sm:inline">Maison Zeyna</span>
          <button
            id="mobile-tresorerie-pill"
            onClick={() => setCurrentTab('caisse')}
            className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-1 rounded-xl text-xs font-black font-mono hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <Wallet size={13} className="text-emerald-600" />
            <span>{formatDa(caisseBalance)}</span>
          </button>
        </div>
        
        <button
          id="sidebar-toggle-btn"
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-600 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Desktop Sidebar (Floating/Fixed) */}
      <aside className={`hidden lg:block fixed top-0 bottom-0 w-72 h-screen z-30 transition-all ${
        isRtl ? 'right-0 border-l border-gray-200/80' : 'left-0 border-r border-gray-200/80'
      }`}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity duration-300"
        />
      )}

      {/* Mobile Drawer Menu */}
      <aside className={`lg:hidden fixed top-0 bottom-0 w-72 h-full bg-white z-50 transition-all duration-300 ease-out shadow-2xl ${
        isOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'
      } ${isRtl ? 'right-0' : 'left-0'}`}>
        {sidebarContent}
      </aside>
    </>
  );
}

