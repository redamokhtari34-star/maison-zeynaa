import React, { useState } from 'react';
import { 
  Search, 
  Layers, 
  Gem, 
  Calendar, 
  CheckCircle, 
  X, 
  AlertTriangle, 
  Sparkles, 
  Wrench, 
  DollarSign, 
  ArrowUpRight
} from 'lucide-react';
import { Reservation, Dress, Bijou, Language, Transaction } from '../types';
import { translations } from '../translations';
import { addHistoryEntry, getSupabaseClient, mapReservationToDb, mapTransactionToDb } from '../lib/storage';
import { todayIso, formatDay, shortRef } from '../lib/dates';
import { notifyError } from '../lib/toast';
import { mirrorToCloud } from '../lib/sync';

const LOCAL_SYNC_FAIL = "Modification enregistrée sur cet appareil, "
  + "mais la synchronisation avec le cloud a échoué.";

interface RetoursProps {
  reservations: Reservation[];
  onSaveReservations: (reservations: Reservation[]) => void;
  dresses: Dress[];
  onSaveDresses: (dresses: Dress[]) => void;
  bijoux: Bijou[];
  onSaveBijoux: (bijoux: Bijou[]) => void;
  onAddTransaction: (transaction: any) => void;
  clientes: any[];
  language: Language;
  onRefreshData?: () => void;
  canSeeAmounts?: boolean;
}

export default function Retours({
  reservations,
  onSaveReservations,
  dresses,
  onSaveDresses,
  bijoux,
  onSaveBijoux,
  onAddTransaction,
  clientes,
  language,
  onRefreshData,
  canSeeAmounts = true
}: RetoursProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const todayStr = todayIso();

  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected Return action state
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Return wizard parameters
  const [penalite, setPenalite] = useState<number>(0);
  const [motifPenalite, setMotifPenalite] = useState('');
  const [conditionItems, setConditionItems] = useState<{ [key: string]: 'excellent' | 'degrade' }>({});
  const [maintenanceItems, setMaintenanceItems] = useState<{ [key: string]: 'disponible' | 'en_entretien' }>({});
  // Synchronous double-submit lock — a useState guard isn't reliable here
  // (setState isn't synchronous, so two clicks close together can both read
  // the stale value); a ref updates immediately. Same fix as the reservation
  // wizard's duplicate-transaction bug.
  const submittingRef = React.useRef(false);

  const getClientName = (id: string) => {
    return clientes.find(c => c.id === id)?.nom_complet || 'Inconnue';
  };

  const formatDa = (amount: number) => {
    return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount).replace(/\u202F/g, '\u00A0') + '\u00A0DA';
  };

  // Only rentals in progress or late can be returned
  const activeRentals = reservations.filter(res => 
    res.statut === 'en_cours' || res.statut === 'en_retard'
  );

  // Overdue first, then by the date each piece is due back.
  const filteredRentals = activeRentals
    .filter(res => {
      const query = searchTerm.trim().toLowerCase();
      if (!query) return true;
      return getClientName(res.cliente_id).toLowerCase().includes(query)
        || res.items.some(item => item.nom_article.toLowerCase().includes(query));
    })
    .sort((a, b) =>
      (a.statut === 'en_retard' ? 0 : 1) - (b.statut === 'en_retard' ? 0 : 1)
      || a.date_retour.localeCompare(b.date_retour)
    );

  // Open return handler
  const openReturnModal = (res: Reservation) => {
    submittingRef.current = false;
    setSelectedRes(res);
    setPenalite(0);
    setMotifPenalite('');
    
    // Default conditions
    const defaultConditions: typeof conditionItems = {};
    const defaultMaintenance: typeof maintenanceItems = {};
    
    res.items.forEach(item => {
      defaultConditions[item.id] = 'excellent';
      defaultMaintenance[item.id] = 'disponible';
    });

    setConditionItems(defaultConditions);
    setMaintenanceItems(defaultMaintenance);
    setIsReturnModalOpen(true);
  };

  // Submit return
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!selectedRes) return;
    submittingRef.current = true;

    const supabase = getSupabaseClient();

    // 1. Update Reservation status. What the client still owes is untouched —
    // returning the dress is not the same as being paid for it, and a balance
    // is only ever collected when the operator presses "Encaisser le solde".
    const updatedResObj: Reservation = {
      ...selectedRes,
      statut: 'retourne'
    };

    if (supabase) {
      mirrorToCloud(() => supabase.from('reservations').update(mapReservationToDb(updatedResObj)).eq('id', selectedRes.id), LOCAL_SYNC_FAIL);
    }

    const updatedReservations = reservations.map(r => r.id === selectedRes.id ? updatedResObj : r);
    onSaveReservations(updatedReservations);

    // 2. Update status and condition of each physical item
    const updatedDresses = [...dresses];
    const updatedBijoux = [...bijoux];

    for (const item of selectedRes.items) {
      const nextStatus = maintenanceItems[item.id];

      if (item.type_article === 'robe') {
        const dIndex = updatedDresses.findIndex(d => d.id === item.article_id);
        if (dIndex !== -1) {
          updatedDresses[dIndex] = {
            ...updatedDresses[dIndex],
            statut: nextStatus
          };
          if (supabase) {
            mirrorToCloud(() => supabase.from('robes').update({ statut: nextStatus }).eq('id', item.article_id), LOCAL_SYNC_FAIL);
          }
        }
      } else if (item.type_article === 'bijou') {
        const bIndex = updatedBijoux.findIndex(b => b.id === item.article_id);
        if (bIndex !== -1) {
          updatedBijoux[bIndex] = {
            ...updatedBijoux[bIndex],
            statut: nextStatus
          };
          if (supabase) {
            mirrorToCloud(() => supabase.from('bijoux').update({ statut: nextStatus }).eq('id', item.article_id), LOCAL_SYNC_FAIL);
          }
        }
      }
    }

    onSaveDresses(updatedDresses);
    onSaveBijoux(updatedBijoux);

    // 3. Penalty transaction logging
    if (penalite > 0) {
      const penTr: Transaction = {
        id: crypto.randomUUID(),
        type: 'entree',
        montant_da: penalite,
        description: `Pénalité dégradation - ${selectedRes.items.map(i => i.nom_article).filter(Boolean).join(', ') || 'Article'} - ${getClientName(selectedRes.cliente_id)}`,
        categorie: 'Réparation',
        date: todayStr,
        heure: new Date().toTimeString().split(' ')[0].substring(0, 5),
        utilisateur: 'Zeyna',
        note: motifPenalite || 'Dégradation d’article'
      };

      if (supabase) {
        mirrorToCloud(() => supabase.from('mouvements_caisse').insert([mapTransactionToDb(penTr)]), LOCAL_SYNC_FAIL);
      }
      onAddTransaction(penTr);
    }


    // 4. Log to history
    addHistoryEntry(
      language === 'fr' ? 'Retour enregistré' : 'تسجيل إرجاع',
      `Retour de location #${selectedRes.id.toUpperCase()} enregistré pour ${getClientName(selectedRes.cliente_id)}. Pénalités retenues: ${formatDa(penalite)}.`
    );

    setIsReturnModalOpen(false);
    setSelectedRes(null);
  };

  return (
    <div className={`space-y-8 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
        isRtl ? 'sm:flex-row-reverse' : ''
      }`}>
        <div>
          <h2 className="font-display text-[2rem] leading-tight text-neutral-900">
            {language === 'fr' ? 'Retours' : 'الإرجاع'}
          </h2>
          <p className="mt-1 text-[15px] text-neutral-500">
            {language === 'fr' 
              ? `Les pièces encore dehors, les retards en premier. Enregistrez chaque retour dès qu’il arrive.`
              : `سجلي إرجاع الملابس، افحصي حالتها، واخصمي من العربون أو الكفالة في حال حدوث أي تلف.`}
          </p>
        </div>
      </div>

      {/* Search Input filter */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200">
        <div className="relative">
          <span className={`absolute inset-y-0 flex items-center text-gray-400 pointer-events-none ${isRtl ? 'right-3.5' : 'left-3.5'}`}>
            <Search size={18} />
          </span>
          <input
            id="retours-search"
            type="text"
            placeholder={language === 'fr' ? 'Cliente ou robe…' : 'زبونة أو فستان…'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 focus:bg-white transition-colors ${
              isRtl ? 'pr-11 pl-3 text-right' : 'pl-11 pr-3 text-left'
            }`}
          />
        </div>
      </div>

      {/* List of out rentals */}
      {filteredRentals.length === 0 ? (
        <div className="bg-white py-16 px-4 rounded-2xl border border-neutral-200 text-center">
          <CheckCircle size={36} className="text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800">{language === 'fr' ? 'Tous les articles sont en magasin !' : 'كل الملابس متوفرة حالياً في الصالون !'}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {language === 'fr' ? 'Aucune location n’est en cours de livraison ou en retard.' : 'لا توجد أي فساتين معارة أو متأخرة في الوقت الحالي.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRentals.map(res => (
            <div
              key={res.id}
              className={`bg-white p-6 rounded-2xl border flex flex-col justify-between ${
                res.statut === 'en_retard' ? 'border-red-200' : 'border-neutral-200'
              }`}
            >
              <div>
                <div className={`flex justify-between items-center gap-3 mb-4 pb-4 border-b border-neutral-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <span title={res.id.toUpperCase()} className="text-[11px] font-medium text-neutral-400 tabular-nums">{shortRef(res.id)}</span>
                  <span className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                    res.statut === 'en_retard' 
                      ? 'bg-red-50 text-red-700 border border-red-100' 
                      : 'bg-blue-50 text-blue-700 border border-blue-100'
                  }`}>
                    {res.statut === 'en_retard' ? t.statut_en_retard : t.statut_en_location}
                  </span>
                </div>

                <div className={`mb-4 ${isRtl ? 'text-right' : 'text-left'}`}>
                  <h4 className="text-[15px] font-semibold text-gray-900">{getClientName(res.cliente_id)}</h4>
                  <p className={`mt-1.5 flex items-center gap-1.5 text-xs text-gray-500 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <Calendar size={13} className={res.statut === 'en_retard' ? 'text-red-500' : 'text-gray-400'} />
                    <span>{language === 'fr' ? 'À rendre le' : 'تاريخ الإرجاع:'}</span>
                    <span className={`font-semibold ${res.statut === 'en_retard' ? 'text-red-600' : 'text-gray-800'}`}>{formatDay(res.date_retour, language)}</span>
                  </p>
                </div>

                {/* Articles details */}
                <div className="space-y-1.5 mb-5">
                  {res.items.map(item => (
                    <div key={item.id} className={`flex justify-between text-[13px] py-2 px-3 bg-white border border-neutral-100 rounded-lg ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <span className={`font-medium text-gray-800 flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        {item.type_article === 'robe' ? <Layers size={13} className="text-neutral-400" /> : <Gem size={13} className="text-neutral-400" />}
                        {item.nom_article}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                id={`return-action-btn-${res.id}`}
                onClick={() => openReturnModal(res)}
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{language === 'fr' ? 'Enregistrer le retour' : 'تسجيل الإرجاع وفحص الحالة'}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Detailed Condition & Inspection return Modal */}
      {isReturnModalOpen && selectedRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsReturnModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          
          <form onSubmit={handleSubmitReturn} className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl z-10 animate-scale-up">
            <div className={`p-6 border-b border-neutral-200 flex justify-between bg-slate-50 items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-base font-bold text-gray-900">
                {language === 'fr' ? `Retour — ${getClientName(selectedRes.cliente_id)}` : `تسجيل إرجاع — ${getClientName(selectedRes.cliente_id)}`}
              </h3>
              <button type="button" onClick={() => setIsReturnModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Client info */}
              <div className={`text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                <p className="text-gray-400 font-bold uppercase">{language === 'fr' ? 'Cliente' : 'الزبونة'}</p>
                <p className="text-sm font-extrabold text-gray-900 mt-0.5">{getClientName(selectedRes.cliente_id)}</p>
              </div>

              {/* Items checklist condition & maintenance direction */}
              <div className="space-y-3">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  {language === 'fr' ? 'Fiche d’inspection des articles' : 'بطاقة معاينة وفحص الملابس'} :
                </span>

                {selectedRes.items.map(item => (
                  <div key={item.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                    <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        {item.type_article === 'robe' ? <Layers size={11} className="text-purple-500" /> : <Gem size={11} className="text-blue-500" />}
                        {item.nom_article}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Condition Selection */}
                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-400 font-bold uppercase block">{language === 'fr' ? 'État de retour' : 'حالة القطعة'}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setConditionItems({ ...conditionItems, [item.id]: 'excellent' })}
                            className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-lg border cursor-pointer text-center ${
                              conditionItems[item.id] === 'excellent' 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                : 'bg-white border-neutral-200 text-gray-500 hover:bg-slate-50'
                            }`}
                          >
                            ✓ {language === 'fr' ? 'Intact' : 'سليم'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConditionItems({ ...conditionItems, [item.id]: 'degrade' })}
                            className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-lg border cursor-pointer text-center ${
                              conditionItems[item.id] === 'degrade' 
                                ? 'bg-red-50 border-red-200 text-red-700' 
                                : 'bg-white border-neutral-200 text-gray-500 hover:bg-slate-50'
                            }`}
                          >
                            ⚠️ {language === 'fr' ? 'Abîmé' : 'تالف'}
                          </button>
                        </div>
                      </div>

                      {/* Maintenance Selection */}
                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-400 font-bold uppercase block">{language === 'fr' ? 'Étape suivante' : 'الوجهة الموالية'}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setMaintenanceItems({ ...maintenanceItems, [item.id]: 'disponible' })}
                            className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-lg border cursor-pointer text-center ${
                              maintenanceItems[item.id] === 'disponible' 
                                ? 'bg-violet-50 border-violet-200 text-violet-700' 
                                : 'bg-white border-neutral-200 text-gray-500 hover:bg-slate-50'
                            }`}
                          >
                            💍 {language === 'fr' ? 'Rayon' : 'الرف'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setMaintenanceItems({ ...maintenanceItems, [item.id]: 'en_entretien' })}
                            className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-lg border cursor-pointer text-center ${
                              maintenanceItems[item.id] === 'en_entretien' 
                                ? 'bg-gray-200 border-gray-300 text-gray-700' 
                                : 'bg-white border-neutral-200 text-gray-500 hover:bg-slate-50'
                            }`}
                          >
                            🧼 {language === 'fr' ? 'Nettoyage' : 'تنظيف'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Penalty Section — applying a damage charge is a cash
                  decision, kept to admins the same as the rest of the
                  money screens; an employé's return goes through with no
                  penalty and an admin can adjust it afterward. */}
              {canSeeAmounts && (
                <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl space-y-3.5">
                  <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                    <span className="text-xs font-bold text-red-800">{language === 'fr' ? 'Pénalité de dégradation (Retenue)' : 'خصم من كفالة الضرر'}</span>
                    <span className="text-sm font-extrabold text-red-600 font-mono">{formatDa(penalite)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-red-700 font-bold block">{language === 'fr' ? 'Frais déduits (DA)' : 'القيمة المخصومة (دج)'}</span>
                      <input
                        id="return-penalty-amount"
                        type="number"
                        min="0"
                        value={penalite}
                        onChange={(e) => setPenalite(Number(e.target.value))}
                        className="w-full p-2 bg-white border border-red-200 rounded-xl text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-red-700 font-bold block">{language === 'fr' ? 'Motif de dégradation' : 'سبب الخصم والتلف'}</span>
                      <input
                        id="return-penalty-motif"
                        type="text"
                        value={motifPenalite}
                        onChange={(e) => setMotifPenalite(e.target.value)}
                        placeholder="Ex: Tache de henné, fil d'or décousu..."
                        className="w-full p-2 bg-white border border-red-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-50 flex gap-3 bg-slate-50">
              <button type="button" onClick={() => setIsReturnModalOpen(false)} className="flex-1 py-3 px-4 bg-white border border-gray-200 text-xs font-bold text-gray-600 rounded-xl cursor-pointer">
                {t.cancel}
              </button>
              <button type="submit" id="submit-return-form" className="flex-1 py-3 px-4 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 cursor-pointer">
                {language === 'fr' ? 'Enregistrer le retour' : 'حفظ وإنهاء الإرجاع'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
