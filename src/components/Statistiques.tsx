import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Layers, 
  Gem, 
  Users, 
  Calendar, 
  ArrowUpRight, 
  CheckCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Language, Reservation, Dress, Bijou, Cliente } from '../types';
import { translations } from '../translations';
import { todayIso, isoInDays, currentMonth, currentYear } from '../lib/dates';

interface StatistiquesProps {
  reservations: Reservation[];
  dresses: Dress[];
  bijoux: Bijou[];
  clientes: Cliente[];
  transactions: any[];
  language: Language;
}

export default function Statistiques({ 
  reservations, 
  dresses, 
  bijoux, 
  clientes, 
  transactions, 
  language 
}: StatistiquesProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const todayStr = todayIso();

  // Math on revenues
  const totalRentalsCount = reservations.length;

  const entriesOnly = transactions.filter(tr => tr.type === 'entree');

  const revenueToday = entriesOnly
    .filter(tr => tr.date === todayStr)
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  // The seven days ending today
  const last7Days = Array.from({ length: 7 }, (_, i) => isoInDays(-6 + i));
  const revenueWeek = entriesOnly
    .filter(tr => last7Days.includes(tr.date))
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  const currentMonthStr = currentMonth();
  const revenueMonth = entriesOnly
    .filter(tr => tr.date.startsWith(currentMonthStr))
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  const currentYearStr = currentYear();
  const revenueYear = entriesOnly
    .filter(tr => tr.date.startsWith(currentYearStr))
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  // Compute dress popularity (counting reservation items)
  const dressRentalsMap: { [key: string]: { count: number; name: string; photo: string; cat: string } } = {};
  // Pre-fill from current dresses to show even 0 rentals
  dresses.forEach(d => {
    dressRentalsMap[d.id] = { count: 0, name: d.nom, photo: d.photo_principale, cat: d.categorie };
  });

  reservations.forEach(res => {
    res.items.forEach(item => {
      if (item.type_article === 'robe' && dressRentalsMap[item.article_id]) {
        dressRentalsMap[item.article_id].count += 1;
      }
    });
  });

  const popularDresses = Object.values(dressRentalsMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Compute jewelry popularity
  const jewelryRentalsMap: { [key: string]: { count: number; name: string; photo: string; cat: string } } = {};
  bijoux.forEach(b => {
    jewelryRentalsMap[b.id] = { count: 0, name: b.nom, photo: b.photo, cat: b.categorie };
  });

  reservations.forEach(res => {
    res.items.forEach(item => {
      if (item.type_article === 'bijou' && jewelryRentalsMap[item.article_id]) {
        jewelryRentalsMap[item.article_id].count += 1;
      }
    });
  });

  const popularJewelry = Object.values(jewelryRentalsMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Compute active clients
  const clientRentalsMap: { [key: string]: { count: number; name: string; phone: string } } = {};
  clientes.forEach(c => {
    clientRentalsMap[c.id] = { count: 0, name: c.nom_complet, phone: c.telephone };
  });

  reservations.forEach(res => {
    if (clientRentalsMap[res.cliente_id]) {
      clientRentalsMap[res.cliente_id].count += 1;
    }
  });

  const activeClientsList = Object.values(clientRentalsMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Formatting currency
  const formatDa = (amount: number) => {
    return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' DA';
  };

  // Monthly revenue for the year in progress, up to the current month
  const monthLabels = language === 'fr'
    ? ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    : ['جان', 'فيف', 'مار', 'أفر', 'ماي', 'جوا', 'جوي', 'أوت', 'سبت', 'أكت', 'نوف', 'ديس'];
  const monthsElapsed = Number(currentMonthStr.slice(5, 7));
  const monthKeys = monthLabels.slice(0, monthsElapsed).map((label, i) => ({
    label,
    key: `${currentYearStr}-${String(i + 1).padStart(2, '0')}`
  }));

  const monthlyRevenueData = monthKeys.map(m => {
    const monthTotal = entriesOnly
      .filter(tr => tr.date && tr.date.startsWith(m.key))
      .reduce((sum, tr) => sum + tr.montant_da, 0);
    return { label: m.label, value: monthTotal };
  });

  const maxVal = Math.max(...monthlyRevenueData.map(d => d.value), 300000);

  return (
    <div className={`space-y-8 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm ${
        isRtl ? 'sm:flex-row-reverse' : ''
      }`}>
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            📊 {language === 'fr' ? 'Analyses & Statistiques Commerciales' : 'لوحة التحليلات والإحصائيات للصالون'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'fr' 
              ? `Visualisez l'évolution du chiffre d'affaires et identifiez vos meilleures ventes.`
              : `تابعي نمو مداخيلك، واعرفي السلع الأكثر طلباً وتأجيراً لزيادة أرباحك.`}
          </p>
        </div>
      </div>

      {/* Grid numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-[20px] border border-gray-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Revenus Aujourd'hui</span>
          <p className="text-xl font-black text-violet-600 font-mono">{formatDa(revenueToday)}</p>
          <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold inline-block mt-2">
            + {language === 'fr' ? 'Flux quotidien' : 'سيولة يومية'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-gray-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Revenus de la Semaine</span>
          <p className="text-xl font-black text-gray-900 font-mono">{formatDa(revenueWeek)}</p>
          <span className="text-[9px] text-gray-400 block mt-2">{language === 'fr' ? 'Derniers 7 jours' : 'آخر 7 أيام'}</span>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-gray-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Revenus du Mois</span>
          <p className="text-xl font-black text-gray-900 font-mono">{formatDa(revenueMonth)}</p>
          <span className="text-[9px] text-gray-400 block mt-2">{language === 'fr' ? 'Juillet 2026' : 'جويلية 2026'}</span>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-gray-200/80 shadow-sm">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Revenus Annuels (Cumul)</span>
          <p className="text-xl font-black text-gray-900 font-mono">{formatDa(revenueYear)}</p>
          <span className="text-[9px] text-gray-400 block mt-2">{language === 'fr' ? 'Année civile 2026' : 'سنة 2026'}</span>
        </div>
      </div>

      {/* SVG Beautiful Charts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Monthly Revenue Evolution Graph */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm">
          <div className={`flex justify-between items-center mb-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div>
              <h3 className="text-base font-bold text-gray-900">{t.revenue_chart}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{language === 'fr' ? 'Évolution mensuelle des encaissements (DA)' : 'نمو المداخيل بالدينار شهرياً'}</p>
            </div>
            <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-xl">2026</span>
          </div>

          {/* Premium Custom Vector SVG Chart */}
          <div className="h-64 relative w-full pt-4">
            <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              <line x1="40" y1="20" x2="580" y2="20" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="40" y1="70" x2="580" y2="70" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="40" y1="120" x2="580" y2="120" stroke="#F1F5F9" strokeWidth="1" />
              <line x1="40" y1="170" x2="580" y2="170" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />

              {/* Horizontal Axis bottom label marker */}
              <line x1="40" y1="170" x2="580" y2="170" stroke="#E2E8F0" strokeWidth="1.5" />

              {/* SVG Area polygon filled with purple gradient */}
              <path
                d={`
                  M 40,170 
                  ${monthlyRevenueData.map((d, index) => {
                    const x = 50 + index * 83;
                    const y = 170 - (d.value / maxVal) * 130;
                    return `L ${x},${y}`;
                  }).join(' ')} 
                  L 548,170 Z
                `}
                fill="url(#areaGrad)"
              />

              {/* SVG Curve Line */}
              <path
                d={`
                  ${monthlyRevenueData.map((d, index) => {
                    const x = 50 + index * 83;
                    const y = 170 - (d.value / maxVal) * 130;
                    return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
                  }).join(' ')}
                `}
                fill="none"
                stroke="#7C3AED"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Points & Text Values */}
              {monthlyRevenueData.map((d, index) => {
                const x = 50 + index * 83;
                const y = 170 - (d.value / maxVal) * 130;
                return (
                  <g key={index} className="group/dot cursor-pointer">
                    <circle
                      cx={x}
                      cy={y}
                      r="5"
                      fill="#FFFFFF"
                      stroke="#7C3AED"
                      strokeWidth="3"
                    />
                    <text
                      x={x}
                      y={y - 12}
                      textAnchor="middle"
                      className="text-[10px] font-black fill-violet-700 font-mono"
                    >
                      {Math.round(d.value / 1000)}k
                    </text>
                    {/* Bottom label */}
                    <text
                      x={x}
                      y="190"
                      textAnchor="middle"
                      className="text-[11px] font-semibold fill-gray-400"
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right: Key metrics summary overview */}
        <div className="lg:col-span-1 bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 mb-5">{t.stats_overview}</h3>

            <div className="space-y-4">
              <div className={`p-4 bg-slate-50/50 rounded-2xl border flex gap-3 items-center ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                <div className="p-2.5 bg-violet-100 text-violet-700 rounded-xl">
                  <Layers size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Modèles de Robes</span>
                  <span className="text-base font-extrabold text-gray-900 font-mono">{dresses.length}</span>
                </div>
              </div>

              <div className={`p-4 bg-slate-50/50 rounded-2xl border flex gap-3 items-center ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <Gem size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Nombre de Bijoux</span>
                  <span className="text-base font-extrabold text-gray-900 font-mono">{bijoux.length}</span>
                </div>
              </div>

              <div className={`p-4 bg-slate-50/50 rounded-2xl border flex gap-3 items-center ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Users size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Clientes Enregistrées</span>
                  <span className="text-base font-extrabold text-gray-900 font-mono">{clientes.length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-dashed border-gray-200/80 text-xs text-gray-400 text-center font-medium leading-relaxed mt-6">
            {language === 'fr' 
              ? 'Toutes les statistiques sont basées sur le registre de ventes réelles du magasin Maison Zeyna.' 
              : 'جميع الإحصائيات دقيقة ومستخرجة من سجلات البيع الفعلية للمحل.'}
          </div>
        </div>

      </div>

      {/* Best sales / Popular sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Popular Dresses */}
        <div className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Layers size={16} className="text-purple-600" />
            <span>{t.popular_dresses}</span>
          </h3>

          <div className="space-y-4 flex-1">
            {popularDresses.map((item, index) => (
              <div key={index} className={`flex gap-3.5 items-center p-2 rounded-2xl bg-slate-50/50 border border-gray-50/30 ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                <img src={item.photo} alt={item.name} className="w-11 h-11 object-cover rounded-xl border" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-gray-900 truncate">{item.name}</h4>
                  <p className="text-[10px] text-gray-400 uppercase mt-0.5">{item.cat}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-violet-600 bg-violet-100/50 px-2.5 py-1 rounded-lg font-mono">
                    {item.count} {language === 'fr' ? 'fois' : 'مرات'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Popular Accessories */}
        <div className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Gem size={16} className="text-blue-500" />
            <span>{t.popular_jewelry}</span>
          </h3>

          <div className="space-y-4 flex-1">
            {popularJewelry.map((item, index) => (
              <div key={index} className={`flex gap-3.5 items-center p-2 rounded-2xl bg-slate-50/50 border border-gray-50/30 ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                <img src={item.photo} alt={item.name} className="w-11 h-11 object-cover rounded-xl border" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-gray-900 truncate">{item.name}</h4>
                  <p className="text-[10px] text-gray-400 uppercase mt-0.5">{item.cat}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-violet-600 bg-violet-100/50 px-2.5 py-1 rounded-lg font-mono">
                    {item.count} {language === 'fr' ? 'fois' : 'مرات'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Clients */}
        <div className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm flex flex-col">
          <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Users size={16} className="text-emerald-500" />
            <span>{t.active_clients}</span>
          </h3>

          <div className="space-y-4 flex-1">
            {activeClientsList.map((item, index) => (
              <div key={index} className={`flex gap-3.5 items-center p-2.5 rounded-2xl bg-slate-50/50 border border-gray-50/30 ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-gray-900 truncate">{item.name}</h4>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{item.phone}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg font-mono">
                    {item.count} {language === 'fr' ? 'loc.' : 'حجوزات'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
