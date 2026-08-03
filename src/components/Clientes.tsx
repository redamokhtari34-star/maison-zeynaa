import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  Calendar, 
  Layers, 
  Gem, 
  DollarSign, 
  TrendingUp, 
  Edit3,
  X,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { Cliente, Reservation, Language } from '../types';
import { translations } from '../translations';
import { addHistoryEntry, getSupabaseClient, mapClientToDb } from '../lib/storage';

interface ClientesProps {
  clientes: Cliente[];
  onSaveClientes: (clientes: Cliente[]) => void;
  reservations: Reservation[];
  language: Language;
  initialOpenForm?: boolean;
  onFormOpenHandled?: () => void;
  onRefreshData?: () => void;
}

export default function Clientes({ 
  clientes, 
  onSaveClientes, 
  reservations, 
  language,
  initialOpenForm,
  onFormOpenHandled,
  onRefreshData
}: ClientesProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    clientes.length > 0 ? clientes[0].id : null
  );

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(initialOpenForm || false);

  React.useEffect(() => {
    if (initialOpenForm) {
      setIsFormOpen(true);
      onFormOpenHandled?.();
    }
  }, [initialOpenForm, onFormOpenHandled]);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  const [nomComplet, setNomComplet] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [notes, setNotes] = useState('');

  // Selected Client
  const selectedClient = clientes.find(c => c.id === selectedClientId) || null;

  // Filter clients
  const filteredClientes = clientes.filter(c => 
    c.nom_complet.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telephone.includes(searchTerm)
  );

  // Selected client stats
  const clientReservations = selectedClient
    ? reservations.filter(r => r.cliente_id === selectedClient.id)
    : [];

  const activeRentals = clientReservations.filter(r => r.statut === 'en_cours' || r.statut === 'en_retard');
  
  const totalInvoiced = clientReservations.reduce((sum, r) => sum + r.montant_total_da, 0);
  const totalPaid = clientReservations.reduce((sum, r) => sum + r.montant_paye_da, 0);
  const totalOwed = clientReservations.reduce((sum, r) => sum + r.reste_a_payer_da, 0);

  // Format DZD
  const formatDa = (amount: number) => {
    return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' DA';
  };

  // Open Form
  const openAddForm = () => {
    setEditingCliente(null);
    setNomComplet('');
    setTelephone('');
    setAdresse('');
    setNotes('');
    setIsFormOpen(true);
  };

  const openEditForm = (client: Cliente, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCliente(client);
    setNomComplet(client.nom_complet);
    setTelephone(client.telephone);
    setAdresse(client.adresse || '');
    setNotes(client.notes || '');
    setIsFormOpen(true);
  };

  // Delete
  const handleDelete = async (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const client = clientes.find(c => c.id === clientId);
    if (!client) return;

    const msg = language === 'fr' 
      ? `Êtes-vous sûr de vouloir supprimer la cliente "${client.nom_complet}" ? Toutes ses fiches d'historique seront inaccessibles.`
      : `هل أنت متأكد من حذف الزبونة "${client.nom_complet}"؟ سيتم حظر جميع فواتيرها وسجلاتها.`;

    if (window.confirm(msg)) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from('clients').delete().eq('id', clientId);
        if (error) {
          alert("Erreur Supabase : " + error.message);
          console.error('Supabase delete client error:', error);
        }
      }

      const updated = clientes.filter(c => c.id !== clientId);
      onSaveClientes(updated);
      onRefreshData?.();

      addHistoryEntry(
        language === 'fr' ? 'Suppression de cliente' : 'حذف زبونة',
        `La cliente "${client.nom_complet}" (ID: ${client.id}) a été supprimée.`
      );
      if (selectedClientId === clientId) {
        setSelectedClientId(updated.length > 0 ? updated[0].id : null);
      }
    }
  };

  // Submit form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomComplet || !telephone) {
      alert(language === 'fr' ? 'Le nom complet et le téléphone sont obligatoires' : 'الاسم الكامل ورقم الهاتف إجباريان');
      return;
    }

    const supabase = getSupabaseClient();

    if (editingCliente) {
      const updatedClientObj: Cliente = {
        ...editingCliente,
        nom_complet: nomComplet,
        telephone,
        adresse: adresse || undefined,
        notes: notes || undefined
      };

      if (supabase) {
        const { error } = await supabase.from('clients').update(mapClientToDb(updatedClientObj)).eq('id', editingCliente.id);
        if (error) {
          alert("Erreur Supabase : " + error.message);
          console.error('Supabase update client error:', error);
        }
      }

      const updated = clientes.map(c => c.id === editingCliente.id ? updatedClientObj : c);
      onSaveClientes(updated);
      onRefreshData?.();

      addHistoryEntry(
        language === 'fr' ? 'Modification de cliente' : 'تعديل زبونة',
        `Les informations de la cliente "${nomComplet}" ont été mises à jour.`
      );
    } else {
      if (!supabase) {
        alert("Erreur Supabase : Client Supabase non initialisé");
        return;
      }

      // Payload matching Supabase clients table columns (without id)
      const parts = nomComplet.trim().split(' ');
      const prenom = parts[0] || '';
      const nom = parts.length > 1 ? parts.slice(1).join(' ') : prenom;

      const clientRow = {
        nom,
        prenom,
        telephone,
        adresse: adresse || ''
      };

      const { data, error } = await supabase.from('clients').insert([clientRow]).select();

      if (error) {
        alert("Erreur Supabase : " + error.message);
        console.error('Supabase insert client error:', error);
        return;
      }

      alert("Client ajouté avec succès !");

      if (data && data[0]) {
        setSelectedClientId(data[0].id);
      }
      await onRefreshData?.();

      addHistoryEntry(
        language === 'fr' ? 'Création de cliente' : 'تسجيل زبونة جديدة',
        `Nouvelle fiche cliente créée pour "${nomComplet}".`
      );
    }

    setIsFormOpen(false);
  };

  return (
    <div className={`space-y-8 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm ${
        isRtl ? 'sm:flex-row-reverse' : ''
      }`}>
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            👩 {language === 'fr' ? 'Annuaire des Clientes' : 'دليل الزبونات'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'fr' 
              ? `Consultez l'historique d'achat, les encours et gérez les coordonnées de vos clientes.`
              : `اطلعي على سجل كراء الزبونات، المدفوعات والديون العالقة، وأديري معلومات التواصل الخاصة بهن.`}
          </p>
        </div>
      </div>

      {/* Main split layout: list on left (or right if RTL), details on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Clients search and list */}
        <div className="lg:col-span-1 bg-white p-5 rounded-[20px] border border-gray-200/80 shadow-sm flex flex-col h-[650px]">
          {/* Search bar */}
          <div className="relative mb-4">
            <span className={`absolute inset-y-0 flex items-center text-gray-400 pointer-events-none ${isRtl ? 'left-3' : 'left-3'}`}>
              <Search size={18} />
            </span>
            <input
              id="clients-search-input"
              type="text"
              placeholder={t.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full py-2.5 pr-3 pl-10 bg-slate-50 border border-gray-200/80 rounded-xl text-xs focus:outline-none focus:border-violet-500 focus:bg-white transition-all ${
                isRtl ? 'text-right' : 'text-left'
              }`}
            />
          </div>

          {/* List scroll container */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredClientes.length === 0 ? (
              <p className="text-xs text-center text-gray-400 py-10">
                {language === 'fr' ? 'Aucun résultat' : 'لا توجد نتائج'}
              </p>
            ) : (
              filteredClientes.map(client => {
                const isActive = client.id === selectedClientId;
                return (
                  <div
                    key={client.id}
                    id={`client-item-${client.id}`}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`p-4 rounded-2xl border text-sm cursor-pointer transition-all ${
                      isActive 
                        ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-600/10' 
                        : 'bg-slate-50/50 border-gray-200/80 hover:bg-slate-50 text-gray-800'
                    } ${isRtl ? 'text-right' : 'text-left'}`}
                  >
                    <div className={`flex justify-between items-start ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div>
                        <h4 className="font-bold leading-tight">{client.nom_complet}</h4>
                        <p className={`text-xs mt-1 font-mono flex items-center gap-1 ${isActive ? 'text-violet-100' : 'text-gray-500'}`}>
                          📞 {client.telephone}
                        </p>
                      </div>

                      {/* Small delete/edit on hover or selection */}
                      <div className="flex gap-1.5 opacity-80 hover:opacity-100">
                        <button
                          id={`edit-client-small-${client.id}`}
                          onClick={(e) => openEditForm(client, e)}
                          className={`p-1.5 rounded-lg ${isActive ? 'text-white hover:bg-violet-700' : 'text-gray-500 hover:bg-slate-100'}`}
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          id={`delete-client-small-${client.id}`}
                          onClick={(e) => handleDelete(client.id, e)}
                          className={`p-1.5 rounded-lg border transition-all duration-200 ${
                            isActive 
                              ? 'text-white/80 hover:text-white border-white/20 hover:bg-violet-700' 
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50 border-gray-200/80 hover:border-red-200/80'
                          }`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Detailed client profile sheet */}
        <div className="lg:col-span-2 space-y-6">
          {selectedClient ? (
            <>
              {/* Profile Card Header */}
              <div className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm">
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                  isRtl ? 'sm:flex-row-reverse' : ''
                }`}>
                  <div className={`flex gap-4 items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center text-white text-2xl font-black shadow-md shadow-violet-500/10">
                      {selectedClient.nom_complet.charAt(0).toUpperCase()}
                    </div>
                    <div className={isRtl ? 'text-right' : 'text-left'}>
                      <h3 className="text-xl font-bold text-gray-900 tracking-tight">{selectedClient.nom_complet}</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {language === 'fr' ? 'Cliente enregistrée le' : 'تاريخ التسجيل:'} {new Date(selectedClient.date_creation).toLocaleDateString(language === 'fr' ? 'fr-DZ' : 'ar-DZ')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Coordonnées fields */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-50 text-xs text-gray-600 ${
                  isRtl ? 'text-right' : 'text-left'
                }`}>
                  <div className={`flex gap-2.5 items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className="p-2 bg-slate-50 text-gray-500 rounded-lg">
                      <Phone size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{t.phone}</p>
                      <a href={`tel:${selectedClient.telephone}`} className="text-sm font-semibold text-gray-900 hover:underline">
                        {selectedClient.telephone}
                      </a>
                    </div>
                  </div>

                  <div className={`flex gap-2.5 items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className="p-2 bg-slate-50 text-gray-500 rounded-lg">
                      <MapPin size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{t.address}</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedClient.adresse || (language === 'fr' ? 'Non spécifiée' : 'غير محدد')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes box */}
                {selectedClient.notes && (
                  <div className={`mt-6 p-4 bg-amber-50/50 border border-amber-100 rounded-2xl flex gap-2.5 items-start text-xs text-amber-900 ${
                    isRtl ? 'flex-row-reverse text-right' : 'text-left'
                  }`}>
                    <FileText size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold mb-0.5">{t.notes} :</strong>
                      <p className="leading-relaxed font-medium">{selectedClient.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Financial Quick Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-[20px] border border-gray-200/80 shadow-sm">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">{language === 'fr' ? 'Volume Loué' : 'إجمالي المشتريات'}</span>
                  <p className="text-xl font-black text-gray-900 leading-none">{formatDa(totalInvoiced)}</p>
                  <span className="text-[10px] text-gray-400 block mt-2">
                    {clientReservations.length} {language === 'fr' ? 'réservations totales' : 'إجمالي الحجوزات'}
                  </span>
                </div>

                <div className="bg-white p-5 rounded-[20px] border border-gray-200/80 shadow-sm">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">{t.payments_made}</span>
                  <p className="text-xl font-black text-emerald-600 leading-none">{formatDa(totalPaid)}</p>
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-3.5">
                    <div 
                      className="bg-emerald-500 h-full rounded-full" 
                      style={{ width: `${totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-[20px] border border-gray-200/80 shadow-sm">
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block mb-1">{t.remaining_balance}</span>
                  <p className={`text-xl font-black leading-none ${totalOwed > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {formatDa(totalOwed)}
                  </p>
                  {totalOwed > 0 ? (
                    <span className="text-[10px] bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded mt-2 inline-block">
                      ⚠️ {language === 'fr' ? 'Créance à recouvrer' : 'ديون مستحقة للدفع'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-semibold mt-2 block">✓ {language === 'fr' ? 'Solde à jour' : 'الحساب خالص'}</span>
                  )}
                </div>
              </div>

              {/* Reservations History Sheet */}
              <div className="bg-white p-6 rounded-[20px] border border-gray-200/80 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-5">{t.history_rentals}</h3>

                {clientReservations.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-gray-200/80">
                    <Calendar size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 font-medium">{language === 'fr' ? 'Aucune réservation enregistrée.' : 'لا توجد أي حجوزات مسجلة لهذه الزبونة.'}</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {clientReservations.map(res => {
                      // Status badge color mapping
                      let statusBg = 'bg-slate-50 text-slate-700 border-slate-100';
                      if (res.statut === 'future') statusBg = 'bg-amber-50 text-amber-700 border-amber-100';
                      else if (res.statut === 'en_cours') statusBg = 'bg-blue-50 text-blue-700 border-blue-100';
                      else if (res.statut === 'en_retard') statusBg = 'bg-red-50 text-red-700 border-red-100';
                      else if (res.statut === 'retourne') statusBg = 'bg-emerald-50 text-emerald-700 border-emerald-100';

                      return (
                        <div key={res.id} className="p-4 rounded-2xl border border-gray-50 bg-slate-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className={isRtl ? 'text-right' : 'text-left'}>
                            <div className={`flex items-center gap-2 mb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                              <span className="text-xs font-bold text-violet-600 font-mono">#{res.id.toUpperCase()}</span>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${statusBg}`}>
                                {res.statut === 'future' ? t.statut_future : res.statut === 'en_cours' ? t.statut_en_cours : res.statut === 'en_retard' ? t.statut_en_retard : t.statut_retourne}
                              </span>
                            </div>

                            {/* List of articles */}
                            <p className="text-xs font-bold text-gray-800">
                              {res.items.map(i => i.nom_article).join(' + ')}
                            </p>

                            <p className="text-[11px] text-gray-400 mt-1">
                              📅 {res.date_sortie} ➔ {res.date_retour}
                            </p>
                          </div>

                          <div className={`flex sm:flex-col items-end justify-between border-t sm:border-t-0 border-dashed border-gray-200/80 pt-3 sm:pt-0 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs text-gray-400 font-semibold">{language === 'fr' ? 'Prix location' : 'سعر الكراء'}</span>
                            <span className="text-sm font-extrabold text-violet-600 mt-0.5">{formatDa(res.montant_total_da)}</span>
                            {res.reste_a_payer_da > 0 && (
                              <span className="text-[10px] font-bold text-red-600 mt-1">
                                {language === 'fr' ? 'Reste:' : 'متبقي:'} {formatDa(res.reste_a_payer_da)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white py-20 px-4 rounded-[20px] border border-gray-200/80 shadow-sm text-center">
              <User size={36} className="text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-800">{language === 'fr' ? 'Sélectionnez une cliente' : 'اختر زبونة'}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {language === 'fr' ? 'Sélectionnez une cliente dans la liste de gauche pour voir sa fiche complète.' : 'اختر زبونة من القائمة لعرض ملفها التفصيلي.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Form Client */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div onClick={() => setIsFormOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col z-10 animate-slide-in">
            <div className={`p-6 border-b border-gray-200/80 flex justify-between items-center bg-slate-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingCliente 
                    ? (language === 'fr' ? 'Modifier la fiche cliente' : 'تعديل معلومات الزبونة') 
                    : (language === 'fr' ? 'Créer une fiche cliente' : 'إضافة زبونة جديدة')}
                </h3>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">{t.client_name} *</label>
                <input
                  id="form-client-name"
                  type="text"
                  required
                  value={nomComplet}
                  onChange={(e) => setNomComplet(e.target.value)}
                  placeholder="Ex: Meriem Belkacem"
                  className={`w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">{t.phone} *</label>
                <input
                  id="form-client-phone"
                  type="text"
                  required
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="Ex: 0550 12 34 56"
                  className="w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 text-left font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">{t.address}</label>
                <input
                  id="form-client-address"
                  type="text"
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  placeholder="Ex: Hydra, Alger"
                  className={`w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">{t.notes}</label>
                <textarea
                  id="form-client-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mesures, préférences de style, remarques importantes..."
                  className={`w-full p-3 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                />
              </div>

              <div className="pt-6 border-t border-gray-50 flex gap-3">
                <button
                  type="button"
                  id="cancel-client-btn"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-50 hover:bg-slate-100 text-gray-700 text-sm font-semibold rounded-xl cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  id="submit-client-btn"
                  className="flex-1 py-3 px-4 bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white text-sm font-bold rounded-xl cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
