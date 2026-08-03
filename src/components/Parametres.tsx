import React, { useState } from 'react';
import { 
  Settings, 
  Trash2, 
  FileJson, 
  Upload, 
  Download, 
  MapPin, 
  Phone, 
  Store, 
  CheckCircle, 
  AlertTriangle,
  Info
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../translations';
import {
  resetDatabaseToDefaults,
  addHistoryEntry, 
  getFullDatabaseState, 
  saveDresses, 
  saveBijoux, 
  saveClientes, 
  saveReservations, 
  saveTransactions 
} from '../lib/storage';
import { notifyError } from '../lib/toast';

interface ParametresProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onResetData: () => void;
  languageList: Language[];
}

export default function Parametres({ language, onLanguageChange, onResetData }: ParametresProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const [salonName, setSalonName] = useState('Maison Zeyna');
  const [phone, setPhone] = useState('0550 12 34 56');
  const [address, setAddress] = useState('Hydra, Alger, Algérie');
  const [openingHours, setOpeningHours] = useState('09:00 - 19:00');

  // Trigger JSON backup download
  const handleBackupDownload = () => {
    const data = getFullDatabaseState();

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `maison_zeyna_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    addHistoryEntry(
      language === 'fr' ? 'Sauvegarde téléchargée' : 'تحميل نسخة احتياطية',
      "Une copie de sauvegarde de toutes les données du magasin a été exportée au format JSON."
    );
  };

  // Trigger JSON backup restore upload
  const handleBackupRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (uploadEvent) => {
        try {
          const parsed = JSON.parse(uploadEvent.target?.result as string);
          
          const msg = language === 'fr'
            ? 'Êtes-vous sûr d’importer ce fichier de sauvegarde ? Les données actuelles seront synchronisées avec Supabase.'
            : 'هل أنت متأكد من استيراد ملف النسخة الاحتياطية هذا؟ سيتم استبدال البيانات الحالية بالكامل.';
          
          if (window.confirm(msg)) {
            if (parsed.dresses) saveDresses(parsed.dresses);
            if (parsed.bijoux) saveBijoux(parsed.bijoux);
            if (parsed.clientes) saveClientes(parsed.clientes);
            if (parsed.reservations) saveReservations(parsed.reservations);
            if (parsed.transactions) saveTransactions(parsed.transactions);

            notifyError(language === 'fr' ? 'Restauration réussie !' : 'تم استيراد البيانات بنجاح !');
            window.location.reload();
          }
        } catch (err) {
          notifyError(language === 'fr' ? 'Format de fichier de sauvegarde non valide !' : 'صيغة ملف غير صحيحة !');
        }
      };
    }
  };

  // Factory reset
  const handleFactoryReset = () => {
    const msg = language === 'fr'
      ? 'Êtes-vous sûr de vouloir réinitialiser TOUTES les données ? Cette action est irréversible.'
      : 'هل أنت متأكد من إعادة ضبط المصنع؟ سيتم مسح جميع التغييرات والحجوزات والملابس الجديدة واستعادة البيانات النموذجية الأولية.';

    if (window.confirm(msg)) {
      onResetData();
    }
  };

  return (
    <div className={`space-y-8 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
        isRtl ? 'sm:flex-row-reverse' : ''
      }`}>
        <div>
          <h2 className="font-display text-[2rem] leading-tight text-neutral-900">
            {language === 'fr' ? 'Paramètres Généraux du Salon' : 'إعدادات الصالون والمحل'}
          </h2>
          <p className="mt-1 text-[15px] text-neutral-500">
            {language === 'fr' 
              ? `Personnalisez le fonctionnement de votre boutique, sauvegardez ou réinitialisez vos données.`
              : `قومي بتخصيص صالونك، إدارة لغة الواجهة، وتحميل أو استيراد النسخ الاحتياطية للسلامة.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left: General Info Settings Form */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-6">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Store size={18} className="text-violet-600" />
            <span>{language === 'fr' ? 'Coordonnées de la boutique' : 'معلومات وتفاصيل المحل'}</span>
          </h3>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">{language === 'fr' ? 'Nom du magasin' : 'اسم المحل'}</label>
              <input
                id="settings-salon-name"
                type="text"
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 font-bold ${
                  isRtl ? 'text-right' : 'text-left'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">{language === 'fr' ? 'Numéro de téléphone' : 'رقم الهاتف'}</label>
              <input
                id="settings-salon-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 text-left font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">{language === 'fr' ? 'Adresse physique' : 'العنوان الجغرافي'}</label>
              <input
                id="settings-salon-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
                  isRtl ? 'text-right' : 'text-left'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">{language === 'fr' ? 'Heures d’ouverture' : 'ساعات العمل'}</label>
              <input
                id="settings-salon-hours"
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>
          </div>

          <div className="p-3.5 bg-violet-50/50 border border-violet-100 rounded-2xl flex gap-2.5 items-start text-xs text-violet-900">
            <Info size={16} className="text-violet-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {language === 'fr' 
                ? 'Ces informations apparaîtront automatiquement sur l’en-tête de vos reçus et factures imprimables.' 
                : 'هذه المعلومات تظهر تلقائياً في ترويسة جميع السندات والفواتير المطبوعة المسلمة للزبونات.'}
            </p>
          </div>
        </div>

        {/* Right: Backup controls */}
        <div className="space-y-8">

          {/* Backup Database management */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-5">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileJson size={18} className="text-violet-600" />
              <span>{language === 'fr' ? 'Sauvegarde & Sécurité' : 'حفظ واستيراد البيانات'}</span>
            </h3>

            <p className="text-xs text-gray-400 leading-relaxed">
              {language === 'fr' 
                ? 'Exportez toutes vos fiches clientes, réservations, caisse et catalogue sous forme de fichier de sauvegarde, ou importez un ancien fichier.' 
                : 'قومي بتنزيل نسخة كاملة من سجلات صالونك كملف خارجي للسلامة، أو استعيدي نسخة سابقة بأمان.'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Download JSON backup */}
              <button
                id="download-backup-btn"
                type="button"
                onClick={handleBackupDownload}
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-gray-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Download size={14} />
                <span>{language === 'fr' ? 'Télécharger' : 'تحميل نسخة'}</span>
              </button>

              {/* Upload backup JSON */}
              <label className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-gray-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all text-center">
                <Upload size={14} />
                <span>{language === 'fr' ? 'Restaurer' : 'استيراد نسخة'}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleBackupRestore}
                  className="hidden"
                />
              </label>
            </div>

            {/* Advanced danger zone reset */}
            <div className="pt-4 border-t border-dashed border-neutral-200">
              <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div>
                  <span className="text-xs font-bold text-red-600 uppercase block">{language === 'fr' ? 'Zone de danger' : 'منطقة الخطر'}</span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">{language === 'fr' ? 'Remettre à zéro' : 'إعادة ضبط المصنع'}</span>
                </div>
                
                <button
                  id="factory-reset-btn"
                  type="button"
                  onClick={handleFactoryReset}
                  className="py-2.5 px-4 bg-red-50 hover:bg-red-100/80 active:bg-red-200 text-red-600 hover:text-red-700 text-xs font-bold rounded-xl border border-red-200/60 transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>{language === 'fr' ? 'Réinitialiser' : 'مسح البيانات'}</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
