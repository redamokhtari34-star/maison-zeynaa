import React, { useState } from 'react';
import { Search, Layers, Gem, User, Calendar } from 'lucide-react';
import { Reservation, Cliente, Language } from '../types';
import { translations } from '../translations';
import { todayIso } from '../lib/dates';

interface DisponibiliteProps {
  reservations: Reservation[];
  clientes: Cliente[];
  language: Language;
}

// Lets the shop type a dress or jewellery name and immediately see every
// upcoming booking that includes it — the question asked before handing an
// article out, or before promising it to a new client.
export default function Disponibilite({ reservations, clientes, language }: DisponibiliteProps) {
  const t = translations[language];
  const isRtl = language === 'ar';
  const todayStr = todayIso();

  const [searchTerm, setSearchTerm] = useState('');

  const getClientName = (id: string) =>
    clientes.find(c => c.id === id)?.nom_complet || 'Inconnue';
  const getClientPhone = (id: string) =>
    clientes.find(c => c.id === id)?.telephone || '';

  const formatDa = (amount: number) =>
    new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' DA';

  const query = searchTerm.trim().toLowerCase();

  // Upcoming = not yet handed back, regardless of whether the pickup date
  // already came and went — a late return is still "upcoming" in the sense
  // that matters here: the article is not free.
  const results = query
    ? reservations
        .filter(res => res.statut !== 'retourne')
        .map(res => ({
          res,
          matchedItems: res.items.filter(i => i.nom_article.toLowerCase().includes(query))
        }))
        .filter(r => r.matchedItems.length > 0)
        .sort((a, b) => a.res.date_sortie.localeCompare(b.res.date_sortie))
    : [];

  const statusClass = (statut: Reservation['statut']) => {
    if (statut === 'future') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (statut === 'en_cours') return 'bg-blue-50 text-blue-700 border-blue-100';
    if (statut === 'en_retard') return 'bg-red-50 text-red-700 border-red-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  const statusLabel = (statut: Reservation['statut']) => {
    if (statut === 'future') return t.statut_future;
    if (statut === 'en_cours') return t.statut_en_cours;
    if (statut === 'en_retard') return t.statut_en_retard;
    return t.statut_retourne;
  };

  return (
    <div className={`space-y-8 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="font-display text-[2rem] leading-tight text-neutral-900">
          {language === 'fr' ? 'Disponibilité d’un article' : 'توفر قطعة'}
        </h2>
        <p className="mt-1 text-[15px] text-neutral-500">
          {language === 'fr'
            ? 'Tapez le nom d’une robe ou d’un bijou pour voir toutes ses prochaines réservations.'
            : 'اكتبي اسم فستان أو حلي لرؤية جميع حجوزاته القادمة.'}
        </p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-neutral-200">
        <div className="relative">
          <span className="absolute inset-y-0 flex items-center text-gray-400 pointer-events-none left-3">
            <Search size={18} />
          </span>
          <input
            id="disponibilite-search-input"
            type="text"
            autoFocus
            placeholder={language === 'fr' ? 'Ex: Caftan khadi 55, Bleu corset 35...' : 'مثال: قفطان خدي 55...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full py-3 pr-3 pl-10 bg-slate-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition-all ${
              isRtl ? 'text-right' : 'text-left'
            }`}
          />
        </div>
      </div>

      {!query ? (
        <div className="bg-white py-16 px-4 rounded-2xl border border-neutral-200 text-center">
          <Search size={36} className="text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800">
            {language === 'fr' ? 'Commencez à taper un nom' : 'ابدئي بكتابة اسم'}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {language === 'fr'
              ? 'Les réservations à venir pour cet article s’afficheront ici.'
              : 'ستظهر هنا الحجوزات القادمة لهذه القطعة.'}
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white py-16 px-4 rounded-2xl border border-neutral-200 text-center">
          <Calendar size={36} className="text-emerald-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800">
            {language === 'fr' ? 'Aucune réservation à venir' : 'لا توجد حجوزات قادمة'}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {language === 'fr'
              ? 'Cet article est libre pour toute nouvelle demande.'
              : 'هذه القطعة متاحة لأي طلب جديد.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {results.map(({ res, matchedItems }) => (
            <div
              key={res.id}
              className="bg-white p-6 rounded-2xl border border-neutral-200 flex flex-col justify-between"
            >
              <div>
                <div className={`flex justify-between items-center mb-4 pb-4 border-b border-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs font-black text-violet-600 font-mono">#{res.id.toUpperCase()}</span>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${statusClass(res.statut)}`}>
                    {statusLabel(res.statut)}
                  </span>
                </div>

                <div className={`flex items-center gap-3.5 mb-5 ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                  <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <User size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{getClientName(res.cliente_id)}</h4>
                    <p className="text-xs text-gray-400 font-mono">📞 {getClientPhone(res.cliente_id)}</p>
                  </div>
                </div>

                <div className={`grid grid-cols-2 gap-4 p-3 bg-slate-50/50 rounded-2xl text-xs border border-slate-100 mb-5 ${
                  isRtl ? 'text-right' : 'text-left'
                }`}>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">{t.start_date}</span>
                    <span className={`font-semibold font-mono ${res.date_sortie === todayStr ? 'text-amber-600' : 'text-gray-800'}`}>
                      📅 {res.date_sortie}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">{t.end_date}</span>
                    <span className={`font-semibold font-mono ${res.date_retour === todayStr ? 'text-amber-600' : 'text-gray-800'}`}>
                      📅 {res.date_retour}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                    {language === 'fr' ? 'Article(s) concerné(s)' : 'القطعة (القطع) المعنية'} :
                  </span>
                  <div className="space-y-1">
                    {matchedItems.map(item => (
                      <div key={item.id} className={`flex justify-between text-xs py-1 px-2.5 bg-violet-50 border border-violet-100 rounded-lg ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <span className="font-semibold text-violet-800 flex items-center gap-1.5">
                          {item.type_article === 'robe' ? <Layers size={10} /> : <Gem size={10} />}
                          {item.nom_article}
                        </span>
                        <span className="font-bold text-violet-900 font-mono">{formatDa(item.prix_da)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
