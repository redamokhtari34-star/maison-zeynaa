import React, { useState } from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowDownLeft,
  Trash2, 
  Wallet, 
  Banknote,
  RefreshCcw, 
  AlertTriangle, 
  DollarSign, 
  Calendar, 
  Clock, 
  User, 
  History, 
  X, 
  FileText 
} from 'lucide-react';
import { Transaction, TransactionType, Language } from '../types';
import { translations } from '../translations';
import { addHistoryEntry, getSupabaseClient, mapTransactionToDb, updateTresorerieInDb } from '../lib/storage';
import { todayIso } from '../lib/dates';
import { notifyError } from '../lib/toast';
import { mirrorToCloud } from '../lib/sync';

const LOCAL_SYNC_FAIL = "Modification enregistrée sur cet appareil, "
  + "mais la synchronisation avec le cloud a échoué.";

interface CaisseProps {
  transactions: Transaction[];
  onSaveTransactions: (transactions: Transaction[]) => void;
  language: Language;
  initialOpenExpense?: boolean;
  onFormOpenHandled?: () => void;
  onRefreshData?: () => void;
}

export default function Caisse({ 
  transactions, 
  onSaveTransactions, 
  language,
  initialOpenExpense,
  onFormOpenHandled,
  onRefreshData
}: CaisseProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const todayStr = todayIso();

  // Forms states
  const [isExpenseOpen, setIsExpenseOpen] = useState(initialOpenExpense || false);
  const [isEmptyCaisseOpen, setIsEmptyCaisseOpen] = useState(false);

  React.useEffect(() => {
    if (initialOpenExpense) {
      setIsExpenseOpen(true);
      onFormOpenHandled?.();
    }
  }, [initialOpenExpense, onFormOpenHandled]);

  // Form Fields
  const [montant, setMontant] = useState<number>(0);
  const [desc, setDesc] = useState('');
  const [expCategory, setExpCategory] = useState('Entretien des robes');
  const [note, setNote] = useState('');
  const [beneficiaire, setBeneficiaire] = useState('');
  const [sourceArgent, setSourceArgent] = useState<'caisse' | 'tresorerie'>('caisse');
  const [retraitMontant, setRetraitMontant] = useState<number | ''>('');

  // Calculations
  const totalEntries = transactions
    .filter(tr => tr.type === 'entree')
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  const totalExpenses = transactions
    .filter(tr => tr.type === 'depense')
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  const totalCaisseExpenses = transactions
    .filter(tr => tr.type === 'depense' && tr.source_argent !== 'tresorerie')
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  const totalEmptied = transactions
    .filter(tr => tr.type === 'vidage_caisse')
    .reduce((sum, tr) => sum + tr.montant_da, 0);

  const currentBalance = totalEntries - totalCaisseExpenses - totalEmptied;

  // History of Empties
  const cashEmpties = transactions.filter(tr => tr.type === 'vidage_caisse');

  // Format DZD
  const formatDa = (amount: number) => {
    return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' DA';
  };

  // Log Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (montant <= 0 || !desc) {
      notifyError(language === 'fr' ? 'Saisissez un montant et une description valides.' : 'يرجى إدخال مبلغ ووصف صحيحين.');
      return;
    }

    const newTr: Transaction = {
      id: `t-${Date.now()}`,
      type: 'depense',
      montant_da: Number(montant),
      description: desc,
      categorie: expCategory,
      date: todayStr,
      heure: new Date().toTimeString().split(' ')[0].substring(0, 5),
      utilisateur: 'Zeyna',
      note: note || undefined,
      source_argent: sourceArgent
    };

    // Post it to the till immediately; the cloud copy follows in the background
    // so a slow network never holds up the button.
    onSaveTransactions([newTr, ...transactions]);

    const supabase = getSupabaseClient();
    if (supabase) {
      mirrorToCloud(async () => {
        const res = await supabase.from('mouvements_caisse').insert([mapTransactionToDb(newTr)]);
        await updateTresorerieInDb();
        return res;
      }, LOCAL_SYNC_FAIL);
    }

    addHistoryEntry(
      language === 'fr' ? 'Dépense enregistrée' : 'مصاريف مسجلة',
      language === 'fr'
        ? `Sortie de ${sourceArgent === 'tresorerie' ? 'trésorerie' : 'caisse'} de ${formatDa(montant)} pour "${expCategory}": ${desc}.`
        : `خروج من ${sourceArgent === 'tresorerie' ? 'الخزينة' : 'الصندوق'} بقيمة ${formatDa(montant)} لأجل "${expCategory}": ${desc}.`
    );

    setIsExpenseOpen(false);
    setMontant(0);
    setDesc('');
    setNote('');
    setSourceArgent('caisse');
  };

  // Handle Cash Emptying / Withdrawal
  const openRetraitModal = () => {
    if (currentBalance <= 0) return;
    setRetraitMontant(currentBalance);
    setNote('Vidage total');
    setBeneficiaire('');
    setIsEmptyCaisseOpen(true);
  };

  const handleEmptyCaisse = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountToWithdraw = Number(retraitMontant);

    if (isNaN(amountToWithdraw) || amountToWithdraw <= 0) {
      notifyError(language === 'fr' ? 'Le montant doit être supérieur à 0 DA.' : 'يجب أن يكون المبلغ أكبر من 0 دج.');
      return;
    }

    if (amountToWithdraw > currentBalance) {
      notifyError(language === 'fr' ? 'Le montant ne peut pas dépasser le solde disponible en caisse.' : 'لا يمكن أن يتجاوز المبلغ الرصيد المتوفر في الصندوق.');
      return;
    }

    const isFullWithdrawal = amountToWithdraw === currentBalance;
    const defaultNote = isFullWithdrawal ? 'Vidage total' : 'Retrait partiel';
    const finalNote = note.trim() || defaultNote;
    const finalBeneficiaire = beneficiaire.trim();

    const newTr: Transaction = {
      id: `t-${Date.now()}`,
      type: 'vidage_caisse',
      montant_da: amountToWithdraw,
      description: language === 'fr' 
        ? `Retrait de ${formatDa(amountToWithdraw)}${finalBeneficiaire ? ` par ${finalBeneficiaire}` : ''}`
        : `سحب ${formatDa(amountToWithdraw)}${finalBeneficiaire ? ` بواسطة ${finalBeneficiaire}` : ''}`,
      categorie: 'Vidage de caisse',
      date: todayStr,
      heure: new Date().toTimeString().split(' ')[0].substring(0, 5),
      utilisateur: 'Zeyna',
      note: finalNote,
      beneficiaire: finalBeneficiaire || undefined
    };

    // Post it to the till immediately; the cloud copy follows in the background
    // so a slow network never holds up the button.
    onSaveTransactions([newTr, ...transactions]);

    const supabase = getSupabaseClient();
    if (supabase) {
      mirrorToCloud(async () => {
        const res = await supabase.from('mouvements_caisse').insert([mapTransactionToDb(newTr)]);
        await updateTresorerieInDb();
        return res;
      }, LOCAL_SYNC_FAIL);
    }

    addHistoryEntry(
      language === 'fr' ? 'Retrait de caisse' : 'سحب من الصندوق',
      language === 'fr' 
        ? `Retrait de ${formatDa(amountToWithdraw)}${finalBeneficiaire ? ` par ${finalBeneficiaire}` : ''} (${finalNote})`
        : `سحب ${formatDa(amountToWithdraw)}${finalBeneficiaire ? ` بواسطة ${finalBeneficiaire}` : ''} (${finalNote})`
    );

    setIsEmptyCaisseOpen(false);
    setRetraitMontant('');
    setNote('');
    setBeneficiaire('');
  };

  // Expense categories translation
  const categoriesMap: { [key: string]: string } = {
    'Entretien des robes': t.exp_entretien,
    'Achat d\'accessoires': t.exp_achat,
    'Réparation': t.exp_reparation,
    'Transport': t.exp_transport,
    'Autre': t.exp_autre
  };

  return (
    <div className={`space-y-8 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
        isRtl ? 'sm:flex-row-reverse' : ''
      }`}>
        <div>
          <h2 className="font-display text-[2rem] leading-tight text-neutral-900">
            {language === 'fr' ? 'Suivi de la Caisse & Trésorerie' : 'دفتر الصندوق وحساب المال'}
          </h2>
          <p className="mt-1 text-[15px] text-neutral-500">
            {language === 'fr' 
              ? `Suivez en temps réel les liquidités de la caisse du magasin.`
              : `تابعي حركة السيولة المالية بالتفصيل لضمان سلامة حسابات صالونك.`}
          </p>
        </div>
        
        {/* Buttons */}
        <div className={`flex flex-wrap gap-2.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <button
            id="open-expense-btn"
            onClick={() => setIsExpenseOpen(true)}
            className="flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold px-4 py-2.5 rounded-2xl cursor-pointer text-xs border border-rose-100"
          >
            <Plus size={14} />
            <span>{language === 'fr' ? 'Ajouter une dépense' : 'مصاريف جديدة'}</span>
          </button>

          <button
            id="open-empty-cash-btn"
            onClick={openRetraitModal}
            disabled={currentBalance <= 0}
            title={currentBalance <= 0 ? (language === 'fr' ? 'La caisse est vide (0 DA)' : 'الصندوق فارغ (0 دج)') : undefined}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold px-4 py-2.5 rounded-2xl cursor-pointer text-xs shadow-amber-500/10 transition-all"
          >
            <Wallet size={14} />
            <span>{language === 'fr' ? 'Effectuer un retrait' : 'إجراء سحب'}</span>
          </button>
        </div>
      </div>

      {/* Grid: 4 Big KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Balance */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 left-0 h-1 bg-orange-600" />
          <div className={`flex justify-between items-start mb-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {language === 'fr' ? 'Solde disponible' : 'الرصيد المتوفر'}
            </span>
            <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
              <Wallet size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 leading-tight font-mono">{formatDa(currentBalance)}</p>
          <span className="text-[11px] text-gray-400 font-medium block mt-2">
            {language === 'fr' ? 'Liquidités physiques restantes' : 'السيولة المتبقية في الصندوق'}
          </span>
        </div>

        {/* Card 2: Inputs */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-500" />
          <div className={`flex justify-between items-start mb-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {language === 'fr' ? 'Total Entrées' : 'إجمالي المداخيل'}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 leading-tight font-mono">{formatDa(totalEntries)}</p>
          <span className="text-[11px] text-gray-400 font-medium block mt-2">
            {language === 'fr' ? 'Acomptes & Paiements reçus' : 'الأقساط والدفعات المستلمة'}
          </span>
        </div>

        {/* Card 3: Outputs (Expenses) */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 left-0 h-1 bg-rose-500" />
          <div className={`flex justify-between items-start mb-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {language === 'fr' ? 'Total Dépenses' : 'إجمالي المصاريف'}
            </span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <ArrowDownRight size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600 leading-tight font-mono">{formatDa(totalCaisseExpenses)}</p>
          <span className="text-[11px] text-gray-400 font-medium block mt-2">
            {language === 'fr' ? 'Achats & Frais payés depuis la caisse' : 'المصاريف المدفوعة من الصندوق'}
          </span>
        </div>

        {/* Card 4: Withdrawals (Retraits) */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
          <div className={`flex justify-between items-start mb-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {language === 'fr' ? 'Total Retraits' : 'إجمالي المسحوبات'}
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Banknote size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 leading-tight font-mono">{formatDa(totalEmptied)}</p>
          <span className="text-[11px] text-gray-400 font-medium block mt-2">
            {language === 'fr' ? 'Cumul des retraits / vidages' : 'مجموع الأموال المسحوبة من الصندوق'}
          </span>
        </div>
      </div>

      {/* Operations logs tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: General Ledger logs */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-neutral-200 flex flex-col">
          <h3 className="text-base font-bold text-gray-900 mb-5">{t.latest_operations}</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`text-gray-400 font-bold uppercase border-b border-gray-50 bg-slate-50/50 rounded-xl ${
                  isRtl ? 'text-right' : 'text-left'
                }`}>
                  <th className="py-3 px-4">{t.operation_type}</th>
                  <th className="py-3 px-4">{t.source}</th>
                  <th className="py-3 px-4">{language === 'fr' ? 'Date & Heure' : 'الوقت والتاريخ'}</th>
                  <th className="py-3 px-4 text-right">{language === 'fr' ? 'Montant' : 'القيمة'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-medium">
                {transactions.slice(0, 15).map(tr => {
                  const isEntry = tr.type === 'entree';
                  const isExpense = tr.type === 'depense';
                  
                  return (
                    <tr key={tr.id} className="hover:bg-slate-50/30">
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 w-fit ${
                          isEntry 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                            : isExpense 
                              ? 'bg-rose-50 border-rose-100 text-rose-700' 
                              : 'bg-amber-50 border-amber-100 text-amber-700'
                        }`}>
                          {isEntry ? '+' : '-'} {isEntry ? (language === 'fr' ? 'Entrée' : 'مداخيل') : isExpense ? (language === 'fr' ? 'Dépense' : 'مصاريف') : (language === 'fr' ? 'Vidage' : 'تفريغ')}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-gray-950">{tr.description}</span>
                          {isExpense && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${
                              tr.source_argent === 'tresorerie'
                                ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                                : 'bg-amber-50 border-amber-100 text-amber-700'
                            }`}>
                              {tr.source_argent === 'tresorerie' 
                                ? (language === 'fr' ? 'Trésorerie' : 'الخزينة') 
                                : (language === 'fr' ? 'Caisse' : 'الصندوق')}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-violet-500 font-semibold mt-0.5">{categoriesMap[tr.categorie] || tr.categorie}</div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 font-mono">
                        {tr.date} <span className="text-gray-300">@</span> {tr.heure}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-bold text-sm font-mono ${isEntry ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isEntry ? '+' : '-'} {formatDa(tr.montant_da)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Cash Empties Historical trace logs */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-neutral-200 flex flex-col">
          <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
            <History size={16} className="text-amber-500" />
            <span>{language === 'fr' ? 'Journal des vidages' : 'سجل تفريغ الصندوق'}</span>
          </h3>

          {cashEmpties.length === 0 ? (
            <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-neutral-200 flex-1 flex flex-col items-center justify-center">
              <Wallet size={20} className="text-gray-300 mb-2" />
              <p className="text-xs text-gray-400 font-semibold">{language === 'fr' ? 'Aucun vidage de caisse effectué.' : 'لا توجد أي سحوبات أو تفريغ بعد.'}</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
              {cashEmpties.map(emp => (
                <div key={emp.id} className="p-4 rounded-2xl border border-amber-100/60 bg-amber-50/10 space-y-2.5">
                  <div className={`flex justify-between items-baseline ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] text-gray-400 font-mono">{emp.date} @ {emp.heure}</span>
                    <span className="text-sm font-black text-amber-600 font-mono">-{formatDa(emp.montant_da)}</span>
                  </div>
                  <p className={`text-xs text-gray-600 leading-relaxed font-medium ${isRtl ? 'text-right' : 'text-left'}`}>
                    {emp.beneficiaire ? (
                      language === 'fr' 
                        ? `Retrait de ${formatDa(emp.montant_da)} par ${emp.beneficiaire}${emp.note ? ` - Note: ${emp.note}` : ''}`
                        : `سحب ${formatDa(emp.montant_da)} بواسطة ${emp.beneficiaire}${emp.note ? ` - ملاحظة: ${emp.note}` : ''}`
                    ) : (
                      emp.note || (language === 'fr' ? 'Retrait d’argent de la caisse pour dépôt bancaire ou coffre-fort.' : 'سحب أموال الصندوق للإيداع أو لتسليمها لرب العمل.')
                    )}
                  </p>
                  <div className={`flex justify-between text-[10px] text-gray-400 pt-1.5 border-t border-dashed border-amber-100/50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span>👤 {emp.utilisateur}</span>
                    <span>✓ {language === 'fr' ? 'Opération validée' : 'عملية مؤكدة'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Expense Modal Form */}
      {isExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsExpenseOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <form onSubmit={handleAddExpense} className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl z-10 animate-scale-up">
            <div className={`p-6 border-b border-neutral-200 flex justify-between bg-slate-50 items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-base font-bold text-gray-900">{language === 'fr' ? 'Enregistrer une dépense' : 'تسجيل مصاريف جديدة'}</h3>
              <button type="button" onClick={() => setIsExpenseOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">{language === 'fr' ? 'Montant (DA)' : 'القيمة (دج)'} *</label>
                  <input
                    id="form-exp-amount"
                    type="number"
                    required
                    min="1"
                    value={montant}
                    onChange={(e) => setMontant(Number(e.target.value))}
                    className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">{t.expense_category}</label>
                  <select
                    id="form-exp-cat"
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full p-3 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none"
                  >
                    <option value="Entretien des robes">{t.exp_entretien}</option>
                    <option value="Achat d'accessoires">{t.exp_achat}</option>
                    <option value="Réparation">{t.exp_reparation}</option>
                    <option value="Transport">{t.exp_transport}</option>
                    <option value="Autre">{t.exp_autre}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">{language === 'fr' ? 'Motif / Description' : 'السبب / التفصيل'} *</label>
                <input
                  id="form-exp-desc"
                  type="text"
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Ex: pressing Karakou Royal, achat fil d'or..."
                  className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">
                  {language === 'fr' ? "Source de l'argent *" : "مصدر المال *"}
                </label>
                <select
                  id="form-exp-source"
                  value={sourceArgent}
                  onChange={(e) => setSourceArgent(e.target.value as 'caisse' | 'tresorerie')}
                  className="w-full p-3 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none font-medium"
                >
                  <option value="caisse">
                    {language === 'fr' ? "Caisse principale (Liquidités du jour)" : "الصندوق الرئيسي (سيولة اليوم)"}
                  </option>
                  <option value="tresorerie">
                    {language === 'fr' ? "Trésorerie / Coffre-fort (Argent retiré)" : "الخزينة / الخزنة (المال المسحوب)"}
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">{t.notes}</label>
                <input
                  id="form-exp-notes"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-50 flex gap-3 bg-slate-50">
              <button type="button" onClick={() => setIsExpenseOpen(false)} className="flex-1 py-2.5 px-4 bg-white border border-gray-200 text-xs font-bold text-gray-600 rounded-xl">
                {t.cancel}
              </button>
              <button type="submit" id="submit-exp-btn" className="flex-1 py-2.5 px-4 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700">
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Empty Cash / Retrait Secure Modal Dialog */}
      {isEmptyCaisseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsEmptyCaisseOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <form onSubmit={handleEmptyCaisse} className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl z-10 animate-scale-up border border-amber-100">
            <div className={`p-5 border-b border-amber-100 bg-amber-50/80 flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2.5 text-amber-900 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <Wallet size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {language === 'fr' ? 'Effectuer un retrait de caisse' : 'إجراء سحب من الصندوق'}
                  </h3>
                  <p className="text-[11px] text-amber-700 font-medium">
                    {language === 'fr' ? 'Saisissez le montant à retirer de la caisse' : 'أدخلي المبلغ المراد سحبه من الصندوق'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setIsEmptyCaisseOpen(false)} className="p-1 text-amber-800 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Card showing current available balance */}
              <div className="p-4 bg-amber-600 text-white rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase font-bold text-amber-100 block">
                    {language === 'fr' ? 'Solde disponible en caisse' : 'الرصيد المتوفر في الصندوق'}
                  </span>
                  <span className="text-xl font-black font-mono tracking-tight text-white block mt-0.5">
                    {formatDa(currentBalance)}
                  </span>
                </div>
                <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Wallet size={20} className="text-white" />
                </div>
              </div>

              {/* Input for withdrawal amount with quick "Tout retirer" button */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700 block">
                    {language === 'fr' ? 'Montant à retirer (DA) *' : 'المبلغ المراد سحبه (دج) *'}
                  </label>
                  <button
                    type="button"
                    id="btn-withdraw-all"
                    onClick={() => {
                      setRetraitMontant(currentBalance);
                      setNote('Vidage total');
                    }}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>{language === 'fr' ? 'Tout retirer' : 'سحب الكل'}</span>
                    <span className="text-[10px] font-mono font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                      ({formatDa(currentBalance)})
                    </span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    id="form-retrait-montant"
                    type="number"
                    required
                    min={1}
                    max={currentBalance}
                    value={retraitMontant}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setRetraitMontant(val);
                      if (typeof val === 'number' && val === currentBalance) {
                        setNote('Vidage total');
                      } else if (typeof val === 'number' && val < currentBalance) {
                        setNote('Retrait partiel');
                      }
                    }}
                    placeholder="0"
                    className={`w-full p-3.5 pr-14 border rounded-xl text-base font-extrabold font-mono focus:outline-none transition-colors ${
                      typeof retraitMontant === 'number' && retraitMontant > currentBalance
                        ? 'border-rose-400 bg-rose-50/30 text-rose-700'
                        : 'border-neutral-200 focus:border-amber-500'
                    } ${isRtl ? 'text-right' : 'text-left'}`}
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs font-bold text-gray-400 font-mono pointer-events-none">
                    DA
                  </span>
                </div>

                {/* Validation message feedback */}
                {typeof retraitMontant === 'number' && retraitMontant > currentBalance && (
                  <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-1">
                    <AlertTriangle size={12} />
                    <span>{language === 'fr' ? 'Le montant ne peut pas dépasser le solde disponible.' : 'المبلغ لا يمكن أن يتجاوز الرصيد المتوفر.'}</span>
                  </p>
                )}

                {typeof retraitMontant === 'number' && retraitMontant <= 0 && (
                  <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-1">
                    <AlertTriangle size={12} />
                    <span>{language === 'fr' ? 'Le montant doit être supérieur à 0 DA.' : 'يجب أن يكون المبلغ أكبر من 0 دج.'}</span>
                  </p>
                )}
              </div>

              {/* Beneficiary field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">
                  {language === 'fr' 
                    ? "Bénéficiaire / Personne qui récupère l'argent" 
                    : "المستفيد / الشخص الذي يستلم الأموال"}
                </label>
                <input
                  id="form-retrait-beneficiaire"
                  type="text"
                  value={beneficiaire}
                  onChange={(e) => setBeneficiaire(e.target.value)}
                  placeholder={language === 'fr' ? "Ex: Meriem, Gérant, Zeyna..." : "مثال: مريم، المسير..."}
                  className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                />
              </div>

              {/* Note / Motif field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">
                  {language === 'fr' ? 'Note / Motif du retrait (facultatif)' : 'ملاحظات / سبب السحب (اختياري)'}
                </label>
                <input
                  id="form-retrait-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={language === 'fr' ? "Ex: Retrait partiel, dépôt coffre..." : "مثال: سحب جزئي، إيداع..."}
                  className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsEmptyCaisseOpen(false)}
                className="flex-1 py-2.5 px-4 bg-white border border-gray-200 text-xs font-bold text-gray-600 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                id="confirm-retrait-btn"
                disabled={
                  retraitMontant === '' || 
                  Number(retraitMontant) <= 0 || 
                  Number(retraitMontant) > currentBalance
                }
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                {language === 'fr' ? 'Valider le retrait' : 'تأكيد السحب'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
