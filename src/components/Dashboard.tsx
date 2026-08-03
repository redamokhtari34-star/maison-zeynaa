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
  ChevronRight
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
    if (act.includes('robe')) return { icon: <Sparkles size={15} />, grad: 'from-fuchsia-500 to-violet-500' };
    if (act.includes('bijou') || act.includes('accessoire')) return { icon: <Gem size={15} />, grad: 'from-amber-400 to-rose-500' };
    if (act.includes('réservation') || act.includes('location') || act.includes('contrat')) return { icon: <Calendar size={15} />, grad: 'from-indigo-500 to-blue-500' };
    if (act.includes('retour')) return { icon: <RotateCcw size={15} />, grad: 'from-rose-500 to-amber-400' };
    if (act.includes('paiement') || act.includes('caisse') || act.includes('entrée') || act.includes('vidage')) return { icon: <Coins size={15} />, grad: 'from-emerald-500 to-teal-400' };
    if (act.includes('dépense') || act.includes('sortie')) return { icon: <ArrowDownRight size={15} />, grad: 'from-red-500 to-rose-500' };
    if (act.includes('cliente')) return { icon: <UserPlus size={15} />, grad: 'from-blue-500 to-teal-400' };
    if (act.includes('paramètre') || act.includes('réinitialisation')) return { icon: <Settings size={15} />, grad: 'from-neutral-500 to-neutral-700' };
    return { icon: <Activity size={15} />, grad: 'from-violet-500 to-indigo-500' };
  };

  const dateLabel = language === 'fr' ? 'Mardi 21 Juillet 2026' : 'الثلاثاء 21 جويلية 2026';

  // Bento stat tiles — each owns a gradient + matching coloured shadow
  const tiles = [
    {
      label: t.month_revenue,
      value: formatDa(incomeMonth),
      hint: language === 'fr' ? 'Cumul Juillet 2026' : 'المجموع جويلية 2026',
      icon: DollarSign,
      grad: 'from-indigo-500 to-blue-500',
      shadow: 'shadow-indigo-500/30',
      big: true,
    },
    {
      label: t.upcoming_reservations,
      value: upcomingReservations,
      hint: language === 'fr' ? 'Confirmées par acompte' : 'مؤكدة بالعربون',
      icon: Calendar,
      grad: 'from-violet-500 to-fuchsia-500',
      shadow: 'shadow-violet-500/30',
    },
    {
      label: t.returns_today,
      value: returnsToday,
      hint: language === 'fr' ? 'Restitution prévue' : 'متوقعة للاسترجاع',
      icon: RotateCcw,
      grad: 'from-rose-500 to-amber-400',
      shadow: 'shadow-rose-500/30',
    },
    {
      label: t.available_dresses,
      value: availableDresses,
      suffix: `/ ${totalDresses}`,
      hint: language === 'fr' ? 'Prêtes pour location' : 'جاهزة للإيجار',
      icon: Layers,
      grad: 'from-emerald-500 to-teal-400',
      shadow: 'shadow-emerald-500/30',
    },
    {
      label: t.rented_dresses,
      value: rentedDresses,
      hint: language === 'fr' ? 'Sorties ou réservées' : 'خارجة أو محجوزة',
      icon: Clock,
      grad: 'from-blue-500 to-teal-400',
      shadow: 'shadow-blue-500/30',
    },
  ];

  // Quick actions — same ids / handlers, restyled as gradient chips
  const actions = [
    { id: 'qa-new-res-btn', onClick: () => onOpenQuickAction?.('reservation'), icon: PlusCircle, label: t.qa_new_reservation, sub: language === 'fr' ? 'Créer un contrat' : 'إنشاء عقد جديد', grad: 'from-violet-500 to-fuchsia-500', shadow: 'shadow-violet-500/30' },
    { id: 'qa-add-dress-btn', onClick: () => onOpenQuickAction?.('robe'), icon: Layers, label: t.qa_add_dress, sub: language === 'fr' ? 'Nouveau modèle' : 'موديل جديد', grad: 'from-fuchsia-500 to-rose-500', shadow: 'shadow-fuchsia-500/30' },
    { id: 'qa-add-bijou-btn', onClick: () => onOpenQuickAction?.('bijou'), icon: Gem, label: t.qa_add_bijou, sub: language === 'fr' ? 'Accessoire' : 'إضافة مجوهرات', grad: 'from-amber-400 to-rose-500', shadow: 'shadow-amber-400/30' },
    { id: 'qa-add-expense-btn', onClick: () => onOpenQuickAction?.('depense'), icon: ArrowDownRight, label: t.qa_add_expense, sub: language === 'fr' ? 'Saisir un frais' : 'تسجيل مصاريف', grad: 'from-red-500 to-rose-500', shadow: 'shadow-red-500/30' },
    { id: 'qa-return-rental-btn', onClick: () => setCurrentTab('retours'), icon: RotateCcw, label: t.qa_return_rental, sub: language === 'fr' ? 'Gérer un retour' : 'إدارة الإرجاع', grad: 'from-rose-500 to-amber-400', shadow: 'shadow-rose-500/30' },
    { id: 'qa-view-calendar-btn', onClick: () => setCurrentTab('calendrier'), icon: Calendar, label: t.qa_view_calendar, sub: language === 'fr' ? "Consulter l'agenda" : 'جدول المواعيد', grad: 'from-indigo-500 to-blue-500', shadow: 'shadow-indigo-500/30' },
    { id: 'qa-view-stats-btn', onClick: () => setCurrentTab('statistiques'), icon: BarChart3, label: t.qa_view_stats, sub: language === 'fr' ? 'Rapports de ventes' : 'التقارير والتحليل', grad: 'from-teal-400 to-blue-500', shadow: 'shadow-teal-400/30' },
    { id: 'qa-create-receipt-btn', onClick: () => setCurrentTab('documents'), icon: FileSpreadsheet, label: t.qa_create_receipt, sub: language === 'fr' ? 'Factures & reçus' : 'الفواتير والإيصالات', grad: 'from-emerald-500 to-teal-400', shadow: 'shadow-emerald-500/30' },
  ];

  return (
    <div className={`mx-auto max-w-6xl space-y-6 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Gradient hero ──────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-violet-600 via-fuchsia-500 to-rose-500 p-7 text-white shadow-2xl shadow-violet-500/30 sm:p-9"
      >
        {/* glossy blobs */}
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-indigo-400/40 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] backdrop-blur-sm">
            <Sparkles size={12} /> {dateLabel}
          </span>

          <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
            {t.welcome}
          </h2>

          <p className="mt-2 max-w-md text-sm text-white/80 sm:text-[15px]">
            {language === 'fr'
              ? 'Votre showroom en un coup d’œil — locations, retours et trésorerie du jour.'
              : 'صالة العرض في لمحة — الإيجارات والإرجاعات والخزينة اليوم.'}
          </p>

          {/* today's revenue, oversized */}
          <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <TrendingUp size={13} />
                {t.today_revenue}
              </div>
              <div className="mt-1 font-display text-4xl font-extrabold tabular-nums sm:text-5xl">
                {formatDa(incomeToday)}
              </div>
            </div>

            <button
              onClick={() => onOpenQuickAction?.('reservation')}
              className={`inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-violet-700 shadow-lg transition-transform hover:-translate-y-0.5 ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              <PlusCircle size={17} />
              {t.qa_new_reservation}
            </button>
          </div>
        </div>
      </motion.section>

      {/* ── Bento stat tiles ───────────────────────────────────────── */}
      {/* 5 tiles, the revenue one double-width = 6 cells: fills 2 rows exactly */}
      <section className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        {tiles.map((tile, i) => {
          const Icon = tile.icon;
          return (
            <motion.div
              key={tile.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 * i }}
              className={`rounded-[26px] bg-white p-5 shadow-lg shadow-neutral-300/40 transition-transform hover:-translate-y-1 ${
                tile.big ? 'col-span-2' : ''
              }`}
            >
              <div className={`flex items-start justify-between gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                  {tile.label}
                </span>
                <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${tile.grad} text-white shadow-lg ${tile.shadow}`}>
                  <Icon size={18} />
                </span>
              </div>

              <div className={`mt-4 flex items-baseline gap-1.5 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                <span className={`font-display font-extrabold tabular-nums text-neutral-900 ${tile.big ? 'text-3xl sm:text-4xl' : 'text-3xl'}`}>
                  {tile.value}
                </span>
                {tile.suffix && <span className="text-sm font-semibold text-neutral-300 tabular-nums">{tile.suffix}</span>}
              </div>
              <p className="mt-1.5 text-xs font-medium text-neutral-400">{tile.hint}</p>
            </motion.div>
          );
        })}
      </section>

      {/* ── Quick actions ──────────────────────────────────────────── */}
      <section className="rounded-[30px] bg-white p-5 shadow-lg shadow-neutral-300/40 sm:p-6">
        <h3 className={`mb-4 flex items-center gap-2 font-display text-lg font-extrabold text-neutral-900 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Sparkles size={17} className="text-violet-500" />
          {t.quick_actions}
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                id={a.id}
                onClick={a.onClick}
                className={`group flex items-center gap-3 rounded-3xl bg-neutral-50 p-3.5 transition-all hover:-translate-y-1 hover:bg-white hover:shadow-lg ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}
              >
                <span className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${a.grad} text-white shadow-lg ${a.shadow} transition-transform group-hover:scale-110`}>
                  <Icon size={19} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-extrabold leading-tight text-neutral-900">{a.label}</span>
                  <span className="mt-0.5 truncate text-[10px] font-medium text-neutral-400">{a.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Alerts & Activity ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Alerts */}
        <div className="flex flex-col rounded-[30px] bg-white p-5 shadow-lg shadow-neutral-300/40 sm:p-6">
          <div className={`mb-4 flex items-center justify-between gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h3 className={`flex items-center gap-2 font-display text-lg font-extrabold text-neutral-900 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <AlertTriangle size={17} className="text-rose-500" />
              {t.important_alerts}
            </h3>
            {alerts.length > 0 && (
              <span className="rounded-full bg-gradient-to-r from-rose-500 to-amber-400 px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white shadow-md shadow-rose-500/30">
                {alerts.length}
              </span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-[24px] bg-neutral-50 py-12">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30">
                ✓
              </div>
              <p className="mt-3 text-sm font-semibold text-neutral-400">
                {language === 'fr' ? 'Aucune alerte importante' : 'لا توجد تنبيهات هامة'}
              </p>
            </div>
          ) : (
            <div className="max-h-[350px] space-y-2.5 overflow-y-auto pr-1">
              {alerts.map((alert) => {
                const isError = alert.type === 'error';
                const isWarning = alert.type === 'warning';
                const grad = isError ? 'from-red-500 to-rose-500' : isWarning ? 'from-amber-400 to-rose-500' : 'from-blue-500 to-teal-400';
                const tint = isError ? 'bg-red-50' : isWarning ? 'bg-amber-50' : 'bg-blue-50';
                const link = isError ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600';
                return (
                  <div key={alert.id} className={`flex items-start gap-3 rounded-[22px] p-4 ${tint} ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                    <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow-md`}>
                      <AlertTriangle size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-relaxed text-neutral-800">{alert.text}</p>
                      {alert.phone && (
                        <a href={`tel:${alert.phone}`} className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${link} hover:underline`}>
                          📞 {alert.phone}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity */}
        <div className="flex flex-col rounded-[30px] bg-white p-5 shadow-lg shadow-neutral-300/40 sm:p-6">
          <div className={`mb-4 flex items-center justify-between gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h3 className={`flex items-center gap-2 font-display text-lg font-extrabold text-neutral-900 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <Activity size={17} className="text-violet-500" />
              {t.recent_activity}
            </h3>
            <button
              onClick={() => setCurrentTab('statistiques')}
              className={`inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-extrabold text-neutral-600 transition-colors hover:bg-neutral-200 ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              {language === 'fr' ? 'Voir tout' : 'عرض الكل'}
              <ChevronRight size={13} className={isRtl ? 'rotate-180' : ''} />
            </button>
          </div>

          <div className="max-h-[350px] space-y-2 overflow-y-auto pr-1">
            {db.history.slice(0, 5).map((log) => {
              const { icon, grad } = getHistoryIcon(log.action);
              return (
                <div key={log.id} className={`flex gap-3 rounded-[22px] p-3 transition-colors hover:bg-neutral-50 ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                  <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow-md`}>
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`flex flex-wrap items-baseline justify-between gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <h4 className="text-[13px] font-extrabold leading-none text-neutral-900">{log.action}</h4>
                      <span className="text-[10px] font-semibold tabular-nums text-neutral-300">
                        {log.date} · {log.heure}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">{log.details}</p>
                    <span className="mt-1.5 inline-block rounded-lg bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500">
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
