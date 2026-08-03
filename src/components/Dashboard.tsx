import React from 'react';
import {
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
  BarChart3,
  Coins,
  Settings,
  Activity,
  Sparkles,
  ArrowUpRight
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
        bg: 'bg-rose-100 text-rose-600 border border-rose-200/60'
      };
    }
    if (act.includes('bijou') || act.includes('accessoire')) {
      return {
        icon: <Gem size={16} />,
        bg: 'bg-amber-100 text-amber-700 border border-amber-200/60'
      };
    }
    if (act.includes('réservation') || act.includes('location') || act.includes('contrat')) {
      return {
        icon: <Calendar size={16} />,
        bg: 'bg-blue-100 text-blue-600 border border-blue-200/60'
      };
    }
    if (act.includes('retour')) {
      return {
        icon: <RotateCcw size={16} />,
        bg: 'bg-amber-100 text-amber-700 border border-amber-200/60'
      };
    }
    if (act.includes('paiement') || act.includes('caisse') || act.includes('entrée') || act.includes('vidage')) {
      return {
        icon: <Coins size={16} />,
        bg: 'bg-emerald-100 text-emerald-700 border border-emerald-200/60'
      };
    }
    if (act.includes('dépense') || act.includes('sortie')) {
      return {
        icon: <ArrowDownRight size={16} />,
        bg: 'bg-red-100 text-red-600 border border-red-200/60'
      };
    }
    if (act.includes('cliente')) {
      return {
        icon: <UserPlus size={16} />,
        bg: 'bg-rose-100 text-rose-600 border border-rose-200/60'
      };
    }
    if (act.includes('paramètre') || act.includes('réinitialisation')) {
      return {
        icon: <Settings size={16} />,
        bg: 'bg-stone-200 text-stone-700 border border-stone-300'
      };
    }
    return {
      icon: <Activity size={16} />,
      bg: 'bg-stone-100 text-stone-600 border border-stone-200/60'
    };
  };

  const dateLabel = language === 'fr' ? 'Mardi 21 Juillet 2026' : 'الثلاثاء 21 جويلية 2026';

  // Small counts shown as an editorial hairline strip
  const counts = [
    {
      label: t.upcoming_reservations,
      value: upcomingReservations,
      hint: language === 'fr' ? 'Confirmées par acompte' : 'مؤكدة بالعربون',
      icon: <Calendar size={15} />,
    },
    {
      label: t.returns_today,
      value: returnsToday,
      hint: language === 'fr' ? 'Restitution prévue' : 'متوقعة للاسترجاع',
      icon: <RotateCcw size={15} />,
    },
    {
      label: t.available_dresses,
      value: availableDresses,
      suffix: `/ ${totalDresses}`,
      hint: language === 'fr' ? 'Prêtes pour location' : 'جاهزة للإيجار',
      icon: <Layers size={15} />,
    },
    {
      label: t.rented_dresses,
      value: rentedDresses,
      hint: language === 'fr' ? 'Sorties ou réservées' : 'خارجة أو محجوزة',
      icon: <Clock size={15} />,
    },
  ];

  // Quick actions — same ids / handlers, restyled as editorial tiles
  const actions = [
    { id: 'qa-new-res-btn', onClick: () => onOpenQuickAction?.('reservation'), icon: PlusCircle, label: t.qa_new_reservation, sub: language === 'fr' ? 'Créer un contrat' : 'إنشاء عقد جديد', featured: true },
    { id: 'qa-add-dress-btn', onClick: () => onOpenQuickAction?.('robe'), icon: Layers, label: t.qa_add_dress, sub: language === 'fr' ? 'Nouveau modèle' : 'موديل جديد' },
    { id: 'qa-add-bijou-btn', onClick: () => onOpenQuickAction?.('bijou'), icon: Gem, label: t.qa_add_bijou, sub: language === 'fr' ? 'Accessoire' : 'إضافة مجوهرات' },
    { id: 'qa-add-expense-btn', onClick: () => onOpenQuickAction?.('depense'), icon: ArrowDownRight, label: t.qa_add_expense, sub: language === 'fr' ? 'Saisir un frais' : 'تسجيل مصاريف' },
    { id: 'qa-return-rental-btn', onClick: () => setCurrentTab('retours'), icon: RotateCcw, label: t.qa_return_rental, sub: language === 'fr' ? 'Gérer un retour' : 'إدارة الإرجاع' },
    { id: 'qa-view-calendar-btn', onClick: () => setCurrentTab('calendrier'), icon: Calendar, label: t.qa_view_calendar, sub: language === 'fr' ? "Consulter l'agenda" : 'جدول المواعيد' },
    { id: 'qa-view-stats-btn', onClick: () => setCurrentTab('statistiques'), icon: BarChart3, label: t.qa_view_stats, sub: language === 'fr' ? 'Rapports de ventes' : 'التقارير والتحليل' },
    { id: 'qa-create-receipt-btn', onClick: () => setCurrentTab('documents'), icon: FileSpreadsheet, label: t.qa_create_receipt, sub: language === 'fr' ? 'Factures & reçus' : 'الفواتير والإيصالات' },
  ];

  return (
    <div className={`max-w-6xl mx-auto space-y-10 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Editorial masthead ─────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-[26px] border border-stone-200 bg-white"
      >
        {/* soft blush wash in the corner */}
        <div className={`pointer-events-none absolute -top-24 h-64 w-64 rounded-full bg-rose-200/40 blur-3xl ${isRtl ? '-left-16' : '-right-16'}`} />

        <div className="relative grid lg:grid-cols-[1.7fr_1fr]">
          {/* Greeting */}
          <div className="px-7 py-9 sm:px-10 sm:py-12">
            <div className={`flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-stone-400 font-medium ${isRtl ? 'flex-row-reverse' : ''}`}>
              <span>{dateLabel}</span>
              <span className="h-px w-8 bg-stone-300" />
              <span>Alger · DZ</span>
            </div>

            <h2 className="font-display display-tight text-[2.6rem] leading-none sm:text-[3.6rem] text-stone-900 mt-5">
              {t.welcome}
            </h2>

            <p className="text-[15px] text-stone-500 max-w-md mt-4 leading-relaxed">
              {language === 'fr'
                ? 'La maison de location de robes traditionnelles algériennes de luxe — vue d’ensemble de votre journée.'
                : 'دار تأجير الفساتين التقليدية الجزائرية الفاخرة — نظرة عامة على يومك.'}
            </p>

            <div className={`flex flex-wrap items-center gap-2.5 mt-7 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => onOpenQuickAction?.('reservation')}
                className={`inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}
              >
                <PlusCircle size={16} />
                {t.qa_new_reservation}
              </button>
              <button
                onClick={() => setCurrentTab('calendrier')}
                className={`inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:border-rose-400 hover:text-rose-700 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}
              >
                <Calendar size={16} />
                {t.qa_view_calendar}
              </button>
            </div>
          </div>

          {/* Revenue feature */}
          <div className={`relative flex flex-col justify-center gap-6 bg-stone-50/70 px-7 py-9 sm:px-9 ${isRtl ? 'lg:border-r border-stone-200' : 'lg:border-l border-stone-200'} border-t lg:border-t-0`}>
            <div>
              <div className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-stone-400 font-semibold ${isRtl ? 'flex-row-reverse' : ''}`}>
                <TrendingUp size={13} className="text-emerald-600" />
                <span>{t.today_revenue}</span>
              </div>
              <div className={`mt-2 font-display text-4xl sm:text-[2.7rem] leading-none text-stone-900 tabular-nums ${isRtl ? 'flex flex-row-reverse justify-end' : ''}`}>
                {formatDa(incomeToday)}
              </div>
            </div>

            <div className="h-px w-full bg-stone-200" />

            <div>
              <div className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-stone-400 font-semibold ${isRtl ? 'flex-row-reverse' : ''}`}>
                <DollarSign size={13} className="text-rose-500" />
                <span>{t.month_revenue}</span>
              </div>
              <div className="mt-2 font-display text-3xl leading-none text-stone-700 tabular-nums">
                {formatDa(incomeMonth)}
              </div>
              <span className="text-[11px] text-stone-400 mt-1.5 inline-block">
                {language === 'fr' ? 'Cumul · Juillet 2026' : 'المجموع · جويلية 2026'}
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Counts hairline strip ──────────────────────────────────── */}
      <section className="rounded-[22px] border border-stone-200 overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200">
          {counts.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 * i }}
              className="bg-white p-6"
            >
              <div className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-stone-400 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className="text-rose-400">{c.icon}</span>
                <span className="truncate">{c.label}</span>
              </div>
              <div className={`flex items-baseline gap-1.5 mt-3 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                <span className="font-display text-4xl leading-none text-stone-900 tabular-nums">{c.value}</span>
                {c.suffix && <span className="text-sm text-stone-400 tabular-nums">{c.suffix}</span>}
              </div>
              <p className="text-xs text-stone-400 mt-2">{c.hint}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Quick actions ──────────────────────────────────────────── */}
      <section>
        <div className={`flex items-center gap-4 mb-5 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h3 className="font-display text-2xl text-stone-900">{t.quick_actions}</h3>
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {actions.map((a) => {
            const Icon = a.icon;
            if (a.featured) {
              return (
                <button
                  key={a.id}
                  id={a.id}
                  onClick={a.onClick}
                  className={`group flex items-center gap-4 rounded-[18px] bg-gradient-to-br from-rose-600 to-rose-500 p-4 text-white shadow-sm shadow-rose-600/20 hover:shadow-md hover:shadow-rose-600/25 hover:-translate-y-0.5 transition-all ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}
                >
                  <div className="flex-shrink-0 rounded-[12px] bg-white/15 p-3 group-hover:scale-110 transition-transform">
                    <Icon size={22} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold leading-tight">{a.label}</span>
                    <span className="text-[10px] text-white/75 font-medium mt-1">{a.sub}</span>
                  </div>
                </button>
              );
            }
            return (
              <button
                key={a.id}
                id={a.id}
                onClick={a.onClick}
                className={`group flex items-center gap-4 rounded-[18px] border border-stone-200 bg-white p-4 hover:border-rose-300 hover:-translate-y-0.5 hover:shadow-sm transition-all ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}
              >
                <div className="flex-shrink-0 rounded-full border border-stone-200 bg-stone-50 p-2.5 text-rose-600 group-hover:border-rose-200 group-hover:bg-rose-50 transition-colors">
                  <Icon size={20} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-stone-800 leading-tight truncate group-hover:text-rose-700 transition-colors">{a.label}</span>
                  <span className="text-[10px] text-stone-400 font-medium mt-1">{a.sub}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Alerts & Activity ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="rounded-[22px] border border-stone-200 bg-white p-6 flex flex-col">
          <div className={`flex items-center gap-4 mb-5 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h3 className="font-display text-xl text-stone-900">{t.important_alerts}</h3>
            <span className="h-px flex-1 bg-stone-200" />
            {alerts.length > 0 && (
              <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-full px-2.5 py-0.5 tabular-nums">
                {alerts.length}
              </span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-stone-200 bg-stone-50/50">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">✓</div>
              <p className="text-sm font-medium text-stone-500">
                {language === 'fr' ? 'Aucune alerte importante' : 'لا توجد تنبيهات هامة'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {alerts.map((alert) => {
                const isError = alert.type === 'error';
                const isWarning = alert.type === 'warning';
                const tone = isError
                  ? 'bg-red-50/70 border-red-100 text-red-900'
                  : isWarning
                    ? 'bg-amber-50/70 border-amber-100 text-amber-900'
                    : 'bg-blue-50/70 border-blue-100 text-blue-900';
                const chip = isError
                  ? 'bg-red-100 text-red-600'
                  : isWarning
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-600';
                return (
                  <div key={alert.id} className={`p-4 rounded-2xl border flex gap-3.5 items-start ${tone} ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                    <div className={`p-1.5 rounded-lg mt-0.5 ${chip}`}>
                      <AlertTriangle size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-relaxed">{alert.text}</p>
                      {alert.phone && (
                        <div className={`flex gap-3 mt-2.5 text-xs font-semibold ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <a
                            href={`tel:${alert.phone}`}
                            className={`hover:underline flex items-center gap-1 ${isError ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-blue-700'}`}
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

        {/* Recent activity timeline */}
        <div className="rounded-[22px] border border-stone-200 bg-white p-6 flex flex-col">
          <div className={`flex items-center gap-4 mb-5 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h3 className="font-display text-xl text-stone-900">{t.recent_activity}</h3>
            <span className="h-px flex-1 bg-stone-200" />
            <button
              onClick={() => setCurrentTab('statistiques')}
              className={`inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              {language === 'fr' ? 'Voir tout' : 'عرض الكل'}
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="space-y-6 max-h-[350px] overflow-y-auto pr-1">
            {db.history.slice(0, 5).map((log, index) => {
              const { icon, bg } = getHistoryIcon(log.action);
              const isLast = index >= db.history.slice(0, 5).length - 1;
              return (
                <div key={log.id} className={`flex gap-4 relative ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                  {!isLast && (
                    <div className={`absolute top-10 bottom-[-24px] w-px bg-stone-200 ${isRtl ? 'right-5' : 'left-5'}`} />
                  )}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${bg}`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`flex flex-wrap justify-between items-baseline gap-2 mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <h4 className="text-sm font-semibold text-stone-900 leading-none">{log.action}</h4>
                      <span className="text-[10px] text-stone-400 font-medium font-mono tabular-nums">
                        {log.date} @ {log.heure}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed">{log.details}</p>
                    <span className="text-[10px] bg-stone-50 border border-stone-200 text-stone-500 font-semibold px-1.5 py-0.5 rounded-md mt-1.5 inline-block">
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
