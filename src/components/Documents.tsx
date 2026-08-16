import React, { useState } from 'react';
import { 
  Printer, 
  Search, 
  Receipt, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  ShieldAlert, 
  X, 
  Phone, 
  MapPin, 
  FileText 
} from 'lucide-react';
import { Reservation, Language, Cliente } from '../types';
import { translations } from '../translations';
import { todayIso } from '../lib/dates';

interface DocumentsProps {
  reservations: Reservation[];
  clientes: Cliente[];
  language: Language;
  invoiceReservationId: string | null;
  setInvoiceReservationId: (id: string | null) => void;
}

export default function Documents({ 
  reservations, 
  clientes, 
  language,
  invoiceReservationId,
  setInvoiceReservationId
}: DocumentsProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const todayStr = todayIso();

  // Selection
  const [selectedResId, setSelectedResId] = useState<string>(
    invoiceReservationId || (reservations.length > 0 ? reservations[0].id : '')
  );

  const selectedRes = reservations.find(r => r.id === selectedResId) || null;

  const getClient = (id: string): Cliente | null => {
    return clientes.find(c => c.id === id) || null;
  };

  const formatDa = (amount: number) => {
    return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' DA';
  };

  const clientInfo = selectedRes ? getClient(selectedRes.cliente_id) : null;

  // Print handle
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`space-y-8 ${isRtl ? 'text-right' : 'text-left'} print-hide-all`} dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-100 p-6 rounded-2xl border border-neutral-200 print:hidden">
        <div>
          <h2 className="font-display text-[2rem] leading-tight text-neutral-900">
            {language === 'fr' ? 'Reçus de Caisse & Contrats' : 'سندات القبض وعقود الكراء'}
          </h2>
          <p className="mt-1 text-[15px] text-neutral-500">
            {language === 'fr' 
              ? `Générez et imprimez des reçus professionnels pour vos clientes.`
              : `استخرجي واطبعي فواتير وسندات كراء رسمية بضغطة زر واحدة لتسليمها للزبونة.`}
          </p>
        </div>
        
        {selectedRes && (
          <button
            id="print-invoice-doc-btn"
            onClick={handlePrint}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-3 rounded-2xl cursor-pointer transition-all text-sm"
          >
            <Printer size={16} />
            <span>{language === 'fr' ? 'Imprimer le reçu' : 'طباعة السند'}</span>
          </button>
        )}
      </div>

      {/* Main split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
        
        {/* Left: list of reservations to pick for print */}
        <div className="lg:col-span-1 bg-neutral-100 p-5 rounded-2xl border border-neutral-200 flex flex-col h-[550px] print:hidden">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{language === 'fr' ? 'Sélectionner une réservation' : 'اختر الحجز لإصدار السند'}</h3>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {reservations.length === 0 ? (
              <p className="text-xs text-center text-gray-400 py-10">{language === 'fr' ? 'Aucune réservation' : 'لا توجد حجوزات'}</p>
            ) : (
              reservations.map(res => {
                const client = getClient(res.cliente_id);
                const isSelected = res.id === selectedResId;
                return (
                  <div
                    key={res.id}
                    id={`doc-picker-item-${res.id}`}
                    onClick={() => {
                      setSelectedResId(res.id);
                      setInvoiceReservationId(res.id);
                    }}
                    className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-violet-600 text-white border-violet-600' 
                        : 'bg-slate-50/50 border-neutral-200 hover:bg-slate-50 text-gray-800'
                    }`}
                  >
                    <div className={`flex justify-between font-bold ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <span className="font-mono">#{res.id.toUpperCase()}</span>
                      <span>{formatDa(res.montant_total_da)}</span>
                    </div>
                    <p className={`mt-2 font-bold ${isSelected ? 'text-violet-100' : 'text-gray-900'}`}>
                      👤 {client?.nom_complet || 'Inconnue'}
                    </p>
                    <p className={`mt-1 font-mono text-[10px] ${isSelected ? 'text-violet-200' : 'text-gray-400'}`}>
                      📅 {res.date_sortie}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Printable Invoice Frame */}
        <div className="lg:col-span-2 print:w-full">
          {selectedRes && clientInfo ? (
            <div className="bg-neutral-100 p-8 rounded-2xl border border-neutral-200 max-w-2xl mx-auto printable-invoice-box print:border-0 print:p-0 print:shadow-none">
              
              {/* Receipt Header logo & salon info */}
              <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-neutral-200 ${
                isRtl ? 'sm:flex-row-reverse text-right' : 'text-left'
              }`}>
                <div>
                  <h1 className="text-2xl font-black text-violet-600 tracking-wider">MAISON ZEYNA</h1>
                  <p className="text-xs text-gray-400 font-bold uppercase mt-1">Haute Couture & Location Traditionnelle</p>
                  <div className={`flex flex-col gap-1 mt-3 text-xs text-gray-500 font-semibold ${isRtl ? 'items-end' : 'items-start'}`}>
                    <p className="flex items-center gap-1.5"><MapPin size={12} /> Hydra, Alger, Algérie</p>
                    <p className="flex items-center gap-1.5 font-mono"><Phone size={12} /> 0550 12 34 56</p>
                  </div>
                </div>

                <div className={`text-xs ${isRtl ? 'text-right' : 'text-left sm:text-right'}`}>
                  <h2 className="text-lg font-extrabold text-gray-900 uppercase">{language === 'fr' ? 'SOCIÉTÉ REÇU DE CAISSE' : 'سند قبض مالي'}</h2>
                  <p className="text-sm font-black text-violet-600 mt-1 font-mono">N° #{selectedRes.id.toUpperCase()}</p>
                  <p className="text-gray-400 mt-2 font-semibold">
                    {language === 'fr' ? 'Date d’émission' : 'تاريخ الإصدار'}: <span className="font-mono text-gray-800">{todayStr}</span>
                  </p>
                </div>
              </div>

              {/* Client & Booking details */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-neutral-200 text-xs text-gray-600 ${
                isRtl ? 'text-right' : 'text-left'
              }`}>
                <div>
                  <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">{language === 'fr' ? 'Facturé à (Cliente)' : 'الزبونة المستفيدة'}</h3>
                  <p className="text-sm font-black text-gray-900">{clientInfo.nom_complet}</p>
                  <p className="font-mono font-bold text-gray-500 mt-1">📞 {clientInfo.telephone}</p>
                  {clientInfo.adresse && <p className="text-gray-500 mt-1">{clientInfo.adresse}</p>}
                </div>

                <div>
                  <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">{language === 'fr' ? 'Période de location' : 'تفاصيل مدة الكراء'}</h3>
                  <div className="space-y-1.5 font-semibold text-gray-800">
                    <p>📅 {language === 'fr' ? 'Date de Sortie' : 'تاريخ الاستلام'}: <span className="font-mono font-bold">{selectedRes.date_sortie}</span></p>
                    <p>📅 {language === 'fr' ? 'Date de Retour' : 'تاريخ الإرجاع'}: <span className="font-mono font-bold">{selectedRes.date_retour}</span></p>
                  </div>
                </div>
              </div>

              {/* Items rented Table */}
              <div className="py-6 border-b border-neutral-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`text-gray-400 font-bold uppercase border-b border-gray-50 pb-2 ${isRtl ? 'text-right' : 'text-left'}`}>
                      <th className="pb-2">{language === 'fr' ? 'Article Loué' : 'القطعة المستأجرة'}</th>
                      <th className="pb-2 text-right">{language === 'fr' ? 'Prix Location' : 'سعر الكراء'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-semibold text-gray-800">
                    {selectedRes.items.map(item => (
                      <tr key={item.id}>
                        <td className={`py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{item.nom_article}</td>
                        <td className="py-3 text-right font-mono font-bold">{formatDa(item.prix_da)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total summary */}
              <div className="py-6 flex flex-col items-end text-xs">
                <div className="w-full sm:w-64 space-y-2.5">
                  <div className="flex justify-between text-gray-500 font-semibold">
                    <span>{t.total_price}</span>
                    <span className="font-mono text-gray-900">{formatDa(selectedRes.montant_total_da)}</span>
                  </div>

                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>{language === 'fr' ? 'Acompte Payé' : 'المبلغ المدفوع (عربون)'}</span>
                    <span className="font-mono">{formatDa(selectedRes.montant_paye_da)}</span>
                  </div>

                  {selectedRes.reste_a_payer_da > 0 && (
                    <div className="flex justify-between text-red-600 font-extrabold border-t border-dashed border-neutral-200 pt-2">
                      <span>{language === 'fr' ? 'Reste à payer' : 'المبلغ المتبقي للدفعة الثانية'}</span>
                      <span className="font-mono">{formatDa(selectedRes.reste_a_payer_da)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-violet-700 bg-violet-50 p-2.5 rounded-xl font-bold border border-violet-100 mt-4 text-[11px]">
                    <span>🛡️ {t.caution} (À déposer)</span>
                    <span className="font-mono font-black">{formatDa(selectedRes.caution_da)}</span>
                  </div>
                </div>
              </div>

              {/* Legal terms of Algerian Dress Rental */}
              <div className={`p-4 bg-slate-50 rounded-2xl border text-[10px] text-gray-500 space-y-2 leading-relaxed ${
                isRtl ? 'text-right' : 'text-left'
              }`}>
                <h4 className="font-bold text-gray-700 flex items-center gap-1.5">
                  <ShieldAlert size={12} className="text-violet-500" />
                  <span>{language === 'fr' ? 'Conditions Générales de Location' : 'شروط وعقد كراء الفساتين'}</span>
                </h4>
                <div className="space-y-1">
                  <p>1. {language === 'fr' ? 'La robe doit être restituée propre et intacte à la date convenue.' : 'يجب إرجاع الفستان نظيفاً وفي حالته الأصلية في التاريخ المحدد.'}</p>
                  <p>2. {language === 'fr' ? 'La caution sert de garantie. Elle est entièrement restituée après inspection de l’état de l’article.' : 'الكفالة (الضمان) تعتبر تأميناً مؤقتاً، وتسترجع بالكامل فور تسليم القطعة سليمة.'}</p>
                  <p>3. {language === 'fr' ? 'En cas de retard non signalé ou de dégradation majeure, des pénalités seront appliquées.' : 'في حالة التأخر عن الموعد دون إخطار المحل أو حدوث ضرر، سيتم خصم غرامة مالية من مبلغ الكفالة.'}</p>
                </div>
              </div>

              {/* Signatures */}
              <div className={`grid grid-cols-2 gap-8 pt-10 text-center text-[10px] text-gray-400 font-bold uppercase tracking-wide ${
                isRtl ? 'flex-row-reverse' : ''
              }`}>
                <div>
                  <p>{language === 'fr' ? 'Signature Cliente' : 'إمضاء وتوقيع الزبونة'}</p>
                  <div className="h-12 border-b border-neutral-200 mt-2" />
                </div>
                <div>
                  <p>{language === 'fr' ? 'Le Magasin (Maison Zeyna)' : 'ختم وتوقيع الصالون'}</p>
                  <div className="h-12 border-b border-neutral-200 mt-2" />
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-neutral-100 py-20 px-4 rounded-2xl border border-neutral-200 text-center print:hidden">
              <Receipt size={36} className="text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-800">{language === 'fr' ? 'Générez un reçu' : 'أصدار سند مالي'}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {language === 'fr' ? 'Choisissez une réservation à gauche pour charger son aperçu imprimable.' : 'اختر الحجز من القائمة على اليسار لتجهيز ومعاينة سند الدفع والقبض المالي.'}
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
