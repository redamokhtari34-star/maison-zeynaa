import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Search, 
  Filter, 
  User, 
  Phone, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Sparkles,
  X,
  Eye,
  Info,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Reservation, Dress, Cliente, Bijou, Language } from '../types';
import { translations } from '../translations';
import { getSupabaseClient } from '../lib/storage';
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
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 6, 1)); // Default July 2026
  const [selectedDay, setSelectedDay] = useState<string | null>(todayIso());
  const [statusFilter, setStatusFilter] = useState<'all' | 'en_cours' | 'future' | 'retourne'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredRes, setHoveredRes] = useState<Reservation | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [liveReservations, setLiveReservations] = useState<Reservation[]>(reservations);
  const [loadingSupabase, setLoadingSupabase] = useState(false);

  // Sync with props or fetch live from Supabase
  useEffect(() => {
    setLiveReservations(reservations);
  }, [reservations]);

  const fetchLiveFromSupabase = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setLoadingSupabase(true);
    try {
      const { data, error } = await supabase.from('reservations').select('*');
      if (!error && data) {
        // Map data to Reservation format if needed
        const mapped: Reservation[] = data.map((row: any) => {
          const items = [];
          if (row.robe_id) {
            items.push({
              id: `item-${row.id}-robe`,
              reservation_id: String(row.id),
              type_article: 'robe' as const,
              article_id: String(row.robe_id),
              prix_da: Number(row.prix_total || 0),
              nom_article: 'Robe'
            });
          }
          if (row.bijou_id) {
            items.push({
              id: `item-${row.id}-bijou`,
              reservation_id: String(row.id),
              type_article: 'bijou' as const,
              article_id: String(row.bijou_id),
              prix_da: 0,
              nom_article: 'Bijou'
            });
          }
          return {
            id: String(row.id),
            cliente_id: String(row.client_id || row.nom_cliente || row.client_nom || ''),
            date_sortie: row.date_debut || '',
            date_retour: row.date_fin || '',
            montant_total_da: Number(row.prix_total || 0),
            caution_da: 0,
            montant_paye_da: Number(row.acompte || 0),
            reste_a_payer_da: Number(row.reste_a_payer || 0),
            statut: (row.statut_reservation || 'future') as any,
            notes: '',
            date_creation: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            items
          };
        });
        if (mapped.length > 0) {
          setLiveReservations(mapped);
        }
      }
    } catch (err) {
      console.warn('Calendar Supabase fetch error:', err);
    } finally {
      setLoadingSupabase(false);
    }
  };

  useEffect(() => {
    fetchLiveFromSupabase();
  }, []);

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

  const getDressName = (res: Reservation) => {
    const dress = getDressForReservation(res);
    if (dress) return dress.nom;
    const robeItem = res.items.find(i => i.type_article === 'robe');
    if (robeItem && robeItem.nom_article !== 'Robe') return robeItem.nom_article;
    const bijouItem = res.items.find(i => i.type_article === 'bijou');
    if (bijouItem) return `Accessoire (${bijouItem.nom_article})`;
    return 'Robe de Soirée';
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
    const now = new Date(2026, 6, 22); // July 2026
    setCurrentDate(now);
    setSelectedDay(todayIso());
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

  // Status Badge Helper
  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case 'en_cours':
      case 'en_location':
        return {
          label: language === 'fr' ? 'Location en cours' : 'تأجير حالي',
          bg: 'bg-rose-100 text-rose-700 border-rose-200',
          dot: 'bg-rose-500'
        };
      case 'en_retard':
        return {
          label: language === 'fr' ? 'En retard' : 'متأخر',
          bg: 'bg-red-100 text-red-800 border-red-300 font-bold',
          dot: 'bg-red-600'
        };
      case 'future':
      case 'reservee':
        return {
          label: language === 'fr' ? 'Réservation future' : 'حجز مستقبلي',
          bg: 'bg-violet-100 text-violet-700 border-violet-200',
          dot: 'bg-violet-500'
        };
      case 'retourne':
        return {
          label: language === 'fr' ? 'Retourné' : 'تم الإرجاع',
          bg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500'
        };
      default:
        return {
          label: statut,
          bg: 'bg-gray-100 text-gray-700 border-gray-200',
          dot: 'bg-gray-400'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[24px] border border-neutral-200 ${
        isRtl ? 'md:flex-row-reverse text-right' : 'text-left'
      }`}>
        <div>
          <div className={`flex items-center gap-3 mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="p-2.5 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-xl">
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
            className="p-2.5 bg-slate-100 hover:bg-violet-100 text-gray-700 hover:text-violet-700 rounded-xl transition-all cursor-pointer"
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
            className="p-2.5 bg-slate-100 hover:bg-violet-100 text-gray-700 hover:text-violet-700 rounded-xl transition-all cursor-pointer"
            title={language === 'fr' ? 'Mois suivant' : 'الشهر التالي'}
          >
            {isRtl ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>

          <button
            id="cal-today-btn"
            onClick={handleToday}
            className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer ml-1"
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
          <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
            <CalendarIcon size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-rose-500 font-bold uppercase">{language === 'fr' ? 'Locations en cours' : 'تأجير حالي'}</p>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">{activeRentalsCount}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-indigo-500 font-bold uppercase">{language === 'fr' ? 'Réservations futures' : 'حجوزات قادمة'}</p>
            <p className="text-2xl font-extrabold text-indigo-600 mt-1">{futureRentalsCount}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
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
            className={`w-full py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-violet-500 ${
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
                ? 'bg-rose-600 text-white' 
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            {language === 'fr' ? 'Locations en cours' : 'تأجير حالي'}
          </button>

          <button
            onClick={() => setStatusFilter('future')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'future' 
                ? 'bg-violet-600 text-white' 
                : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-violet-500"></span>
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

      {/* Main Grid + Side Details View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Calendar Grid (2 columns on lg) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-[24px] border border-neutral-200 overflow-hidden">
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
                  onClick={() => setSelectedDay(cell.dateStr)}
                  className={`min-h-[85px] sm:min-h-[95px] p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative ${
                    isSelected 
                      ? 'border-violet-600 bg-violet-50/50 ring-2 ring-violet-500/20' 
                      : cell.isCurrentMonth 
                        ? 'border-gray-100 bg-white hover:border-violet-300 hover:bg-slate-50/80' 
                        : 'border-gray-50 bg-slate-50/40 opacity-40 hover:opacity-70'
                  }`}
                >
                  {/* Top Bar inside cell: Day Number & Today indicator */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold rounded-lg w-6 h-6 flex items-center justify-center ${
                      isToday 
                        ? 'bg-violet-600 text-white font-extrabold' 
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

                  {/* Reservation Dots & Badges */}
                  <div className="mt-1 space-y-1">
                    {dayReservations.slice(0, 2).map((res) => {
                      const badge = getStatusBadge(res.statut);
                      const dressName = getDressName(res);

                      return (
                        <div
                          key={res.id}
                          onMouseEnter={(e) => {
                            setHoveredRes(res);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoverPos({ x: rect.left, y: rect.top - 10 });
                          }}
                          onMouseLeave={() => setHoveredRes(null)}
                          className={`px-1.5 py-0.5 rounded-lg text-[10px] font-semibold truncate border flex items-center gap-1 transition-transform group-hover:scale-[1.02] ${badge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${badge.dot}`}></span>
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
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span className="text-gray-600 font-medium">{language === 'fr' ? 'Location en cours' : 'تأجير حالي'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span>
              <span className="text-gray-600 font-medium">{language === 'fr' ? 'Réservation future' : 'حجز مستقبلي'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-gray-600 font-medium">{language === 'fr' ? 'Retourné' : 'تم الإرجاع'}</span>
            </div>
          </div>
        </div>

        {/* Selected Day Details Panel (1 column on lg) */}
        <div className="bg-white p-6 rounded-[24px] border border-neutral-200 space-y-4">
          <div className={`flex items-center justify-between pb-4 border-b border-gray-100 ${
            isRtl ? 'flex-row-reverse text-right' : 'text-left'
          }`}>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {selectedDay 
                  ? new Date(selectedDay).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'ar-DZ', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })
                  : (language === 'fr' ? 'Sélectionnez un jour' : 'اختر يوماً')}
              </h2>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                {selectedDayReservations.length}{' '}
                {language === 'fr' ? 'réservation(s) pour cette date' : 'حجز في هذا التاريخ'}
              </p>
            </div>

            {selectedDay === todayIso() && (
              <span className="px-2.5 py-1 bg-violet-100 text-violet-700 text-xs font-bold rounded-lg">
                {language === 'fr' ? "Aujourd'hui" : 'اليوم'}
              </span>
            )}
          </div>

          {/* List of Reservations for selected date */}
          {selectedDayReservations.length === 0 ? (
            <div className="py-12 text-center text-gray-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto text-gray-300">
                <CalendarIcon size={24} />
              </div>
              <p className="text-xs font-semibold">
                {language === 'fr' ? 'Aucune réservation prévue à cette date' : 'لا توجد حجوزات في هذا اليوم'}
              </p>
              <button
                onClick={() => setCurrentTab?.('reservations')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 hover:underline cursor-pointer"
              >
                <span>{language === 'fr' ? '+ Créer une réservation' : '+ إضافة حجز جديد'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {selectedDayReservations.map((res) => {
                const badge = getStatusBadge(res.statut);
                const dressName = getDressName(res);
                const dressPhoto = getDressPhoto(res);
                const clientName = getClientName(res);
                const clientPhone = getClientPhone(res);

                return (
                  <motion.div
                    key={res.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-slate-50 border border-neutral-200 hover:border-violet-300 transition-all space-y-3 group"
                  >
                    {/* Header: Photo, Dress Name & Status */}
                    <div className={`flex items-start gap-3 ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                      <img
                        src={dressPhoto}
                        alt={dressName}
                        className="w-14 h-14 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">
                            #{res.id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                        <h3 className="text-sm font-extrabold text-gray-900 truncate group-hover:text-violet-600 transition-colors">
                          {dressName}
                        </h3>
                      </div>
                    </div>

                    {/* Client Info */}
                    <div className={`p-2.5 bg-white rounded-xl border border-gray-100 text-xs space-y-1 ${
                      isRtl ? 'text-right' : 'text-left'
                    }`}>
                      <div className={`flex items-center gap-2 text-gray-800 font-bold ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <User size={14} className="text-violet-500" />
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

                    {/* Financial details */}
                    <div className={`flex items-center justify-between text-xs font-bold pt-1 ${
                      isRtl ? 'flex-row-reverse' : ''
                    }`}>
                      <span className="text-gray-500">{language === 'fr' ? 'Total' : 'المجموع'}: {formatDa(res.montant_total_da)}</span>
                      {res.reste_a_payer_da > 0 ? (
                        <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md text-[11px]">
                          {language === 'fr' ? 'Reste' : 'المتبقي'}: {formatDa(res.reste_a_payer_da)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
                          {language === 'fr' ? 'Payé intégralement' : 'مدفوع بالكامل'}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
