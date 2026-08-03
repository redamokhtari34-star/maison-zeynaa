import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  RotateCcw, 
  Layers, 
  Gem, 
  PlusCircle, 
  UserPlus, 
  DollarSign, 
  Clock, 
  FileSpreadsheet, 
  TrendingUp, 
  AlertTriangle,
  Users,
  BarChart3,
  Coins,
  Settings,
  Activity,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import { Language } from '../types';
import { translations } from '../translations';

interface DashboardProps {
  db: ReturnType<typeof import('../lib/storage').getFullDatabaseState>;
  setCurrentTab: (tab: string) => void;
  language: Language;
  onOpenQuickAction?: (action: string) => void;
}

export default function Dashboard({ db, setCurrentTab, language, onOpenQuickAction }: DashboardProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const todayStr = '2026-07-21'; // App static date for calculation consistency

  // Calculating stats based on real/seeded state
  const transactionsToday = db.transactions.filter(tr => tr.date === todayStr);
  const incomeToday = transactionsToday
    .filter(tr => tr.type === 'entree')
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  const monthStr = todayStr.substring(0, 7); // '2026-07'
  const incomeMonth = db.transactions
    .filter(tr => tr.date.startsWith(monthStr) && tr.type === 'entree')
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  const upcomingReservations = db.reservations.filter(r => r.statut === 'future').length;
  
  const returnsToday = db.reservations.filter(r => 
    r.date_retour === todayStr && (r.statut === 'en_cours' || r.statut === 'en_retard')
  ).length;

  const totalDresses = db.dresses.length;
  const availableDresses = db.dresses.filter(d => d.statut === 'disponible').length;
  const rentedDresses = db.dresses.filter(d => d.statut === 'en_location' || d.statut === 'reservee').length;

  // Compile alert messages
  const alerts: Array<{ id: string; type: 'error' | 'warning' | 'info'; text: string; clientName?: string; phone?: string }> = [];

  // Late returns
  db.reservations.forEach(r => {
    if (r.statut === 'en_retard') {
      const client = db.clientes.find(c => c.id === r.cliente_id);
      const dressNames = r.items.map(i => i.nom_article).join(', ');
      alerts.push({
        id: `alert-late-${r.id}`,
        type: 'error',
        text: language === 'fr' 
          ? `Retour en retard: ${client?.nom_complet || 'Inconnu'} pour "${dressNames}" (Prévu le ${r.date_retour})`
          : `إرجاع متأخر: ${client?.nom_complet || 'مجهول'} بخصوص "${dressNames}" (كان مقرراً في ${r.date_retour})`,
        clientName: client?.nom_complet,
        phone: client?.telephone
      });
    }
  });

  // Returns scheduled for today
  db.reservations.forEach(r => {
    if (r.date_retour === todayStr && r.statut === 'en_cours') {
      const client = db.clientes.find(c => c.id === r.cliente_id);
      const dressNames = r.items.map(i => i.nom_article).join(', ');
      alerts.push({
        id: `alert-today-${r.id}`,
        type: 'warning',
        text: language === 'fr'
          ? `Retour prévu aujourd'hui: ${client?.nom_complet || 'Inconnu'} pour "${dressNames}"`
          : `إرجاع مستحق اليوم: ${client?.nom_complet || 'مجهول'} بخصوص "${dressNames}"`,
        clientName: client?.nom_complet,
        phone: client?.telephone
      });
    }
  });

  // Future bookings starting tomorrow or soon
  const soonStr = '2026-07-25';
  db.reservations.forEach(r => {
    if (r.date_sortie > todayStr && r.date_sortie <= soonStr && r.statut === 'future') {
      const client = db.clientes.find(c => c.id === r.cliente_id);
      const dressNames = r.items.map(i => i.nom_article).join(', ');
      alerts.push({
        id: `alert-soon-${r.id}`,
        type: 'info',
        text: language === 'fr'
          ? `Réservation proche (${r.date_sortie}): ${client?.nom_complet || 'Inconnu'} pour "${dressNames}"`
          : `حجز قريب (${r.date_sortie}): ${client?.nom_complet || 'مجهول'} بخصوص "${dressNames}"`,
        clientName: client?.nom_complet,
        phone: client?.telephone
      });
    }
  });

  // Helper formatting numbers with thousands separator
  const formatDa = (amount: number) => {
    return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' ' + t.currency;
  };

  const getHistoryIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('robe')) {
      return {
        icon: <Sparkles size={16} />,
        bg: 'bg-purple-100 text-purple-600 border border-purple-200/50'
      };
    }
    if (act.includes('bijou') || act.includes('accessoire')) {
      return {
        icon: <Gem size={16} />,
        bg: 'bg-fuchsia-100 text-fuchsia-600 border border-fuchsia-200/50'
      };
    }
    if (act.includes('réservation') || act.includes('location') || act.includes('contrat')) {
      return {
        icon: <Calendar size={16} />,
        bg: 'bg-blue-100 text-blue-600 border border-blue-200/50'
      };
    }
    if (act.includes('retour')) {
      return {
        icon: <RotateCcw size={16} />,
        bg: 'bg-amber-100 text-amber-600 border border-amber-200/50'
      };
    }
    if (act.includes('paiement') || act.includes('caisse') || act.includes('entrée') || act.includes('vidage')) {
      return {
        icon: <Coins size={16} />,
        bg: 'bg-emerald-100 text-emerald-600 border border-emerald-200/50'
      };
    }
    if (act.includes('dépense') || act.includes('sortie')) {
      return {
        icon: <ArrowDownRight size={16} />,
        bg: 'bg-rose-100 text-rose-600 border border-rose-200/50'
      };
    }
    if (act.includes('cliente')) {
      return {
        icon: <UserPlus size={16} />,
        bg: 'bg-indigo-100 text-indigo-600 border border-indigo-200/50'
      };
    }
    if (act.includes('paramètre') || act.includes('réinitialisation')) {
      return {
        icon: <Settings size={16} />,
        bg: 'bg-slate-200 text-slate-700 border border-slate-300'
      };
    }
    return {
      icon: <Activity size={16} />,
      bg: 'bg-slate-100 text-slate-600 border border-slate-200/50'
    };
  };

  return (
    <div className={`space-y-8 p-1 sm:p-2 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header section */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm ${
        isRtl ? 'sm:flex-row-reverse' : ''
      }`}>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t.welcome}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'fr' 
              ? 'Gérez sereinement votre magasin de location de robes traditionnelles algériennes de luxe.' 
              : 'قم بإدارة صالون تأجير الفساتين الفاخرة التقليدية الجزائرية بكل سهولة واحترافية.'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-violet-50 text-violet-700 px-4 py-2.5 rounded-2xl text-sm font-semibold border border-violet-100">
          <Calendar size={16} />
          <span>{language === 'fr' ? 'Mardi 21 Juillet 2026' : 'الثلاثاء 21 جويلية 2026'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Today Revenue */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
          className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm hover:shadow-md hover:border-violet-200/50 transition-all duration-200 group"
        >
          <div className={`flex justify-between items-start mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-semibold text-gray-500">{t.today_revenue}</span>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className={`flex items-baseline gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-2xl font-bold text-gray-900">{formatDa(incomeToday)}</span>
          </div>
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-2 inline-block">
            {language === 'fr' ? 'Aujourd’hui' : 'اليوم'}
          </span>
        </motion.div>

        {/* Card 2: Month Revenue */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
          className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm hover:shadow-md hover:border-violet-200/50 transition-all duration-200 group"
        >
          <div className={`flex justify-between items-start mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-semibold text-gray-500">{t.month_revenue}</span>
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl group-hover:scale-110 transition-transform">
              <DollarSign size={18} />
            </div>
          </div>
          <div className={`flex items-baseline gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-2xl font-bold text-gray-900">{formatDa(incomeMonth)}</span>
          </div>
          <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md mt-2 inline-block">
            {language === 'fr' ? 'Juillet 2026' : 'جويلية 2026'}
          </span>
        </motion.div>

        {/* Card 3: Upcoming Reservations */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
          className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm hover:shadow-md hover:border-violet-200/50 transition-all duration-200 group"
        >
          <div className={`flex justify-between items-start mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-semibold text-gray-500">{t.upcoming_reservations}</span>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
              <Calendar size={18} />
            </div>
          </div>
          <div className={`flex items-baseline gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-3xl font-extrabold text-gray-900">{upcomingReservations}</span>
          </div>
          <span className="text-xs text-gray-400 mt-2 block">{language === 'fr' ? 'Confirmées par acompte' : 'مؤكدة بالعربون'}</span>
        </motion.div>

        {/* Card 4: Returns Today */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.2 }}
          className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm hover:shadow-md hover:border-violet-200/50 transition-all duration-200 group"
        >
          <div className={`flex justify-between items-start mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-semibold text-gray-500">{t.returns_today}</span>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <RotateCcw size={18} />
            </div>
          </div>
          <div className={`flex items-baseline gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-3xl font-extrabold text-gray-900">{returnsToday}</span>
          </div>
          <span className="text-xs text-gray-400 mt-2 block">{language === 'fr' ? 'Restitution prévue' : 'متوقعة للاسترجاع'}</span>
        </motion.div>

        {/* Card 5: Available Dresses */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.25 }}
          className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm hover:shadow-md hover:border-violet-200/50 transition-all duration-200 group"
        >
          <div className={`flex justify-between items-start mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-semibold text-gray-500">{t.available_dresses}</span>
            <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-xl group-hover:scale-110 transition-transform">
              <Layers size={18} />
            </div>
          </div>
          <div className={`flex items-baseline gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-3xl font-extrabold text-gray-900">{availableDresses}</span>
            <span className="text-xs text-gray-400">/ {totalDresses}</span>
          </div>
          <span className="text-xs text-gray-400 mt-2 block">{language === 'fr' ? 'Prêtes pour location' : 'جاهزة للإيجار'}</span>
        </motion.div>

        {/* Card 6: Rented Dresses */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.3 }}
          className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm hover:shadow-md hover:border-violet-200/50 transition-all duration-200 group"
        >
          <div className={`flex justify-between items-start mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-semibold text-gray-500">{t.rented_dresses}</span>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <Clock size={18} />
            </div>
          </div>
          <div className={`flex items-baseline gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-3xl font-extrabold text-gray-900">{rentedDresses}</span>
          </div>
          <span className="text-xs text-gray-400 mt-2 block">{language === 'fr' ? 'Sorties ou réservées' : 'خارجة أو محجوزة'}</span>
        </motion.div>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">{t.quick_actions}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <button
            id="qa-new-res-btn"
            onClick={() => onOpenQuickAction?.('reservation')}
            className={`flex items-center gap-4 p-4 rounded-[16px] bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/10 hover:shadow-violet-600/20 hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group ${
              isRtl ? 'flex-row-reverse text-right' : 'text-left'
            }`}
          >
            <div className="p-3 bg-white/15 text-white rounded-[12px] group-hover:scale-110 transition-transform flex-shrink-0">
              <PlusCircle size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight leading-tight">{t.qa_new_reservation}</span>
              <span className="text-[10px] text-white/70 font-medium mt-1">
                {language === 'fr' ? 'Créer un contrat' : 'إنشاء عقد جديد'}
              </span>
            </div>
          </button>

          <button
            id="qa-add-dress-btn"
            onClick={() => onOpenQuickAction?.('robe')}
            className={`flex items-center gap-4 p-4 rounded-[16px] bg-white border border-gray-200/80 shadow-sm hover:border-violet-400 hover:shadow-md hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group ${
              isRtl ? 'flex-row-reverse text-right' : 'text-left'
            }`}
          >
            <div className="p-3 bg-violet-50 text-violet-600 rounded-[12px] group-hover:scale-110 transition-transform flex-shrink-0">
              <Layers size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-gray-800 leading-tight truncate group-hover:text-violet-600 transition-colors">
                {t.qa_add_dress}
              </span>
              <span className="text-[10px] text-gray-400 font-medium mt-1">
                {language === 'fr' ? 'Nouveau modèle' : 'موديل جديد'}
              </span>
            </div>
          </button>

          <button
            id="qa-add-bijou-btn"
            onClick={() => onOpenQuickAction?.('bijou')}
            className={`flex items-center gap-4 p-4 rounded-[16px] bg-white border border-gray-200/80 shadow-sm hover:border-fuchsia-400 hover:shadow-md hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group ${
              isRtl ? 'flex-row-reverse text-right' : 'text-left'
            }`}
          >
            <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-[12px] group-hover:scale-110 transition-transform flex-shrink-0">
              <Gem size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-gray-800 leading-tight truncate group-hover:text-fuchsia-600 transition-colors">
                {t.qa_add_bijou}
              </span>
              <span className="text-[10px] text-gray-400 font-medium mt-1">
                {language === 'fr' ? 'Accessoire' : 'إضافة مجوهرات'}
              </span>
            </div>
          </button>

          <button
            id="qa-add-expense-btn"
            onClick={() => onOpenQuickAction?.('depense')}
            className={`flex items-center gap-4 p-4 rounded-[16px] bg-white border border-gray-200/80 shadow-sm hover:border-rose-400 hover:shadow-md hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group ${
              isRtl ? 'flex-row-reverse text-right' : 'text-left'
            }`}
          >
            <div className="p-3 bg-rose-50 text-rose-600 rounded-[12px] group-hover:scale-110 transition-transform flex-shrink-0">
              <ArrowDownRight size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-gray-800 leading-tight truncate group-hover:text-rose-600 transition-colors">
                {t.qa_add_expense}
              </span>
              <span className="text-[10px] text-gray-400 font-medium mt-1">
                {language === 'fr' ? 'Saisir un frais' : 'تسجيل مصاريف'}
              </span>
            </div>
          </button>

          <button
            id="qa-return-rental-btn"
            onClick={() => setCurrentTab('retours')}
            className={`flex items-center gap-4 p-4 rounded-[16px] bg-white border border-gray-200/80 shadow-sm hover:border-amber-400 hover:shadow-md hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group ${
              isRtl ? 'flex-row-reverse text-right' : 'text-left'
            }`}
          >
            <div className="p-3 bg-amber-50 text-amber-600 rounded-[12px] group-hover:scale-110 transition-transform flex-shrink-0">
              <RotateCcw size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-gray-800 leading-tight truncate group-hover:text-amber-600 transition-colors">
                {t.qa_return_rental}
              </span>
              <span className="text-[10px] text-gray-400 font-medium mt-1">
                {language === 'fr' ? 'Gérer un retour' : 'إدارة الإرجاع'}
              </span>
            </div>
          </button>

          <button
            id="qa-view-calendar-btn"
            onClick={() => setCurrentTab('calendrier')}
            className={`flex items-center gap-4 p-4 rounded-[16px] bg-white border border-gray-200/80 shadow-sm hover:border-indigo-400 hover:shadow-md hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group ${
              isRtl ? 'flex-row-reverse text-right' : 'text-left'
            }`}
          >
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-[12px] group-hover:scale-110 transition-transform flex-shrink-0">
              <Calendar size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-gray-800 leading-tight truncate group-hover:text-indigo-600 transition-colors">
                {t.qa_view_calendar}
              </span>
              <span className="text-[10px] text-gray-400 font-medium mt-1">
                {language === 'fr' ? "Consulter l'agenda" : 'جدول المواعيد'}
              </span>
            </div>
          </button>

          <button
            id="qa-view-stats-btn"
            onClick={() => setCurrentTab('statistiques')}
            className={`flex items-center gap-4 p-4 rounded-[16px] bg-white border border-gray-200/80 shadow-sm hover:border-cyan-400 hover:shadow-md hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group ${
              isRtl ? 'flex-row-reverse text-right' : 'text-left'
            }`}
          >
            <div className="p-3 bg-cyan-50 text-cyan-600 rounded-[12px] group-hover:scale-110 transition-transform flex-shrink-0">
              <BarChart3 size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-gray-800 leading-tight truncate group-hover:text-cyan-600 transition-colors">
                {t.qa_view_stats}
              </span>
              <span className="text-[10px] text-gray-400 font-medium mt-1">
                {language === 'fr' ? 'Rapports de ventes' : 'التقارير والتحليل'}
              </span>
            </div>
          </button>

          <button
            id="qa-create-receipt-btn"
            onClick={() => setCurrentTab('documents')}
            className={`flex items-center gap-4 p-4 rounded-[16px] bg-white border border-gray-200/80 shadow-sm hover:border-emerald-400 hover:shadow-md hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer transition-all duration-200 group ${
              isRtl ? 'flex-row-reverse text-right' : 'text-left'
            }`}
          >
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-[12px] group-hover:scale-110 transition-transform flex-shrink-0">
              <FileSpreadsheet size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-gray-800 leading-tight truncate group-hover:text-emerald-600 transition-colors">
                {t.qa_create_receipt}
              </span>
              <span className="text-[10px] text-gray-400 font-medium mt-1">
                {language === 'fr' ? 'Factures & reçus' : 'الفواتير والإيصالات'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom split: Alerts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Alerts box */}
        <div className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 mb-6">{t.important_alerts}</h3>
          
          {alerts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-gray-200">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3">
                ✓
              </div>
              <p className="text-sm font-medium text-gray-500">
                {language === 'fr' ? 'Aucune alerte importante' : 'لا توجد تنبيهات هامة'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {alerts.map((alert) => {
                const isError = alert.type === 'error';
                const isWarning = alert.type === 'warning';
                
                return (
                  <div 
                    key={alert.id}
                    className={`p-4 rounded-2xl border flex gap-3.5 items-start ${
                      isError 
                        ? 'bg-red-50/70 border-red-100 text-red-900' 
                        : isWarning 
                          ? 'bg-amber-50/70 border-amber-100 text-amber-900' 
                          : 'bg-blue-50/70 border-blue-100 text-blue-900'
                    } ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}
                  >
                    <div className={`p-1.5 rounded-lg mt-0.5 ${
                      isError 
                        ? 'bg-red-100 text-red-600' 
                        : isWarning 
                          ? 'bg-amber-100 text-amber-600' 
                          : 'bg-blue-100 text-blue-600'
                    }`}>
                      <AlertTriangle size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-relaxed">{alert.text}</p>
                      {alert.phone && (
                        <div className={`flex gap-3 mt-2.5 text-xs font-semibold ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <a 
                            href={`tel:${alert.phone}`} 
                            className={`hover:underline flex items-center gap-1 ${
                              isError ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-blue-700'
                            }`}
                          >
                            📞 {alert.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent timeline logs */}
        <div className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm flex flex-col">
          <div className={`flex justify-between items-center mb-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h3 className="text-lg font-bold text-gray-900">{t.recent_activity}</h3>
            <button 
              onClick={() => setCurrentTab('statistiques')}
              className="text-xs font-semibold text-violet-600 hover:underline"
            >
              {language === 'fr' ? 'Voir tout' : 'عرض الكل'}
            </button>
          </div>

          <div className="space-y-6 max-h-[350px] overflow-y-auto pr-1">
            {db.history.slice(0, 5).map((log, index) => {
              const { icon, bg } = getHistoryIcon(log.action);

              return (
                <div key={log.id} className={`flex gap-4 relative ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                  {/* Timeline connectors */}
                  {index < db.history.slice(0, 5).length - 1 && (
                    <div className={`absolute top-10 bottom-[-24px] w-0.5 bg-gray-100 ${isRtl ? 'right-5' : 'left-5'}`} />
                  )}

                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10 font-bold ${bg}`}>
                    {icon}
                  </div>
                  <div className="flex-1">
                    <div className={`flex flex-wrap justify-between items-baseline gap-2 mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <h4 className="text-sm font-bold text-gray-900 leading-none">{log.action}</h4>
                      <span className="text-[10px] text-gray-400 font-medium font-mono">
                        {log.date} @ {log.heure}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{log.details}</p>
                    <span className="text-[10px] bg-slate-50 border border-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded-md mt-1 inline-block">
                      👤 {log.utilisateur}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
