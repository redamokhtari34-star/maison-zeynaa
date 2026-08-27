import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  User,
  Phone,
  Clock,
  CheckCircle2,
  Sparkles,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Reservation, Dress, Cliente, Bijou, Language } from '../types';
import { translations } from '../translations';
import { todayIso } from '../lib/dates';

interface CalendrierProps {
  reservations: Reservation[];
  dresses: Dress[];
  clientes: Cliente[];
  bijoux?: Bijou[];
  language: Language;
  setCurrentTab?: (tab: string) => void;
  onRefreshData?: () => Promise<void>;
}

// Which of the three dates that matter on a booking this particular calendar
// day is: the day the dress leaves, the day(s) in between (the event itself),
// or the day it comes back.
type DateRole = 'sortie' | 'evenement' | 'retour';

export default function Calendrier({
  reservations,
  dresses,
  clientes,
  bijoux = [],
  language,
  setCurrentTab,
  onRefreshData
}: CalendrierProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  // Current viewed date for month/year navigation
  // Opens on the month in progress, not on a month frozen at build time.
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(todayIso());
  // Tapping a day opens this instead of relying on a panel further down the
  // page — on a phone that panel sat below the fold and looked like nothing
  // had happened.
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'en_cours' | 'future' | 'retourne'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [liveReservations, setLiveReservations] = useState<Reservation[]>(reservations);

  // Sync with props — the correctly-joined multi-item reservations already
  // computed in App.tsx (with every robe/bijou from reservation_robes and
  // reservation_bijoux). A second, separate fetch used to run here straight
  // against the bare `reservations` table, which only carries the legacy
  // single robe_id/bijou_id columns — it overwrote a two-dress booking with
  // a one-dress reconstruction every time this screen opened.
  useEffect(() => {
    setLiveReservations(reservations);
  }, [reservations]);

  // Helpers for resolving names and photos
  const getClientName = (res: Reservation) => {
    if (res.cliente_id && res.cliente_id.length > 20) {
      const found = clientes.find(c => c.id === res.cliente_id);
      if (found) return found.nom_complet;
    }
    // If stored directly as name
    const matchesClient = clientes.find(c => c.nom_complet.toLowerCase() === res.cliente_id.toLowerCase());
    if (matchesClient) return matchesClient.nom_complet;
    return res.cliente_id || 'Cliente inconnue';
  };

  const getClientPhone = (res: Reservation) => {
    const found = clientes.find(c => c.id === res.cliente_id || c.nom_complet.toLowerCase() === res.cliente_id.toLowerCase());
    return found?.telephone || '';
  };

  const getDressForReservation = (res: Reservation): Dress | undefined => {
    const robeItem = res.items.find(i => i.type_article === 'robe');
    if (robeItem) {
      return dresses.find(d => d.id === robeItem.article_id || d.nom.toLowerCase() === robeItem.nom_article.toLowerCase());
    }
    return undefined;
  };

  // Every article on the booking, not just the first — a two-dress
  // reservation used to show only one, hiding the second robe entirely.
  const getDressName = (res: Reservation) => {
    const names = res.items.map(item => {
      const dress = item.type_article === 'robe'
        ? dresses.find(d => d.id === item.article_id || d.nom.toLowerCase() === item.nom_article.toLowerCase())
        : bijoux.find(b => b.id === item.article_id || b.nom.toLowerCase() === item.nom_article.toLowerCase());
      const label = dress?.nom || (item.nom_article !== 'Robe' && item.nom_article !== 'Bijou' ? item.nom_article : null);
      if (item.type_article === 'bijou') return label ? `Accessoire (${label})` : 'Accessoire';
      return label || 'Robe';
    });
    return names.length ? names.join(', ') : 'Robe de Soirée';
  };

  const getDressPhoto = (res: Reservation) => {
    const dress = getDressForReservation(res);
    if (dress && dress.photo_principale) return dress.photo_principale;
    return 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=300';
  };

  const formatDa = (amount: number) => {
    return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' DA';
  };

  // What this calendar date means for this particular booking: the dress
  // leaves, comes back, or — everything strictly between the two — the event
  // itself is happening. Sortie is checked first, so a same-day rental reads
  // as a departure rather than a return.
  const getDateRole = (res: Reservation, dateStr: string): DateRole => {
    if (dateStr === res.date_sortie) return 'sortie';
    if (dateStr === res.date_retour) return 'retour';
    return 'evenement';
  };

  const dateRoleStyle = (role: DateRole) => {
    switch (role) {
      case 'sortie':
        return {
          bg: 'bg-blue-100 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
          label: language === 'fr' ? 'Sortie' : 'خروج'
        };
      case 'retour':
        return {
          bg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          label: language === 'fr' ? 'Retour' : 'إرجاع'
        };
      case 'evenement':
        return {
          bg: 'bg-red-100 text-red-700 border-red-200',
          dot: 'bg-red-500',
          label: language === 'fr' ? "Jour de l'évènement" : 'يوم المناسبة'
        };
    }
  };

  // Date Math Navigation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(todayIso());
  };

  const openDayModal = (dateStr: string) => {
    setSelectedDay(dateStr);
    setIsDayModalOpen(true);
  };

  const monthNamesFr = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const monthNamesAr = [
    'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
    'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const daysHeaderFr = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const daysHeaderAr = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];

  const monthLabel = language === 'fr' ? monthNamesFr[month] : monthNamesAr[month];

  // Days in current viewed month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Adjust starting day of week (0=Sun, 1=Mon... -> 0=Mon, 6=Sun)
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const totalDaysInMonth = lastDayOfMonth.getDate();

  // Create grid cells (previous month padding + current month days + next month padding)
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const calendarCells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const prevDay = prevMonthLastDay - i;
    const prevDate = new Date(year, month - 1, prevDay);
    const dateStr = prevDate.toISOString().split('T')[0];
    calendarCells.push({ dateStr, dayNum: prevDay, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    // Format YYYY-MM-DD manually to avoid timezone shift
    const yStr = cellDate.getFullYear();
    const mStr = String(cellDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;
    calendarCells.push({ dateStr, dayNum: d, isCurrentMonth: true });
  }

  // Next month leading days to complete grid (42 cells = 6 rows)
  const remainingCells = 42 - calendarCells.length;
  for (let n = 1; n <= remainingCells; n++) {
    const nextDate = new Date(year, month + 1, n);
    const yStr = nextDate.getFullYear();
    const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(n).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;
    calendarCells.push({ dateStr, dayNum: n, isCurrentMonth: false });
  }

  // Filter reservations based on search term & status filter
  const filteredReservations = liveReservations.filter(res => {
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'en_cours' && res.statut !== 'en_cours' && res.statut !== 'en_location' && res.statut !== 'en_retard') return false;
      if (statusFilter === 'future' && res.statut !== 'future' && res.statut !== 'reservee') return false;
      if (statusFilter === 'retourne' && res.statut !== 'retourne') return false;
    }
    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const client = getClientName(res).toLowerCase();
      const dress = getDressName(res).toLowerCase();
      return client.includes(term) || dress.includes(term) || res.id.toLowerCase().includes(term);
    }
    return true;
  });

  // Get reservations active on a specific date (date_sortie <= dateStr <= date_retour)
  const getReservationsForDate = (dateStr: string) => {
    return filteredReservations.filter(res => {
      return res.date_sortie <= dateStr && dateStr <= res.date_retour;
    });
  };

  // Reservations on currently selected day
  const selectedDayReservations = selectedDay ? getReservationsForDate(selectedDay) : [];

  // Monthly statistics
  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthReservations = liveReservations.filter(r =>
    r.date_sortie.startsWith(currentMonthPrefix) || r.date_retour.startsWith(currentMonthPrefix)
  );

  const activeRentalsCount = monthReservations.filter(r => r.statut === 'en_cours' || r.statut === 'en_location' || r.statut === 'en_retard').length;
  const futureRentalsCount = monthReservations.filter(r => r.statut === 'future' || r.statut === 'reservee').length;
  const returnedCount = monthReservations.filter(r => r.statut === 'retourne').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[24px] border border-neutral-200 ${
        isRtl ? 'md:flex-row-reverse text-right' : 'text-left'
      }`}>
        <div>
          <div className={`flex items-center gap-3 mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="p-2.5 bg-orange-600 text-white rounded-xl">
              <CalendarIcon size={22} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {language === 'fr' ? 'Calendrier des Réservations' : 'تقويم الحجوزات والتأجير'}
            </h1>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            {language === 'fr'
              ? 'Aperçu mensuel de la disponibilité des robes et plannings de sortie/retour'
              : 'جدول شهري لمتابعة خروج وإرجاع الفساتين وتوفر الموديلات'}
          </p>
        </div>

        {/* Quick Month Navigation */}
        <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <button
            id="cal-prev-month-btn"
            onClick={handlePrevMonth}
            className="p-2.5 bg-slate-100 hover:bg-orange-100 text-gray-700 hover:text-orange-700 rounded-xl transition-all cursor-pointer"
            title={language === 'fr' ? 'Mois précédent' : 'الشهر السابق'}
          >
            {isRtl ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>

          <div className="px-4 py-2 bg-slate-50 border border-neutral-200 rounded-xl font-extrabold text-gray-800 text-base min-w-[160px] text-center shadow-inner">
            {monthLabel} {year}
          </div>

          <button
            id="cal-next-month-btn"
            onClick={handleNextMonth}
            className="p-2.5 bg-slate-100 hover:bg-orange-100 text-gray-700 hover:text-orange-700 rounded-xl transition-all cursor-pointer"
            title={language === 'fr' ? 'Mois suivant' : 'الشهر التالي'}
          >
            {isRtl ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>

          <button
            id="cal-today-btn"
            onClick={handleToday}
            className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer ml-1"
          >
            {language === 'fr' ? "Aujourd'hui" : 'اليوم'}
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">{language === 'fr' ? 'Réservations ce mois' : 'حجوزات هذا الشهر'}</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{monthReservations.length}</p>
          </div>
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
            <CalendarIcon size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-red-500 font-bold uppercase">{language === 'fr' ? 'Locations en cours' : 'تأجير حالي'}</p>
            <p className="text-2xl font-extrabold text-red-600 mt-1">{activeRentalsCount}</p>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-500 font-bold uppercase">{language === 'fr' ? 'Réservations futures' : 'حجوزات قادمة'}</p>
            <p className="text-2xl font-extrabold text-blue-600 mt-1">{futureRentalsCount}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Sparkles size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-500 font-bold uppercase">{language === 'fr' ? 'Retours effectués' : 'مرتجعات مكتملة'}</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{returnedCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className={`bg-white p-4 rounded-2xl border border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-4 ${
        isRtl ? 'md:flex-row-reverse' : ''
      }`}>
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={18} className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
          <input
            id="cal-search-input"
            type="text"
            placeholder={language === 'fr' ? 'Rechercher cliente, robe...' : 'بحث عن زبونة أو فستان...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500 ${
              isRtl ? 'pr-10 pl-3 text-right' : 'pl-10 pr-3 text-left'
            }`}
          />
        </div>

        {/* Status Filter Buttons */}
        <div className={`flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-gray-600 hover:bg-slate-200'
            }`}
          >
            {language === 'fr' ? 'Tous' : 'الكل'}
          </button>

          <button
            onClick={() => setStatusFilter('en_cours')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'en_cours'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            {language === 'fr' ? 'Locations en cours' : 'تأجير حالي'}
          </button>

          <button
            onClick={() => setStatusFilter('future')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'future'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            {language === 'fr' ? 'Futures' : 'مستقبلية'}
          </button>

          <button
            onClick={() => setStatusFilter('retourne')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'retourne'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {language === 'fr' ? 'Retournés' : 'تم الإرجاع'}
          </button>
        </div>
      </div>

      {/* Calendar Grid — full width now that a day's detail opens as a popup
          instead of a panel sharing the row */}
      <div className="bg-white p-5 rounded-[24px] border border-neutral-200 overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {(language === 'fr' ? daysHeaderFr : daysHeaderAr).map((day, idx) => (
            <div key={idx} className="py-2 text-xs font-extrabold text-gray-400 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid Cells */}
        <div className="grid grid-cols-7 gap-1.5">
          {calendarCells.map((cell, index) => {
            const dayReservations = getReservationsForDate(cell.dateStr);
            const isToday = cell.dateStr === todayIso();
            const isSelected = cell.dateStr === selectedDay;
            const hasReservations = dayReservations.length > 0;

            return (
              <div
                key={`${cell.dateStr}-${index}`}
                id={`cal-day-${cell.dateStr}`}
                onClick={() => openDayModal(cell.dateStr)}
                className={`min-h-[85px] sm:min-h-[95px] p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative ${
                  isSelected
                    ? 'border-orange-600 bg-orange-50/50 ring-2 ring-orange-500/20'
                    : cell.isCurrentMonth
                      ? 'border-gray-100 bg-white hover:border-orange-300 hover:bg-slate-50/80'
                      : 'border-gray-50 bg-slate-50/40 opacity-40 hover:opacity-70'
                }`}
              >
                {/* Top Bar inside cell: Day Number & Today indicator */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold rounded-lg w-6 h-6 flex items-center justify-center ${
                    isToday
                      ? 'bg-orange-600 text-white font-extrabold'
                      : cell.isCurrentMonth ? 'text-gray-800' : 'text-gray-400'
                  }`}>
                    {cell.dayNum}
                  </span>

                  {hasReservations && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
                      {dayReservations.length}
                    </span>
                  )}
                </div>

                {/* Reservation Dots & Badges — colour tells what this day is
                    for the booking: departure, event, or return. */}
                <div className="mt-1 space-y-1">
                  {dayReservations.slice(0, 2).map((res) => {
                    const role = getDateRole(res, cell.dateStr);
                    const style = dateRoleStyle(role);
                    const dressName = getDressName(res);

                    return (
                      <div
                        key={res.id}
                        className={`px-1.5 py-0.5 rounded-lg text-[10px] font-semibold truncate border flex items-center gap-1 transition-transform group-hover:scale-[1.02] ${style.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`}></span>
                        <span className="truncate leading-none">{dressName}</span>
                      </div>
                    );
                  })}

                  {dayReservations.length > 2 && (
                    <p className="text-[9px] text-gray-400 font-bold px-1 text-center">
                      +{dayReservations.length - 2} {language === 'fr' ? 'autres' : 'آخرين'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span className="text-gray-600 font-medium">{language === 'fr' ? 'Jour de sortie' : 'يوم الخروج'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span className="text-gray-600 font-medium">{language === 'fr' ? "Jour de l'évènement" : 'يوم المناسبة'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-gray-600 font-medium">{language === 'fr' ? 'Jour de retour' : 'يوم الإرجاع'}</span>
          </div>
        </div>
      </div>

      {/* Day Detail Popup — opens the instant a cell is tapped, on phone and
          desktop alike, instead of a panel the visitor had to scroll to. */}
      <AnimatePresence>
        {isDayModalOpen && selectedDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDayModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col z-10 max-h-[85vh]"
            >
              {/* Header */}
              <div className={`p-5 border-b border-neutral-200 flex justify-between items-center bg-slate-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={isRtl ? 'text-right' : 'text-left'}>
                  <h2 className="text-base font-bold text-gray-900">
                    {new Date(selectedDay).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'ar-DZ', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </h2>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    {selectedDayReservations.length}{' '}
                    {language === 'fr' ? 'réservation(s) pour cette date' : 'حجز في هذا التاريخ'}
                  </p>
                </div>
                <button
                  id="cal-day-modal-close-btn"
                  onClick={() => setIsDayModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5">
                {selectedDayReservations.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto text-gray-300">
                      <CalendarIcon size={24} />
                    </div>
                    <p className="text-xs font-semibold">
                      {language === 'fr' ? 'Aucune réservation prévue à cette date' : 'لا توجد حجوزات في هذا اليوم'}
                    </p>
                    <button
                      onClick={() => {
                        setIsDayModalOpen(false);
                        setCurrentTab?.('reservations');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
                    >
                      <span>{language === 'fr' ? '+ Créer une réservation' : '+ إضافة حجز جديد'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDayReservations.map((res) => {
                      const role = getDateRole(res, selectedDay);
                      const style = dateRoleStyle(role);
                      const dressName = getDressName(res);
                      const dressPhoto = getDressPhoto(res);
                      const clientName = getClientName(res);
                      const clientPhone = getClientPhone(res);

                      return (
                        <div
                          key={res.id}
                          className="p-4 rounded-2xl bg-slate-50 border border-neutral-200 space-y-3"
                        >
                          {/* Header: Photo, Dress Name & Day-role badge */}
                          <div className={`flex items-start gap-3 ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                            <img
                              src={dressPhoto}
                              alt={dressName}
                              className="w-14 h-14 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className={`flex items-center gap-1.5 mb-1 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${style.bg}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
                                  {style.label}
                                </span>
                                {res.statut === 'en_retard' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-100 text-red-800 border-red-300">
                                    {language === 'fr' ? 'En retard' : 'متأخر'}
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-gray-400 ml-auto">
                                  #{res.id.slice(-6).toUpperCase()}
                                </span>
                              </div>
                              <h3 className="text-sm font-extrabold text-gray-900 truncate">
                                {dressName}
                              </h3>
                            </div>
                          </div>

                          {/* Client Info */}
                          <div className={`p-2.5 bg-white rounded-xl border border-gray-100 text-xs space-y-1 ${
                            isRtl ? 'text-right' : 'text-left'
                          }`}>
                            <div className={`flex items-center gap-2 text-gray-800 font-bold ${isRtl ? 'flex-row-reverse' : ''}`}>
                              <User size={14} className="text-orange-500" />
                              <span>{clientName}</span>
                            </div>
                            {clientPhone && (
                              <div className={`flex items-center gap-2 text-gray-500 font-mono text-[11px] ${isRtl ? 'flex-row-reverse' : ''}`}>
                                <Phone size={12} className="text-gray-400" />
                                <span>{clientPhone}</span>
                              </div>
                            )}
                          </div>

                          {/* Dates Range */}
                          <div className={`flex items-center justify-between text-xs text-gray-600 pt-1 border-t border-gray-200/60 ${
                            isRtl ? 'flex-row-reverse' : ''
                          }`}>
                            <div>
                              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                                {language === 'fr' ? 'Sortie' : 'تاريخ الخروج'}
                              </span>
                              <span className="font-bold text-gray-900">{res.date_sortie}</span>
                            </div>

                            <div className="text-gray-300">➔</div>

                            <div>
                              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                                {language === 'fr' ? 'Retour' : 'تاريخ الإرجاع'}
                              </span>
                              <span className="font-bold text-gray-900">{res.date_retour}</span>
                            </div>
                          </div>

                          {/* Financial details — what remains to be paid is
                              always shown, not folded away behind a status. */}
                          <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1 border-t border-gray-200/60">
                            <div>
                              <span className="text-[9px] text-gray-400 font-bold uppercase block mb-0.5">
                                {language === 'fr' ? 'Total' : 'المجموع'}
                              </span>
                              <span className="font-extrabold text-gray-900 font-mono">{formatDa(res.montant_total_da)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-gray-400 font-bold uppercase block mb-0.5">
                                {language === 'fr' ? 'Payé' : 'مدفوع'}
                              </span>
                              <span className="font-bold text-emerald-600 font-mono">{formatDa(res.montant_paye_da)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-gray-400 font-bold uppercase block mb-0.5">
                                {language === 'fr' ? 'Reste à payer' : 'الباقي'}
                              </span>
                              <span className={`font-bold font-mono px-1.5 py-0.5 rounded ${
                                res.reste_a_payer_da > 0 ? 'text-red-600 bg-red-50' : 'text-emerald-700 bg-emerald-50'
                              }`}>
                                {formatDa(res.reste_a_payer_da)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
