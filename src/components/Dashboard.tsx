import React, { useState } from 'react';
import {
  ArrowDownRight,
  Calendar,
  RotateCcw,
  Layers,
  Gem,
  PlusCircle,
  UserPlus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  FileSpreadsheet,
  AlertTriangle,
  BarChart3,
  Coins,
  Settings,
  Activity,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../translations';
import { todayIso, isoInDays } from '../lib/dates';

interface DashboardProps {
  db: ReturnType<typeof import('../lib/storage').getFullDatabaseState>;
  setCurrentTab: (tab: string) => void;
  language: Language;
  onOpenQuickAction?: (action: string) => void;
}

type Period = 'jour' | 'semaine' | 'mois' | 'annee';

export default function Dashboard({ db, setCurrentTab, language, onOpenQuickAction }: DashboardProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const todayStr = todayIso();
  const [period, setPeriod] = useState<Period>('mois');

  // A transaction counts towards the selected period when its date falls in it.
  const inPeriod = (date: string) => {
    if (period === 'jour') return date === todayStr;
    if (period === 'annee') return date.startsWith(todayStr.substring(0, 4));
    if (period === 'mois') return date.startsWith(todayStr.substring(0, 7));
    // week: the 7 days ending today
    const day = new Date(date).getTime();
    const end = new Date(todayStr).getTime();
    const start = end - 6 * 24 * 60 * 60 * 1000;
    return day >= start && day <= end;
  };

  const scoped = db.transactions.filter(tr => inPeriod(tr.date));
  const revenue = scoped.filter(tr => tr.type === 'entree').reduce((s, tr) => s + tr.montant_da, 0);
  const expenses = scoped.filter(tr => tr.type === 'depense').reduce((s, tr) => s + tr.montant_da, 0);
  const netProfit = revenue - expenses;

  // Cash physically in the till: takings, less till-funded expenses and payouts
  const cashInHand =
    db.transactions.filter(tr => tr.type === 'entree').reduce((s, tr) => s + tr.montant_da, 0) -
    db.transactions.filter(tr => tr.type === 'depense' && tr.source_argent !== 'tresorerie').reduce((s, tr) => s + tr.montant_da, 0) -
    db.transactions.filter(tr => tr.type === 'vidage_caisse').reduce((s, tr) => s + tr.montant_da, 0);

  const owedByClients = db.reservations
    .filter(r => r.statut !== 'retourne')
    .reduce((s, r) => s + (r.reste_a_payer_da || 0), 0);

  const dressesOut = db.reservations.filter(r => r.statut === 'en_cours' || r.statut === 'en_retard').length;
  const upcomingReservations = db.reservations.filter(r => r.statut === 'future').length;
  const returnsToday = db.reservations.filter(r =>
    r.date_retour === todayStr && (r.statut === 'en_cours' || r.statut === 'en_retard')
  ).length;
  const goingOutToday = db.reservations.filter(r => r.date_sortie === todayStr).length;

  const totalDresses = db.dresses.length;
  const availableDresses = db.dresses.filter(d => d.statut === 'disponible').length;

  // Most-rented dress across all reservations
  const rentalCounts = new Map<string, number>();
  db.reservations.forEach(r =>
    r.items.filter(i => i.type_article === 'robe').forEach(i =>
      rentalCounts.set(i.nom_article, (rentalCounts.get(i.nom_article) || 0) + 1)
    )
  );
  const topDress = [...rentalCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Compile alert messages
  const alerts: Array<{ id: string; type: 'error' | 'warning' | 'info'; text: string; phone?: string }> = [];

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
        phone: client?.telephone
      });
    }
  });

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
        phone: client?.telephone
      });
    }
  });

  const soonStr = isoInDays(4);
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
        phone: client?.telephone
      });
    }
  });

  const formatDa = (amount: number) =>
    new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount);

  const getHistoryIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('robe')) return <Layers size={14} />;
    if (act.includes('bijou') || act.includes('accessoire')) return <Gem size={14} />;
    if (act.includes('réservation') || act.includes('location') || act.includes('contrat')) return <Calendar size={14} />;
    if (act.includes('retour')) return <RotateCcw size={14} />;
    if (act.includes('paiement') || act.includes('caisse') || act.includes('entrée') || act.includes('vidage')) return <Coins size={14} />;
    if (act.includes('dépense') || act.includes('sortie')) return <ArrowDownRight size={14} />;
    if (act.includes('cliente')) return <UserPlus size={14} />;
    if (act.includes('paramètre') || act.includes('réinitialisation')) return <Settings size={14} />;
    return <Activity size={14} />;
  };

  const periods: Array<{ id: Period; label: string }> = [
    { id: 'jour', label: language === 'fr' ? 'Jour' : 'يوم' },
    { id: 'semaine', label: language === 'fr' ? 'Semaine' : 'أسبوع' },
    { id: 'mois', label: language === 'fr' ? 'Mois' : 'شهر' },
    { id: 'annee', label: language === 'fr' ? 'Année' : 'سنة' },
  ];

  // Quick actions keep their original ids and handlers
  const actions = [
    { id: 'qa-new-res-btn', onClick: () => onOpenQuickAction?.('reservation'), icon: PlusCircle, label: t.qa_new_reservation },
    { id: 'qa-add-dress-btn', onClick: () => onOpenQuickAction?.('robe'), icon: Layers, label: t.qa_add_dress },
    { id: 'qa-add-bijou-btn', onClick: () => onOpenQuickAction?.('bijou'), icon: Gem, label: t.qa_add_bijou },
    { id: 'qa-add-expense-btn', onClick: () => onOpenQuickAction?.('depense'), icon: ArrowDownRight, label: t.qa_add_expense },
    { id: 'qa-return-rental-btn', onClick: () => setCurrentTab('retours'), icon: RotateCcw, label: t.qa_return_rental },
    { id: 'qa-view-calendar-btn', onClick: () => setCurrentTab('calendrier'), icon: Calendar, label: t.qa_view_calendar },
    { id: 'qa-view-stats-btn', onClick: () => setCurrentTab('statistiques'), icon: BarChart3, label: t.qa_view_stats },
    { id: 'qa-create-receipt-btn', onClick: () => setCurrentTab('documents'), icon: FileSpreadsheet, label: t.qa_create_receipt },
  ];

  const Metric = ({ label, value, unit, note, icon }: {
    label: string; value: string; unit?: string; note: string; icon: React.ReactNode;
  }) => (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className={`flex items-start justify-between gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <span className="eyebrow leading-tight">{label}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
          {icon}
        </span>
      </div>
      <p className={`mt-6 flex items-baseline gap-1.5 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
        <span className="figure text-3xl text-neutral-900">{value}</span>
        {unit && <span className="text-xs font-medium text-neutral-500">{unit}</span>}
      </p>
      <p className="mt-2 text-[13px] leading-snug text-neutral-500">{note}</p>
    </div>
  );

  return (
    <div className={`mx-auto max-w-[1200px] space-y-6 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ── Page head + period selector ─────────────────────────────── */}
      <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
        <div>
          <h2 className="font-display text-[2rem] leading-tight text-neutral-900">
            {language === 'fr' ? 'Tableau de bord' : 'لوحة القيادة'}
          </h2>
          <p className="mt-1 text-[15px] text-neutral-500">
            {language === 'fr'
              ? 'Aperçu en temps réel et indicateurs clés de la Maison Zeyna.'
              : 'نظرة فورية على المؤشرات الرئيسية لدار زينة.'}
          </p>
        </div>

        <div className={`flex shrink-0 items-center gap-0.5 rounded-xl border border-neutral-200 bg-neutral-100 p-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
          {periods.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                period === p.id
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Headline figures ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={language === 'fr' ? "Chiffre d'affaires" : 'رقم الأعمال'}
          value={formatDa(revenue)}
          unit={t.currency}
          note={language === 'fr' ? 'Encaissements sur la période' : 'المداخيل خلال الفترة'}
          icon={<TrendingUp size={15} />}
        />
        <Metric
          label={language === 'fr' ? 'Dépenses' : 'المصاريف'}
          value={formatDa(expenses)}
          unit={t.currency}
          note={language === 'fr' ? 'Toutes sources confondues' : 'من جميع المصادر'}
          icon={<TrendingDown size={15} />}
        />
        <Metric
          label={language === 'fr' ? 'Bénéfice net' : 'الربح الصافي'}
          value={formatDa(netProfit)}
          unit={t.currency}
          note={language === 'fr' ? 'CA moins toutes les dépenses' : 'رقم الأعمال ناقص المصاريف'}
          icon={<DollarSign size={15} />}
        />

        {/* The one feature surface: cash in hand, with the single orange action */}
        <div className="rounded-2xl bg-neutral-950 p-5 text-white">
          <div className={`flex items-start justify-between gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="eyebrow leading-tight !text-neutral-400">
              {language === 'fr' ? 'Argent en caisse' : 'النقد في الصندوق'}
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10">
              <Wallet size={15} />
            </span>
          </div>
          <p className={`mt-6 flex items-baseline gap-1.5 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
            <span className="figure text-3xl">{formatDa(cashInHand)}</span>
            <span className="text-xs font-medium text-neutral-400">{t.currency}</span>
          </p>
          <p className="mt-2 text-[13px] text-neutral-400">
            {language === 'fr' ? 'Fonds réels disponibles' : 'الأموال المتوفرة فعلياً'}
          </p>
          <button
            onClick={() => setCurrentTab('caisse')}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors hover:bg-orange-700 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <ArrowUpRight size={14} />
            {language === 'fr' ? 'Vider la caisse' : 'تفريغ الصندوق'}
          </button>
        </div>
      </div>

      {/* ── Secondary figures ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: language === 'fr' ? 'Dû par les clientes' : 'مستحق على الزبونات',
            body: <><span className="figure text-xl text-neutral-900">{formatDa(owedByClients)}</span> <span className="text-xs text-neutral-500">{t.currency}</span></>
          },
          {
            label: language === 'fr' ? 'Robes en location' : 'الفساتين المؤجرة',
            body: <><span className="figure text-xl text-neutral-900">{dressesOut}</span> <span className="text-xs text-neutral-500">{language === 'fr' ? 'en cours' : 'جارية'}</span></>
          },
          {
            label: language === 'fr' ? 'Robe la plus louée' : 'الفستان الأكثر تأجيراً',
            body: topDress
              ? <span className="truncate text-[15px] font-medium text-neutral-900">{topDress[0]}</span>
              : <span className="text-[15px] italic text-neutral-400">{language === 'fr' ? 'Aucune réservation' : 'لا توجد حجوزات'}</span>
          },
        ].map(item => (
          <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white px-5 py-4">
            <p className="eyebrow">{item.label}</p>
            <p className="mt-2 flex items-baseline gap-1.5">{item.body}</p>
          </div>
        ))}
      </div>

      {/* ── Today's movements ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { label: language === 'fr' ? "Sorties aujourd'hui" : 'الخروجات اليوم', n: goingOutToday, unit: language === 'fr' ? 'robe(s)' : 'فستان', icon: <Calendar size={17} />, tab: 'reservations' },
          { label: language === 'fr' ? "Retours aujourd'hui" : 'المرتجعات اليوم', n: returnsToday, unit: language === 'fr' ? 'prévu(s)' : 'متوقع', icon: <RotateCcw size={17} />, tab: 'retours' },
        ].map(m => (
          <button
            key={m.label}
            onClick={() => setCurrentTab(m.tab)}
            className={`flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-left transition-colors hover:border-neutral-300 ${isRtl ? 'flex-row-reverse text-right' : ''}`}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-neutral-200 text-neutral-600">
              {m.icon}
            </span>
            <span>
              <span className="eyebrow block">{m.label}</span>
              <span className={`mt-1 flex items-baseline gap-1.5 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                <span className="figure text-xl text-neutral-900">{m.n}</span>
                <span className="text-xs text-neutral-500">{m.unit}</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
        <h3 className={`flex items-center gap-2 text-base text-neutral-900 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Sparkles size={15} className="text-neutral-400" />
          {t.quick_actions}
        </h3>

        <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {actions.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                id={a.id}
                onClick={a.onClick}
                className={`flex items-center gap-3 rounded-xl border border-neutral-200 px-3.5 py-3 transition-colors hover:border-neutral-300 hover:bg-neutral-50 ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}
              >
                <Icon size={17} strokeWidth={1.7} className="shrink-0 text-neutral-500" />
                <span className="truncate text-[13px] font-medium text-neutral-800">{a.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Alerts & activity ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Daily alerts */}
        <section className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h3 className="text-base text-neutral-900">
            {language === 'fr' ? 'Alertes quotidiennes' : 'التنبيهات اليومية'}
          </h3>

          <div className={`mt-4 flex flex-wrap gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
              {language === 'fr' ? `Sorties du jour (${goingOutToday})` : `خروجات اليوم (${goingOutToday})`}
            </span>
            <span className="rounded-lg bg-green-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-green-700">
              {language === 'fr' ? `Retours du jour (${returnsToday})` : `مرتجعات اليوم (${returnsToday})`}
            </span>
          </div>

          {alerts.length === 0 ? (
            <p className="mt-5 text-[15px] italic text-neutral-400">
              {language === 'fr' ? 'Aucun mouvement prévu aujourd’hui.' : 'لا توجد حركات متوقعة اليوم.'}
            </p>
          ) : (
            <div className="mt-5 max-h-[320px] space-y-2 overflow-y-auto">
              {alerts.map(alert => {
                const tone =
                  alert.type === 'error' ? 'border-red-200 bg-red-50' :
                  alert.type === 'warning' ? 'border-amber-200 bg-amber-50' :
                  'border-neutral-200 bg-neutral-50';
                const iconTone =
                  alert.type === 'error' ? 'text-red-600' :
                  alert.type === 'warning' ? 'text-amber-600' :
                  'text-neutral-500';
                return (
                  <div key={alert.id} className={`flex items-start gap-3 rounded-xl border p-3.5 ${tone} ${isRtl ? 'flex-row-reverse text-right' : ''}`}>
                    <AlertTriangle size={15} className={`mt-0.5 shrink-0 ${iconTone}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-relaxed text-neutral-800">{alert.text}</p>
                      {alert.phone && (
                        <a href={`tel:${alert.phone}`} className="mt-1.5 inline-block text-xs font-semibold text-neutral-700 hover:underline">
                          {alert.phone}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <div className={`flex items-center justify-between gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h3 className="text-base text-neutral-900">{t.recent_activity}</h3>
            <button
              onClick={() => setCurrentTab('statistiques')}
              className="eyebrow transition-colors hover:text-neutral-900"
            >
              {language === 'fr' ? 'Voir tout' : 'عرض الكل'}
            </button>
          </div>

          {db.history.length === 0 ? (
            <p className="mt-5 text-[15px] italic text-neutral-400">
              {language === 'fr' ? 'Aucun mouvement récent enregistré.' : 'لا توجد حركات مسجلة.'}
            </p>
          ) : (
            <div className="mt-4 max-h-[320px] divide-y divide-neutral-200 overflow-y-auto">
              {db.history.slice(0, 6).map(log => (
                <div key={log.id} className={`flex gap-3 py-3.5 ${isRtl ? 'flex-row-reverse text-right' : ''}`}>
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-500">
                    {getHistoryIcon(log.action)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`flex flex-wrap items-baseline justify-between gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <h4 className="font-sans text-[13px] font-semibold text-neutral-900">{log.action}</h4>
                      <span className="text-[11px] tabular-nums text-neutral-400">{log.date} · {log.heure}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{log.details}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
