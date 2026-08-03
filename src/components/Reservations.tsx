import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  CheckCircle, 
  User, 
  Layers, 
  Gem, 
  DollarSign, 
  Info, 
  X, 
  ChevronRight, 
  AlertTriangle,
  Receipt
} from 'lucide-react';
import { Reservation, Cliente, Dress, Bijou, Language, ReservationItem, Transaction } from '../types';
import { translations } from '../translations';
import { addHistoryEntry, checkItemAvailability, saveTransactions, getTransactions, getSupabaseClient, mapReservationToDb, mapTransactionToDb, isUuid } from '../lib/storage';
import { todayIso, isoInDays, nowTime } from '../lib/dates';
import { notifyError, notifySuccess } from '../lib/toast';

interface ReservationsProps {
  reservations: Reservation[];
  onSaveReservations: (reservations: Reservation[]) => void;
  clientes: Cliente[];
  onSaveClientes: (clientes: Cliente[]) => void;
  dresses: Dress[];
  bijoux: Bijou[];
  language: Language;
  onAddTransaction: (transaction: any) => void;
  setCurrentTab: (tab: string) => void;
  setInvoiceReservationId: (id: string | null) => void;
  initialOpenForm?: boolean;
  onFormOpenHandled?: () => void;
  onRefreshData?: () => void;
}

export default function Reservations({ 
  reservations, 
  onSaveReservations, 
  clientes,
  onSaveClientes,
  dresses,
  bijoux,
  language,
  onAddTransaction,
  setCurrentTab,
  setInvoiceReservationId,
  initialOpenForm,
  onFormOpenHandled,
  onRefreshData
}: ReservationsProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const todayStr = todayIso();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(initialOpenForm || false);

  React.useEffect(() => {
    if (initialOpenForm) {
      setIsWizardOpen(true);
      onFormOpenHandled?.();
    }
  }, [initialOpenForm, onFormOpenHandled]);
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientPhoneInput, setClientPhoneInput] = useState('');
  const [dateSortie, setDateSortie] = useState(todayStr);
  const [dateRetour, setDateRetour] = useState(isoInDays(3));
  const [selectedDresses, setSelectedDresses] = useState<Dress[]>([]);
  const [selectedBijoux, setSelectedBijoux] = useState<Bijou[]>([]);
  const [montantPaye, setMontantPaye] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Step helper
  const [wizardStep, setWizardStep] = useState<number>(1); // 1: dates & client, 2: dresses, 3: accessories, 4: payment & summary

  // Search in dress and jewelry selection
  const [itemSearch, setItemSearch] = useState('');

  // Helpers
  const getClientName = (id: string) => {
    return clientes.find(c => c.id === id || c.nom_complet.toLowerCase() === id.toLowerCase())?.nom_complet || id || 'Inconnue';
  };

  const getClientPhone = (id: string) => {
    return clientes.find(c => c.id === id || c.nom_complet.toLowerCase() === id.toLowerCase())?.telephone || '';
  };

  const findClientByName = (name: string) =>
    clientes.find(c => c.nom_complet.trim().toLowerCase() === name.trim().toLowerCase());

  // The client already on file for the name currently typed, if any.
  const knownClient = clientNameInput.trim() ? findClientByName(clientNameInput) : undefined;

  // Typing (or picking) a known client pulls her number in, so the operator
  // never has to retype it; an unknown name leaves whatever was entered.
  const handleClientNameChange = (name: string) => {
    setClientNameInput(name);
    const match = findClientByName(name);
    if (match?.telephone) setClientPhoneInput(match.telephone);
  };

  const formatDa = (amount: number) => {
    return new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(amount) + ' DA';
  };

  // Calculations for Wizard
  const totalDressesPrice = selectedDresses.reduce((sum, d) => sum + d.prix_location_da, 0);
  const totalBijouxPrice = selectedBijoux.reduce((sum, b) => sum + b.prix_location_da, 0);
  const totalCost = totalDressesPrice + totalBijouxPrice;

  const totalCaution = selectedDresses.reduce((sum, d) => sum + d.caution_da, 0);
  const remainingCost = Math.max(0, totalCost - montantPaye);

  // Delete booking
  const handleDeleteBooking = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = reservations.find(r => r.id === id);
    if (!res) return;

    const msg = language === 'fr' 
      ? `Êtes-vous sûr d'annuler et de supprimer définitivement la réservation #${id.toUpperCase()} ?`
      : `هل أنت متأكد من إلغاء وحذف الحجز رقم #${id.toUpperCase()} نهائياً؟`;

    if (window.confirm(msg)) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from('reservations').delete().eq('id', id);
        if (error) {
          notifyError("Erreur Supabase : " + error.message);
          console.error('Supabase delete reservation error:', error);
        }
      }

      const updated = reservations.filter(r => r.id !== id);
      onSaveReservations(updated);
      onRefreshData?.();

      addHistoryEntry(
        language === 'fr' ? 'Annulation de réservation' : 'إلغاء حجز',
        `La réservation #${id.toUpperCase()} de la cliente ${getClientName(res.cliente_id)} a été annulée.`
      );
    }
  };

  // Pay reservation balance
  const handlePayBalance = async (res: Reservation) => {
    const amountToPay = res.reste_a_payer_da;
    if (amountToPay <= 0) return;

    const msg = language === 'fr'
      ? `Confirmez-vous l'encaissement du solde de ${formatDa(amountToPay)} pour la réservation #${res.id.toUpperCase()} ?`
      : `هل تؤكد تحصيل المبلغ المتبقي وقدره ${formatDa(amountToPay)} للحجز رقم #${res.id.toUpperCase()}؟`;

    if (window.confirm(msg)) {
      const updatedResObj: Reservation = {
        ...res,
        montant_paye_da: res.montant_total_da,
        reste_a_payer_da: 0
      };

      const supabase = getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from('reservations').update(mapReservationToDb(updatedResObj)).eq('id', res.id);
        if (error) {
          notifyError("Erreur Supabase : " + error.message);
          console.error('Supabase update reservation balance error:', error);
        }
      }

      const updated = reservations.map(r => r.id === res.id ? updatedResObj : r);
      onSaveReservations(updated);

      // Log transaction in Caisse
      const newTr: Transaction = {
        id: `t-${Date.now()}`,
        type: 'entree',
        montant_da: amountToPay,
        description: `Paiement Solde Réservation ${res.id.toUpperCase()} - ${getClientName(res.cliente_id)}`,
        categorie: 'Réservation',
        date: todayStr,
        heure: new Date().toTimeString().split(' ')[0].substring(0, 5),
        utilisateur: 'Zeyna',
        note: `Solde payé manuellement depuis la fiche de réservation`
      };

      if (supabase) {
        const { error: trError } = await supabase.from('mouvements_caisse').insert([mapTransactionToDb(newTr)]);
        if (trError) {
          notifyError(`Erreur Supabase (Ajout mouvement caisse): ${trError.message}`);
          console.error('Supabase insert transaction error:', trError);
        }
      }

      onAddTransaction(newTr);
      onRefreshData?.();

      // Log to history
      addHistoryEntry(
        language === 'fr' ? 'Paiement solde' : 'دفع باقي الحجز',
        `Solde de ${formatDa(amountToPay)} encaissé pour la réservation #${res.id.toUpperCase()} (Cliente: ${getClientName(res.cliente_id)}).`
      );
    }
  };

  // Open creation wizard
  const openNewWizard = () => {
    setClientNameInput('');
    setClientPhoneInput('');
    setDateSortie(todayStr);
    setDateRetour(isoInDays(3));
    setSelectedDresses([]);
    setSelectedBijoux([]);
    setMontantPaye(0);
    setNotes('');
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  // Handle addition/removal of items in wizard
  const toggleDressSelect = (dress: Dress) => {
    const isSelected = selectedDresses.some(d => d.id === dress.id);
    if (isSelected) {
      setSelectedDresses(selectedDresses.filter(d => d.id !== dress.id));
    } else {
      // Check overlap before selecting
      const avail = checkItemAvailability('robe', dress.id, dateSortie, dateRetour);
      if (!avail.available) {
        const conflictClient = getClientName(avail.conflictingReservation!.cliente_id);
        const warningMsg = language === 'fr'
          ? `La robe "${dress.nom}" est déjà réservée par ${conflictClient} du ${avail.conflictingReservation!.date_sortie} au ${avail.conflictingReservation!.date_retour}.`
          : `الفستان "${dress.nom}" محجوز بالفعل للزبونة ${conflictClient} من ${avail.conflictingReservation!.date_sortie} إلى ${avail.conflictingReservation!.date_retour}.`;
        notifyError(warningMsg);
        return;
      }
      setSelectedDresses([...selectedDresses, dress]);
    }
  };

  const toggleBijouSelect = (bijou: Bijou) => {
    const isSelected = selectedBijoux.some(b => b.id === bijou.id);
    if (isSelected) {
      setSelectedBijoux(selectedBijoux.filter(b => b.id !== bijou.id));
    } else {
      // Check overlap before selecting
      const avail = checkItemAvailability('bijou', bijou.id, dateSortie, dateRetour);
      if (!avail.available) {
        const conflictClient = getClientName(avail.conflictingReservation!.cliente_id);
        const warningMsg = language === 'fr'
          ? `L'accessoire "${bijou.nom}" est déjà réservé par ${conflictClient} du ${avail.conflictingReservation!.date_sortie} au ${avail.conflictingReservation!.date_retour}.`
          : `الإكسسوار "${bijou.nom}" محجوز بالفعل للزبونة ${conflictClient} من ${avail.conflictingReservation!.date_sortie} إلى ${avail.conflictingReservation!.date_retour}.`;
        notifyError(warningMsg);
        return;
      }
      setSelectedBijoux([...selectedBijoux, bijou]);
    }
  };

  // Save Booking Wizard
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDresses.length === 0 && selectedBijoux.length === 0) {
      notifyError(language === 'fr' ? 'Sélectionnez au moins une robe ou un bijou.' : 'يرجى اختيار فستان واحد أو حلي واحد على الأقل.');
      return;
    }

    const clientName = clientNameInput.trim();
    if (!clientName) {
      notifyError(language === 'fr' ? 'Veuillez renseigner le nom de la cliente.' : 'يرجى كتابة اسم الزبونة.');
      return;
    }

    const clientPhone = clientPhoneInput.trim();

    // Keep the local client file in step with what was typed: record a new
    // client, or fill in / correct the number of one already on file.
    const localMatch = findClientByName(clientName);
    const localClientId = localMatch?.id ?? `cl-${Date.now()}`;
    if (!localMatch) {
      onSaveClientes([
        ...clientes,
        {
          id: localClientId,
          nom_complet: clientName,
          telephone: clientPhone,
          date_creation: todayStr
        }
      ]);
    } else if (clientPhone && clientPhone !== localMatch.telephone) {
      onSaveClientes(
        clientes.map(c => (c.id === localMatch.id ? { ...c, telephone: clientPhone } : c))
      );
    }

    // ── Record locally first ────────────────────────────────────────────
    // The shop must be able to take a booking with the network down, so the
    // reservation is committed on the device before the cloud is contacted.
    const localResId = `r-${Date.now()}`;
    const localItems: ReservationItem[] = [
      ...selectedDresses.map(d => ({
        id: `it-${d.id}`,
        reservation_id: localResId,
        type_article: 'robe' as const,
        article_id: d.id,
        prix_da: d.prix_location_da,
        nom_article: d.nom
      })),
      ...selectedBijoux.map(b => ({
        id: `it-${b.id}`,
        reservation_id: localResId,
        type_article: 'bijou' as const,
        article_id: b.id,
        prix_da: b.prix_location_da,
        nom_article: b.nom
      }))
    ];

    const localReservation: Reservation = {
      id: localResId,
      cliente_id: localClientId,
      date_sortie: dateSortie,
      date_retour: dateRetour,
      montant_total_da: totalCost,
      caution_da: totalCaution,
      montant_paye_da: montantPaye,
      reste_a_payer_da: remainingCost,
      statut: dateSortie > todayStr ? 'future' : 'en_cours',
      notes,
      date_creation: todayStr,
      items: localItems
    };
    onSaveReservations([localReservation, ...reservations]);

    if (montantPaye > 0) {
      onAddTransaction({
        id: `t-${Date.now()}`,
        type: 'entree',
        montant_da: montantPaye,
        description: `Acompte Réservation - ${clientName}`,
        categorie: 'Réservation',
        date: todayStr,
        heure: nowTime(),
        utilisateur: 'Zeyna',
        source_argent: 'caisse'
      } as Transaction);
    }

    addHistoryEntry(
      language === 'fr' ? 'Nouvelle réservation' : 'حجز جديد',
      `Réservation créée pour ${clientName}. Total: ${formatDa(totalCost)}.`
    );

    setIsWizardOpen(false);

    // ── Then mirror it to the cloud, best effort ────────────────────────
    const supabase = getSupabaseClient();
    if (!supabase) {
      notifySuccess(language === 'fr'
        ? 'Réservation enregistrée sur cet appareil (cloud non configuré).'
        : 'تم حفظ الحجز على هذا الجهاز (السحابة غير مهيأة).');
      return;
    }

    try {

    const existingClient = clientes.find(c => c.nom_complet.trim().toLowerCase() === clientName.toLowerCase() || c.id === clientName);
    let validUuidClientId = existingClient && isUuid(existingClient.id) ? existingClient.id : null;

    // Automatically register client if not already in clients table or if ID is not a valid UUID
    if (!validUuidClientId && clientName) {
      const parts = clientName.trim().split(' ');
      const prenom = parts[0] || '';
      const nom = parts.length > 1 ? parts.slice(1).join(' ') : prenom;

      // Check if client already exists in Supabase
      const { data: foundClients } = await supabase
        .from('clients')
        .select('id')
        .or(`nom.ilike.${nom},prenom.ilike.${prenom}`)
        .limit(1);

      if (foundClients && foundClients[0] && isUuid(foundClients[0].id)) {
        validUuidClientId = foundClients[0].id;
      } else {
        const { data: newClientData, error: clientErr } = await supabase.from('clients').insert([{
          nom,
          prenom,
          telephone: clientPhone || existingClient?.telephone || '',
          adresse: existingClient?.adresse || ''
        }]).select();

        if (clientErr) throw new Error(clientErr.message);

        if (newClientData && newClientData[0] && isUuid(newClientData[0].id)) {
          validUuidClientId = newClientData[0].id;
        }
      }
    } else if (clientPhone && clientPhone !== existingClient?.telephone) {
      // Client already on file: keep her number up to date with what was typed.
      const { error: phoneErr } = await supabase
        .from('clients')
        .update({ telephone: clientPhone })
        .eq('id', validUuidClientId);
      if (phoneErr) console.warn('Could not update client phone:', phoneErr);
    }

    const robeItem = selectedDresses[0];
    const validRobeId = robeItem && isUuid(robeItem.id) ? robeItem.id : null;

    const bijouItem = selectedBijoux[0];
    const validBijouId = bijouItem && isUuid(bijouItem.id) ? bijouItem.id : null;

    const resRowToInsert: any = {
      client_id: validUuidClientId,
      robe_id: validRobeId,
      bijou_id: validBijouId,
      date_debut: dateSortie || null,
      date_fin: dateRetour || null,
      statut_reservation: 'future',
      prix_total: Number(totalCost) || 0,
      acompte: Number(montantPaye) || 0,
      reste_a_payer: Number(remainingCost) || 0
    };

    let { error: resError } = await supabase.from('reservations').insert([resRowToInsert]).select();

    // If statut_reservation column is named 'statut' in table, fallback retry
    if (resError) {
      const fallbackRow: any = {
        client_id: validUuidClientId,
        robe_id: validRobeId,
        bijou_id: validBijouId,
        date_debut: dateSortie || null,
        date_fin: dateRetour || null,
        statut: 'future',
        prix_total: Number(totalCost) || 0,
        acompte: Number(montantPaye) || 0,
        reste_a_payer: Number(remainingCost) || 0
      };
      const retry = await supabase.from('reservations').insert([fallbackRow]).select();
      if (!retry.error) {
        resError = null;
      }
    }

      if (resError) throw new Error(resError.message);

      if (montantPaye > 0) {
        const trRowToInsert = {
          type: 'entree',
          montant: montantPaye,
          source: 'caisse',
          beneficiaire: null,
          motif: `Acompte Réservation - ${clientName}`
        };

        const { error: trError } = await supabase.from('mouvements_caisse').insert([trRowToInsert]);
        if (trError) throw new Error(trError.message);
      }

      notifySuccess(language === 'fr'
        ? 'Réservation enregistrée et synchronisée.'
        : 'تم حفظ الحجز ومزامنته.');

      // Only pull the cloud copy back once it holds this booking, otherwise the
      // refresh would overwrite the local record we just committed.
      await onRefreshData?.();
    } catch (err) {
      console.error('Could not sync reservation to Supabase:', err);
      notifyError(language === 'fr'
        ? "Réservation enregistrée sur cet appareil, mais la synchronisation avec le cloud a échoué. Elle sera visible ici en attendant."
        : 'تم حفظ الحجز على هذا الجهاز، لكن فشلت المزامنة مع السحابة.');
    }
  };

  // Filter reservations
  const filteredReservations = reservations.filter(res => {
    const clientName = getClientName(res.cliente_id).toLowerCase();
    const clientPhone = getClientPhone(res.cliente_id);
    const matchesSearch = clientName.includes(searchTerm.toLowerCase()) || clientPhone.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || res.statut === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className={`space-y-8 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
        isRtl ? 'sm:flex-row-reverse' : ''
      }`}>
        <div>
          <h2 className="font-display text-[2rem] leading-tight text-neutral-900">
            {language === 'fr' ? 'Gestion des Réservations & Locations' : 'إدارة الحجوزات والتأجير'}
          </h2>
          <p className="mt-1 text-[15px] text-neutral-500">
            {language === 'fr' 
              ? `Planifiez les sorties de robes, suivez les acomptes et évitez les conflits de calendrier.`
              : `خططي لخرجات الفساتين، تابعي الدفعات المسبقة وتجنبي تداخل المواعيد.`}
          </p>
        </div>
        <button
          id="open-wizard-btn"
          onClick={openNewWizard}
          className="flex items-center gap-2 bg-orange-600 text-white font-bold px-5 py-3 rounded-2xl cursor-pointer transition-all text-sm"
        >
          <Plus size={16} />
          <span>{language === 'fr' ? 'Nouvelle réservation' : 'حجز جديد'}</span>
        </button>
      </div>

      {/* Toolbar filters */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-4">
        <div className={`flex flex-col md:flex-row gap-4 ${isRtl ? 'md:flex-row-reverse' : ''}`}>
          {/* Search */}
          <div className="relative flex-1">
            <span className={`absolute inset-y-0 flex items-center text-gray-400 pointer-events-none ${isRtl ? 'left-3' : 'left-3'}`}>
              <Search size={18} />
            </span>
            <input
              id="res-search-input"
              type="text"
              placeholder={language === 'fr' ? 'Rechercher cliente...' : 'بحث عن زبونة...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full py-2.5 pr-3 pl-10 bg-slate-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-violet-500 focus:bg-white transition-all ${
                isRtl ? 'text-right' : 'text-left'
              }`}
            />
          </div>

          {/* Status buttons */}
          <div className="flex gap-2 items-center flex-wrap">
            <button
              id="res-filter-all"
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                statusFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-slate-50 text-gray-600 hover:bg-slate-100'
              }`}
            >
              {t.all}
            </button>
            <button
              id="res-filter-fut"
              onClick={() => setStatusFilter('future')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                statusFilter === 'future' ? 'bg-amber-500 text-white' : 'bg-slate-50 text-amber-600 hover:bg-amber-50'
              }`}
            >
              {t.statut_future}
            </button>
            <button
              id="res-filter-loc"
              onClick={() => setStatusFilter('en_cours')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                statusFilter === 'en_cours' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-blue-600 hover:bg-blue-50'
              }`}
            >
              {t.statut_en_cours}
            </button>
            <button
              id="res-filter-ret"
              onClick={() => setStatusFilter('retourne')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                statusFilter === 'retourne' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {t.statut_retourne}
            </button>
            <button
              id="res-filter-lat"
              onClick={() => setStatusFilter('en_retard')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                statusFilter === 'en_retard' ? 'bg-red-600 text-white' : 'bg-slate-50 text-red-600 hover:bg-red-50'
              }`}
            >
              {t.statut_en_retard}
            </button>
          </div>
        </div>
      </div>

      {/* Booking cards list */}
      {filteredReservations.length === 0 ? (
        <div className="bg-white py-16 px-4 rounded-2xl border border-neutral-200 text-center">
          <Calendar size={36} className="text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800">{language === 'fr' ? 'Aucune réservation trouvée' : 'لا توجد حجوزات'}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {language === 'fr' ? 'Créez une nouvelle location pour remplir la liste.' : 'ابدئي بتسجيل أول حجز لملء هذه القائمة.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredReservations.map(res => {
            // Style maps
            let statusClass = 'bg-slate-50 text-slate-700 border-slate-100';
            if (res.statut === 'future') statusClass = 'bg-amber-50 text-amber-700 border-amber-100';
            else if (res.statut === 'en_cours') statusClass = 'bg-blue-50 text-blue-700 border-blue-100';
            else if (res.statut === 'en_retard') statusClass = 'bg-red-50 text-red-700 border-red-100';
            else if (res.statut === 'retourne') statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';

            const remainingClass = res.reste_a_payer_da > 0 ? 'text-red-600 font-bold bg-red-50' : 'text-emerald-700 bg-emerald-50';

            return (
              <div
                key={res.id}
                className="bg-white p-6 rounded-2xl border border-neutral-200 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className={`flex justify-between items-center mb-4 pb-4 border-b border-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-black text-violet-600 font-mono">#{res.id.toUpperCase()}</span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${statusClass}`}>
                        {res.statut === 'future' ? t.statut_future : res.statut === 'en_cours' ? t.statut_en_cours : res.statut === 'en_retard' ? t.statut_en_retard : t.statut_retourne}
                      </span>
                    </div>

                    <div className="flex gap-1">
                      {/* Print button */}
                      <button
                        id={`print-invoice-btn-${res.id}`}
                        onClick={() => {
                          setInvoiceReservationId(res.id);
                          setCurrentTab('documents');
                        }}
                        title="Créer Reçu"
                        className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg border border-violet-100 cursor-pointer"
                      >
                        <Receipt size={14} />
                      </button>
                      
                      <button
                        id={`delete-res-btn-${res.id}`}
                        onClick={(e) => handleDeleteBooking(res.id, e)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-neutral-200 hover:border-red-200/80 rounded-lg cursor-pointer transition-all duration-200"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className={`flex items-center gap-3.5 mb-5 ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                      <User size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{getClientName(res.cliente_id)}</h4>
                      <p className="text-xs text-gray-400 font-mono">📞 {getClientPhone(res.cliente_id)}</p>
                    </div>
                  </div>

                  {/* Dates sorting */}
                  <div className={`grid grid-cols-2 gap-4 p-3 bg-slate-50/50 rounded-2xl text-xs border border-slate-100 mb-5 ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">{t.start_date}</span>
                      <span className="font-semibold text-gray-800 font-mono">📅 {res.date_sortie}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">{t.end_date}</span>
                      <span className="font-semibold text-gray-800 font-mono">📅 {res.date_retour}</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-1.5 mb-5">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{language === 'fr' ? 'Détail Articles' : 'تفاصيل المواد'} :</span>
                    <div className="space-y-1">
                      {res.items.map(item => (
                        <div key={item.id} className={`flex justify-between text-xs py-1 px-2.5 bg-slate-50 border border-slate-50 rounded-lg ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <span className="font-medium text-gray-700 flex items-center gap-1.5">
                            {item.type_article === 'robe' ? <Layers size={10} className="text-purple-500" /> : <Gem size={10} className="text-blue-500" />}
                            {item.nom_article}
                          </span>
                          <span className="font-bold text-gray-900 font-mono">{formatDa(item.prix_da)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pricing summary */}
                <div className="pt-4 border-t border-dashed border-neutral-200">
                  <div className={`grid grid-cols-3 gap-2 text-center text-xs ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className="p-2">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block mb-0.5">{t.total_price}</span>
                      <span className="font-extrabold text-violet-600 font-mono">{formatDa(res.montant_total_da)}</span>
                    </div>
                    <div className="p-2 border-x border-neutral-200">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block mb-0.5">{t.amount_paid}</span>
                      <span className="font-bold text-emerald-600 font-mono">{formatDa(res.montant_paye_da)}</span>
                    </div>
                    <div className="p-2">
                      <span className="text-[9px] text-gray-400 font-bold uppercase block mb-0.5">{language === 'fr' ? 'Reste à payer' : 'الباقي'}</span>
                      <span className={`font-bold font-mono px-1.5 py-0.5 rounded ${remainingClass}`}>
                        {formatDa(res.reste_a_payer_da)}
                      </span>
                    </div>
                  </div>

                  {res.notes && (
                    <div className={`mt-3 p-3 bg-amber-50/30 rounded-xl text-[11px] text-amber-800 ${isRtl ? 'text-right' : 'text-left'}`}>
                      💬 <strong>{language === 'fr' ? 'Notes:' : 'ملاحظات:'}</strong> {res.notes}
                    </div>
                  )}

                  {res.reste_a_payer_da > 0 && (
                    <button
                      id={`pay-balance-btn-${res.id}`}
                      onClick={() => handlePayBalance(res)}
                      className="mt-4 w-full py-2.5 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer"
                    >
                      <DollarSign size={13} />
                      <span>
                        {language === 'fr' 
                          ? `Encaisser le solde de ${formatDa(res.reste_a_payer_da)}` 
                          : `تحصيل الباقي ${formatDa(res.reste_a_payer_da)}`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Creation Wizard Dialog */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div onClick={() => setIsWizardOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

          {/* Dialog Panel */}
          <div className="relative w-full max-w-xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col z-10 animate-scale-up max-h-[90vh]">
            
            {/* Header */}
            <div className={`p-6 border-b border-neutral-200 flex justify-between items-center bg-slate-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {language === 'fr' ? 'Assistant de Réservation' : 'مساعد تسجيل الحجوزات'}
                </h3>
                {/* Step indicator */}
                <div className={`flex gap-1.5 mt-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {[1, 2, 3, 4].map(stepNum => (
                    <span 
                      key={stepNum} 
                      className={`h-1 rounded-full transition-all duration-300 ${
                        wizardStep === stepNum 
                          ? 'w-8 bg-violet-600' 
                          : wizardStep > stepNum 
                            ? 'w-4 bg-emerald-500' 
                            : 'w-4 bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button onClick={() => setIsWizardOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                <X size={18} />
              </button>
            </div>

            {/* Wizard Body content depending on step */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* STEP 1: Dates & Client selection */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700 block">{t.select_client} *</label>
                      <input
                        id="wizard-client-name-input"
                        type="text"
                        required
                        list="wizard-client-suggestions"
                        autoComplete="off"
                        placeholder={language === 'fr' ? 'Prénom et Nom de la cliente' : 'اسم ولقب الزبونة'}
                        value={clientNameInput}
                        onChange={(e) => handleClientNameChange(e.target.value)}
                        className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white ${
                          isRtl ? 'text-right' : 'text-left'
                        }`}
                      />
                      {/* Picking a known client fills in her number automatically */}
                      <datalist id="wizard-client-suggestions">
                        {clientes.map(c => (
                          <option key={c.id} value={c.nom_complet}>{c.telephone}</option>
                        ))}
                      </datalist>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700 block">
                        {language === 'fr' ? 'Téléphone' : 'رقم الهاتف'}
                      </label>
                      <input
                        id="wizard-client-phone-input"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="05 55 12 34 56"
                        value={clientPhoneInput}
                        onChange={(e) => setClientPhoneInput(e.target.value)}
                        className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white text-left"
                        dir="ltr"
                      />
                      {knownClient && (
                        <p className="text-[11px] text-emerald-700 font-semibold">
                          {language === 'fr' ? 'Cliente déjà enregistrée' : 'زبونة مسجلة مسبقاً'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700 block">{t.start_date} *</label>
                      <input
                        id="wizard-start-date"
                        type="date"
                        required
                        value={dateSortie}
                        onChange={(e) => setDateSortie(e.target.value)}
                        className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none font-mono text-left"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700 block">{t.end_date} *</label>
                      <input
                        id="wizard-end-date"
                        type="date"
                        required
                        value={dateRetour}
                        onChange={(e) => setDateRetour(e.target.value)}
                        className="w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none font-mono text-left"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-violet-50 border border-violet-100 rounded-2xl flex gap-3 text-xs text-violet-900 leading-relaxed">
                    <Info size={16} className="text-violet-600 shrink-0 mt-0.5" />
                    <p>
                      {language === 'fr' 
                        ? 'Sélectionnez d’abord la cliente et la période de location. Les étapes suivantes n’afficheront que les articles disponibles pendant ces dates précises.'
                        : 'حددي أولاً الزبونة وتواريخ كراء الفستان، الخطوات التالية ستعرض فقط الملابس والحلي المتوفرة خلال تلك التواريخ تجنباً لأي تداخل.'}
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 2: Dresses selection */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className={`flex justify-between items-baseline ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <h4 className="text-sm font-bold text-gray-900">{language === 'fr' ? 'Sélectionner les Robes' : 'اختر الفساتين'}</h4>
                    <span className="text-xs text-violet-600 font-bold">{selectedDresses.length} {language === 'fr' ? 'sélectionnée(s)' : 'محددة'}</span>
                  </div>

                  {/* Mini search inside dresses */}
                  <input
                    id="wizard-dress-search"
                    type="text"
                    placeholder={language === 'fr' ? 'Filtrer par nom, couleur, taille...' : 'البحث عن فستان...'}
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-neutral-200 rounded-xl text-xs focus:outline-none"
                  />

                  {/* List dresses */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {dresses
                      .filter(d => d.nom.toLowerCase().includes(itemSearch.toLowerCase()) || d.couleur.toLowerCase().includes(itemSearch.toLowerCase()))
                      .map(dress => {
                        const isSelected = selectedDresses.some(d => d.id === dress.id);
                        
                        // Check if item is available during these dates (if NOT currently selected)
                        const isAvail = isSelected ? { available: true } : checkItemAvailability('robe', dress.id, dateSortie, dateRetour);
                        const disabled = !isAvail.available;

                        return (
                          <div
                            key={dress.id}
                            id={`wizard-dress-item-${dress.id}`}
                            onClick={() => !disabled && toggleDressSelect(dress)}
                            className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                              isSelected 
                                ? 'bg-violet-600 text-white border-violet-600' 
                                : disabled 
                                  ? 'bg-slate-50 text-gray-300 border-neutral-200 opacity-60 cursor-not-allowed' 
                                  : 'bg-slate-50/40 border-neutral-200 hover:bg-slate-50 cursor-pointer text-gray-800'
                            }`}
                          >
                            <div className={`flex gap-3 items-center ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                              <img src={dress.photo_principale} alt={dress.nom} className="w-11 h-11 object-cover rounded-xl border" />
                              <div>
                                <h5 className="text-xs font-bold">{dress.nom}</h5>
                                <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-violet-100' : 'text-gray-400'}`}>
                                  {t.size}: {dress.taille} | {t.color}: {dress.couleur}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-bold block font-mono">{formatDa(dress.prix_location_da)}</span>
                              {!isAvail.available && (
                                <span className="text-[8px] bg-red-100 text-red-600 font-extrabold px-1 py-0.5 rounded">
                                  {language === 'fr' ? 'OCUUPÉ' : 'محجوز'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* STEP 3: Accessories selection */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className={`flex justify-between items-baseline ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <h4 className="text-sm font-bold text-gray-900">{language === 'fr' ? 'Sélectionner les Bijoux' : 'اختر الحلي'}</h4>
                    <span className="text-xs text-violet-600 font-bold">{selectedBijoux.length} {language === 'fr' ? 'sélectionné(s)' : 'محددة'}</span>
                  </div>

                  <input
                    id="wizard-bijou-search"
                    type="text"
                    placeholder={language === 'fr' ? 'Filtrer par nom...' : 'البحث عن حلي...'}
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-neutral-200 rounded-xl text-xs"
                  />

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {bijoux
                      .filter(b => b.nom.toLowerCase().includes(itemSearch.toLowerCase()))
                      .map(bijou => {
                        const isSelected = selectedBijoux.some(b => b.id === bijou.id);
                        const isAvail = isSelected ? { available: true } : checkItemAvailability('bijou', bijou.id, dateSortie, dateRetour);
                        const disabled = !isAvail.available;

                        return (
                          <div
                            key={bijou.id}
                            id={`wizard-bijou-item-${bijou.id}`}
                            onClick={() => !disabled && toggleBijouSelect(bijou)}
                            className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                              isSelected 
                                ? 'bg-violet-600 text-white border-violet-600' 
                                : disabled 
                                  ? 'bg-slate-50 text-gray-300 border-neutral-200 opacity-60 cursor-not-allowed' 
                                  : 'bg-slate-50/40 border-neutral-200 hover:bg-slate-50 cursor-pointer text-gray-800'
                            }`}
                          >
                            <div className={`flex gap-3 items-center ${isRtl ? 'flex-row-reverse text-right' : 'text-left'}`}>
                              <img src={bijou.photo} alt={bijou.nom} className="w-11 h-11 object-cover rounded-xl border" />
                              <div>
                                <h5 className="text-xs font-bold">{bijou.nom}</h5>
                                <p className={`text-[10px] ${isSelected ? 'text-violet-100' : 'text-gray-400'}`}>
                                  {bijou.categorie}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-bold block font-mono">{formatDa(bijou.prix_location_da)}</span>
                              {!isAvail.available && (
                                <span className="text-[8px] bg-red-100 text-red-600 font-extrabold px-1 py-0.5 rounded">
                                  {language === 'fr' ? 'OCUUPÉ' : 'محجوز'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* STEP 4: Payment & summary review */}
              {wizardStep === 4 && (
                <div className="space-y-5">
                  <h4 className="text-sm font-bold text-gray-900 border-b border-neutral-200 pb-2">
                    {language === 'fr' ? 'Récapitulatif & Paiement' : 'الخلاصة والدفع'}
                  </h4>

                  {/* Summary grid */}
                  <div className={`grid grid-cols-2 gap-4 text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                    <div>
                      <p className="text-gray-400 font-bold uppercase">{language === 'fr' ? 'Cliente' : 'الزبونة'}</p>
                      <p className="font-extrabold text-gray-900 mt-0.5">{clientNameInput || 'Inconnue'}</p>
                      {clientPhoneInput.trim() && (
                        <p className="text-gray-500 mt-0.5" dir="ltr">📞 {clientPhoneInput.trim()}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-400 font-bold uppercase">{language === 'fr' ? 'Dates de location' : 'فترة الكراء'}</p>
                      <p className="font-extrabold text-gray-900 mt-0.5 font-mono">{dateSortie} ➔ {dateRetour}</p>
                    </div>
                  </div>

                  {/* Items count */}
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs text-gray-700">
                    <p className="font-bold text-gray-400 uppercase tracking-wide text-[9px]">
                      {language === 'fr' ? 'Articles sélectionnées' : 'المواد المختارة'}
                    </p>
                    {selectedDresses.map(d => (
                      <p key={d.id} className="flex justify-between font-medium">
                        <span>👗 {d.nom}</span>
                        <span className="font-bold font-mono">{formatDa(d.prix_location_da)}</span>
                      </p>
                    ))}
                    {selectedBijoux.map(b => (
                      <p key={b.id} className="flex justify-between font-medium">
                        <span>💍 {b.nom}</span>
                        <span className="font-bold font-mono">{formatDa(b.prix_location_da)}</span>
                      </p>
                    ))}
                    <div className="pt-2 border-t border-dashed border-gray-200 flex justify-between font-black text-gray-900">
                      <span>{t.total_price}</span>
                      <span className="font-mono text-violet-600">{formatDa(totalCost)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-600 text-[11px]">
                      <span>🛡️ {t.caution} cumulative</span>
                      <span className="font-mono">{formatDa(totalCaution)}</span>
                    </div>
                  </div>

                  {/* Payment Input */}
                  <div className="space-y-1.5 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                    <label className="text-xs font-bold text-emerald-800 block flex justify-between">
                      <span>{language === 'fr' ? 'Acompte versé aujourd’hui (DA)' : 'العربون المدفوع اليوم (دج)'} *</span>
                      <span className="font-bold text-emerald-600">{formatDa(montantPaye)}</span>
                    </label>
                    <input
                      id="wizard-amount-paid"
                      type="number"
                      required
                      min="0"
                      max={totalCost}
                      value={montantPaye}
                      onChange={(e) => setMontantPaye(Number(e.target.value))}
                      className="w-full p-3 border border-emerald-200 bg-white rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                    <div className="flex justify-between text-[11px] font-bold text-emerald-800 pt-1">
                      <span>{language === 'fr' ? 'Reste à payer' : 'الباقي مستحق'} :</span>
                      <span className="font-mono">{formatDa(remainingCost)}</span>
                    </div>
                  </div>

                  {/* Custom Booking Notes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 block">{t.notes}</label>
                    <input
                      id="wizard-res-notes"
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Demande pressing, modification d’ourlet..."
                      className={`w-full p-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 ${
                        isRtl ? 'text-right' : 'text-left'
                      }`}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Wizard Navigation Footer */}
            <div className="p-6 border-t border-neutral-200 flex justify-between bg-slate-50 gap-3">
              
              {/* Back button */}
              <button
                type="button"
                id="wizard-back-btn"
                disabled={wizardStep === 1}
                onClick={() => {
                  setItemSearch('');
                  setWizardStep(wizardStep - 1);
                }}
                className="py-3 px-5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {language === 'fr' ? 'Précédent' : 'السابق'}
              </button>

              {/* Next/Save button */}
              {wizardStep < 4 ? (
                <button
                  type="button"
                  id="wizard-next-btn"
                  onClick={() => {
                    if (wizardStep === 1) {
                      if (!clientNameInput.trim() || !dateSortie || !dateRetour) {
                        notifyError(language === 'fr' ? 'Veuillez renseigner le nom de la cliente et toutes les dates.' : 'يرجى كتابة اسم الزبونة وتحديد التواريخ.');
                        return;
                      }
                      if (dateSortie > dateRetour) {
                        notifyError(language === 'fr' ? 'La date de retour doit être après la date de sortie !' : 'تاريخ الإرجاع يجب أن يكون بعد تاريخ الخروج !');
                        return;
                      }
                    }
                    setItemSearch('');
                    setWizardStep(wizardStep + 1);
                  }}
                  className="py-3 px-5 bg-orange-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{language === 'fr' ? 'Suivant' : 'التالي'}</span>
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  id="wizard-submit-btn"
                  onClick={handleCreateReservation}
                  className="py-3 px-6 bg-orange-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  {language === 'fr' ? 'Valider la réservation' : 'تأكيد وحفظ الحجز'}
                </button>
              )}

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
