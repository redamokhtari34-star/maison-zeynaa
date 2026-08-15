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
  Receipt,
  Pencil
} from 'lucide-react';
import { Reservation, Cliente, Dress, Bijou, Language, ReservationItem, Transaction } from '../types';
import { translations } from '../translations';
import { addHistoryEntry, checkItemAvailability, saveTransactions, getTransactions, getSupabaseClient, mapReservationToDb, mapTransactionToDb, isUuid } from '../lib/storage';
import { todayIso, isoInDays, nowTime } from '../lib/dates';
import { notify, notifyError, notifySuccess } from '../lib/toast';
import { mirrorToCloud } from '../lib/sync';
import { askConfirm } from '../lib/confirm';

const LOCAL_SYNC_FAIL = "Modification enregistrée sur cet appareil, "
  + "mais la synchronisation avec le cloud a échoué.";

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
  initialSearchTerm?: string | null;
  onSearchTermHandled?: () => void;
  initialEditReservationId?: string | null;
  onEditReservationHandled?: () => void;
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
  onRefreshData,
  initialSearchTerm,
  onSearchTermHandled,
  initialEditReservationId,
  onEditReservationHandled
}: ReservationsProps) {
  const t = translations[language];
  const isRtl = language === 'ar';

  const todayStr = todayIso();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Arriving from elsewhere (e.g. a transaction in the revenue detail)
  // with a specific client already in mind — the search field picks it up
  // instead of showing every reservation and making them find it again.
  React.useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
      onSearchTermHandled?.();
    }
  }, [initialSearchTerm, onSearchTermHandled]);

  // Wizard state. The same wizard records a new booking and corrects an
  // existing one; editingId tells the two apart and is the booking being
  // corrected.
  const [isWizardOpen, setIsWizardOpen] = useState(initialOpenForm || false);
  // Guards the submit button against a double-click/double-tap creating the
  // same booking (and its deposit transaction) twice — the local write is
  // synchronous and fast enough that a second tap lands before any UI
  // feedback appears.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
  // A price agreed with this particular client, keyed by article id. Falls
  // back to the catalogue price until touched — the catalogue itself is never
  // written to, so the next booking of the same dress starts from its normal
  // price again.
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
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

  // What actually shows up in a caisse transaction's description — the
  // article(s), not the reservation's internal id, which meant nothing to
  // anyone reading the till later.
  const itemsLabel = (res: Reservation) =>
    res.items.map(i => i.nom_article).filter(Boolean).join(', ') || 'Article';

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

  // The price charged for an article in this booking: the price agreed with
  // this client if one was entered, otherwise the catalogue price.
  const priceFor = (item: Dress | Bijou) => priceOverrides[item.id] ?? item.prix_location_da;

  // Calculations for Wizard
  const totalDressesPrice = selectedDresses.reduce((sum, d) => sum + priceFor(d), 0);
  const totalBijouxPrice = selectedBijoux.reduce((sum, b) => sum + priceFor(b), 0);
  const totalCost = totalDressesPrice + totalBijouxPrice;

  const totalCaution = selectedDresses.reduce((sum, d) => sum + d.caution_da, 0);
  const remainingCost = Math.max(0, totalCost - montantPaye);

  // Delete booking
  const handleDeleteBooking = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = reservations.find(r => r.id === id);
    if (!res) return;

    // The initial deposit — taken when the booking was first made — stays
    // counted as revenue even on cancellation; only money collected afterward
    // (a correction, the balance) is treated as a refund.
    const initialDeposit = Math.min(res.acompte_initial_da ?? res.montant_paye_da, res.montant_paye_da);
    const refundAmount = res.montant_paye_da - initialDeposit;
    const hasRefund = refundAmount > 0;

    // A cancelled booking whose client paid beyond the initial deposit is a
    // partial refund, not just a deletion — say so up front, since it changes
    // what happens to the till. Even when there's nothing to refund, a
    // deposit that stays fully counted still needs to be said out loud —
    // otherwise the dialog goes silent about real money for reservations
    // whose initial deposit covers everything paid so far (e.g. ones from
    // before this distinction existed).
    const msg = hasRefund
      ? (language === 'fr'
          ? `Êtes-vous sûr d'annuler et de supprimer définitivement la réservation #${id.toUpperCase()} ?\n\n${formatDa(refundAmount)} versés en plus de l'acompte initial seront retirés du chiffre d'affaires, comme un remboursement. L'acompte initial de ${formatDa(initialDeposit)} reste comptabilisé.`
          : `هل أنت متأكد من إلغاء وحذف الحجز رقم #${id.toUpperCase()} نهائياً؟\n\nسيتم خصم ${formatDa(refundAmount)} المدفوعة زيادة عن العربون الأولي من رقم الأعمال كاسترجاع. يبقى العربون الأولي البالغ ${formatDa(initialDeposit)} محتسباً.`)
      : initialDeposit > 0
        ? (language === 'fr'
            ? `Êtes-vous sûr d'annuler et de supprimer définitivement la réservation #${id.toUpperCase()} ?\n\nL'acompte initial de ${formatDa(initialDeposit)} déjà versé reste comptabilisé dans le chiffre d'affaires, aucun remboursement ne sera effectué.`
            : `هل أنت متأكد من إلغاء وحذف الحجز رقم #${id.toUpperCase()} نهائياً؟\n\nالعربون الأولي البالغ ${formatDa(initialDeposit)} المدفوع مسبقاً يبقى محتسباً في رقم الأعمال، لن يتم أي استرجاع.`)
        : (language === 'fr'
            ? `Êtes-vous sûr d'annuler et de supprimer définitivement la réservation #${id.toUpperCase()} ?`
            : `هل أنت متأكد من إلغاء وحذف الحجز رقم #${id.toUpperCase()} نهائياً؟`);

    if (await askConfirm({
      title: language === 'fr' ? 'Annuler la réservation' : 'إلغاء الحجز',
      message: msg,
      danger: true,
      confirmLabel: hasRefund
        ? (language === 'fr' ? 'Supprimer et rembourser' : 'حذف واسترجاع المبلغ')
        : (language === 'fr' ? 'Supprimer' : 'حذف'),
      cancelLabel: language === 'fr' ? 'Annuler' : 'إلغاء'
    })) {
      const supabase = getSupabaseClient();
      if (supabase) {
        mirrorToCloud(() => supabase.from('reservations').delete().eq('id', id), LOCAL_SYNC_FAIL);
      }

      const updated = reservations.filter(r => r.id !== id);
      onSaveReservations(updated);

      // Only the part paid beyond the initial deposit leaves the till — a
      // signed 'entree' entry, the same way it came in — so revenue and
      // cash-in-hand, which both sum that type directly, net back out exactly
      // what was returned to the client. The initial deposit stays counted.
      if (hasRefund) {
        const refundTr: Transaction = {
          id: crypto.randomUUID(),
          type: 'entree',
          montant_da: -refundAmount,
          description: `Remboursement ${itemsLabel(res)} - ${getClientName(res.cliente_id)}`,
          categorie: 'Réservation',
          date: todayStr,
          heure: nowTime(),
          utilisateur: 'Zeyna',
          source_argent: 'caisse'
        };
        onAddTransaction(refundTr);
        if (supabase) {
          mirrorToCloud(() => supabase.from('mouvements_caisse').insert([mapTransactionToDb(refundTr)]), LOCAL_SYNC_FAIL);
        }
      }

      addHistoryEntry(
        language === 'fr' ? 'Annulation de réservation' : 'إلغاء حجز',
        hasRefund
          ? `La réservation #${id.toUpperCase()} de la cliente ${getClientName(res.cliente_id)} a été annulée. ${formatDa(refundAmount)} remboursés, acompte initial de ${formatDa(initialDeposit)} conservé.`
          : initialDeposit > 0
            ? `La réservation #${id.toUpperCase()} de la cliente ${getClientName(res.cliente_id)} a été annulée. Acompte initial de ${formatDa(initialDeposit)} conservé, aucun remboursement.`
            : `La réservation #${id.toUpperCase()} de la cliente ${getClientName(res.cliente_id)} a été annulée.`
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

    if (await askConfirm({
      title: language === 'fr' ? 'Encaisser le solde' : 'تحصيل المتبقي',
      message: msg,
      confirmLabel: language === 'fr' ? 'Encaisser' : 'تحصيل',
      cancelLabel: language === 'fr' ? 'Annuler' : 'إلغاء'
    })) {
      const updatedResObj: Reservation = {
        ...res,
        montant_paye_da: res.montant_total_da,
        reste_a_payer_da: 0
      };

      const supabase = getSupabaseClient();
      if (supabase) {
        mirrorToCloud(() => supabase.from('reservations').update(mapReservationToDb(updatedResObj)).eq('id', res.id), LOCAL_SYNC_FAIL);
      }

      const updated = reservations.map(r => r.id === res.id ? updatedResObj : r);
      onSaveReservations(updated);

      // Log transaction in Caisse
      const newTr: Transaction = {
        id: crypto.randomUUID(),
        type: 'entree',
        montant_da: amountToPay,
        description: `Solde ${itemsLabel(res)} - ${getClientName(res.cliente_id)}`,
        categorie: 'Réservation',
        date: todayStr,
        heure: new Date().toTimeString().split(' ')[0].substring(0, 5),
        utilisateur: 'Zeyna',
        note: `Solde payé manuellement depuis la fiche de réservation`
      };

      if (supabase) {
        mirrorToCloud(() => supabase.from('mouvements_caisse').insert([mapTransactionToDb(newTr)]), LOCAL_SYNC_FAIL);
      }

      onAddTransaction(newTr);

      // Log to history
      addHistoryEntry(
        language === 'fr' ? 'Paiement solde' : 'دفع باقي الحجز',
        `Solde de ${formatDa(amountToPay)} encaissé pour la réservation #${res.id.toUpperCase()} (Cliente: ${getClientName(res.cliente_id)}).`
      );
    }
  };

  // Open creation wizard
  const openNewWizard = () => {
    setEditingId(null);
    setClientNameInput('');
    setClientPhoneInput('');
    setDateSortie(todayStr);
    setDateRetour(isoInDays(3));
    setSelectedDresses([]);
    setSelectedBijoux([]);
    setPriceOverrides({});
    setMontantPaye(0);
    setNotes('');
    setWizardStep(1);
    setIsSubmitting(false);
    setIsWizardOpen(true);
  };

  // Open the same wizard on an existing booking, every field prefilled.
  //
  // The stored items only carry the article's identifier and the price charged
  // at the time, so each one is matched back to the catalogue entry the wizard
  // works with. An article since removed from the catalogue is skipped rather
  // than allowed to break the booking — it stays on the record until saved.
  const openEditWizard = (res: Reservation) => {
    setEditingId(res.id);
    setClientNameInput(getClientName(res.cliente_id));
    setClientPhoneInput(getClientPhone(res.cliente_id));
    setDateSortie(res.date_sortie);
    setDateRetour(res.date_retour);

    setSelectedDresses(
      res.items
        .filter(i => i.type_article === 'robe')
        .map(i => dresses.find(d => d.id === i.article_id))
        .filter((d): d is Dress => Boolean(d))
    );
    setSelectedBijoux(
      res.items
        .filter(i => i.type_article === 'bijou')
        .map(i => bijoux.find(b => b.id === i.article_id))
        .filter((b): b is Bijou => Boolean(b))
    );

    // The price actually charged on the booking, which the wizard reopens
    // with rather than silently swapping in the catalogue's current price.
    const overrides: Record<string, number> = {};
    res.items.forEach(i => { overrides[i.article_id] = i.prix_da; });
    setPriceOverrides(overrides);

    setMontantPaye(res.montant_paye_da);
    setNotes(res.notes || '');
    setWizardStep(1);
    setIsSubmitting(false);
    setIsWizardOpen(true);
  };

  // Arriving from elsewhere with a specific booking already identified (e.g.
  // a transaction in the revenue detail) opens it directly for editing,
  // rather than just filtering the list down to it.
  React.useEffect(() => {
    if (!initialEditReservationId) return;
    const match = reservations.find(r => r.id === initialEditReservationId);
    if (match) openEditWizard(match);
    onEditReservationHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditReservationId, onEditReservationHandled]);

  // Handle addition/removal of items in wizard
  const toggleDressSelect = (dress: Dress) => {
    const isSelected = selectedDresses.some(d => d.id === dress.id);
    if (isSelected) {
      setSelectedDresses(selectedDresses.filter(d => d.id !== dress.id));
    } else {
      // Check overlap before selecting
      // While correcting a booking, its own items must not read as taken.
      const avail = checkItemAvailability('robe', dress.id, dateSortie, dateRetour, editingId ?? undefined);
      if (!avail.available) {
        const conflictClient = getClientName(avail.conflictingReservation!.cliente_id);
        const warningMsg = language === 'fr'
          ? `La robe "${dress.nom}" est déjà réservée par ${conflictClient} du ${avail.conflictingReservation!.date_sortie} au ${avail.conflictingReservation!.date_retour}.`
          : `الفستان "${dress.nom}" محجوز بالفعل للزبونة ${conflictClient} من ${avail.conflictingReservation!.date_sortie} إلى ${avail.conflictingReservation!.date_retour}.`;
        notifyError(warningMsg);
        return;
      }

      // The robe is selectable because its current rental ends before this
      // one begins — worth saying out loud, since "occupée" on the catalogue
      // card doesn't explain why picking it here was still allowed.
      const current = reservations.find(r =>
        r.id !== editingId &&
        (r.statut === 'en_cours' || r.statut === 'en_retard') &&
        r.items.some(i => i.type_article === 'robe' && i.article_id === dress.id)
      );
      if (current) {
        const returnMsg = current.date_retour === todayStr
          ? (language === 'fr'
              ? `"${dress.nom}" est encore en location, mais revient aujourd'hui.`
              : `"${dress.nom}" لا تزال مؤجرة، لكنها تعود اليوم.`)
          : (language === 'fr'
              ? `"${dress.nom}" est encore en location, retour prévu le ${current.date_retour}.`
              : `"${dress.nom}" لا تزال مؤجرة، الإرجاع متوقع في ${current.date_retour}.`);
        notify(returnMsg, 'info');
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
      const avail = checkItemAvailability('bijou', bijou.id, dateSortie, dateRetour, editingId ?? undefined);
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

  // Resolve the name and number typed in the wizard to a client file, creating
  // or correcting one as needed, and return the identifier to book against.
  // Shared by creation and correction so a booking never ends up pointing at a
  // client who exists on one path and not the other.
  const resolveClient = (clientName: string, clientPhone: string) => {
    const localMatch = findClientByName(clientName);
    const localClientId = localMatch?.id ?? crypto.randomUUID();

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

    return { localClientId, localMatch };
  };

  // Correct an existing booking
  //
  // A reservation gets edited for ordinary reasons: a date moves, a dress is
  // swapped, an amount was mistyped. Everything the wizard collects can be
  // changed; what it does not collect — the identifier, the creation date, the
  // history already attached to the booking — is carried over untouched.
  const handleUpdateReservation = async () => {
    if (isSubmitting) return;
    const existing = reservations.find(r => r.id === editingId);
    if (!existing) return;

    if (selectedDresses.length === 0 && selectedBijoux.length === 0) {
      notifyError(language === 'fr' ? 'Sélectionnez au moins une robe ou un bijou.' : 'يرجى اختيار فستان واحد أو حلي واحد على الأقل.');
      return;
    }

    const clientName = clientNameInput.trim();
    if (!clientName) {
      notifyError(language === 'fr' ? 'Veuillez renseigner le nom de la cliente.' : 'يرجى كتابة اسم الزبونة.');
      return;
    }

    setIsSubmitting(true);

    const clientPhone = clientPhoneInput.trim();
    const { localClientId, localMatch } = resolveClient(clientName, clientPhone);

    const items: ReservationItem[] = [
      ...selectedDresses.map(d => ({
        id: crypto.randomUUID(),
        reservation_id: existing.id,
        type_article: 'robe' as const,
        article_id: d.id,
        prix_da: priceFor(d),
        nom_article: d.nom
      })),
      ...selectedBijoux.map(b => ({
        id: crypto.randomUUID(),
        reservation_id: existing.id,
        type_article: 'bijou' as const,
        article_id: b.id,
        prix_da: priceFor(b),
        nom_article: b.nom
      }))
    ];

    // A rental already returned, or already flagged late, keeps the status it
    // earned; only a booking still running follows its dates.
    const statut = existing.statut === 'retourne' || existing.statut === 'en_retard'
      ? existing.statut
      : dateSortie > todayStr ? 'future' : 'en_cours';

    const updated: Reservation = {
      ...existing,
      cliente_id: localClientId,
      date_sortie: dateSortie,
      date_retour: dateRetour,
      montant_total_da: totalCost,
      caution_da: totalCaution,
      montant_paye_da: montantPaye,
      // Corrections change what's owed and what's been paid, never the
      // original deposit — it was fixed at creation and stays that way.
      acompte_initial_da: existing.acompte_initial_da ?? existing.montant_paye_da,
      reste_a_payer_da: remainingCost,
      statut,
      notes,
      items
    };

    onSaveReservations(reservations.map(r => (r.id === existing.id ? updated : r)));

    // Correcting the amount received has to reach the till, or the cash drawer
    // and the booking stop agreeing. Only the difference is recorded, signed:
    // positive when more was taken, negative when money went back to the
    // client. Revenue and cash-in-hand both sum 'entree' transactions
    // directly, so a negative entry here is what actually pulls the
    // correction out of the till, not just an expense line next to it.
    const paidDelta = montantPaye - existing.montant_paye_da;
    if (paidDelta !== 0) {
      onAddTransaction({
        id: crypto.randomUUID(),
        type: 'entree',
        montant_da: paidDelta,
        description: `Correction acompte ${itemsLabel(updated)} - ${clientName}`,
        categorie: 'Réservation',
        date: todayStr,
        heure: nowTime(),
        utilisateur: 'Zeyna',
        source_argent: 'caisse'
      } as Transaction);
    }

    addHistoryEntry(
      language === 'fr' ? 'Réservation modifiée' : 'تعديل حجز',
      `Réservation de ${clientName} modifiée. Total: ${formatDa(totalCost)}.`
    );

    setIsWizardOpen(false);
    setEditingId(null);

    // ── Then mirror the correction to the cloud, best effort ────────────
    const supabase = getSupabaseClient();
    if (!supabase) {
      notifySuccess(language === 'fr'
        ? 'Réservation modifiée sur cet appareil (cloud non configuré).'
        : 'تم تعديل الحجز على هذا الجهاز (السحابة غير مهيأة).');
      return;
    }

    try {
      let validUuidClientId = isUuid(localClientId) ? localClientId : null;

      if (clientPhone) {
        const { data: foundClients } = await supabase
          .from('clients')
          .select('id')
          .eq('telephone', clientPhone)
          .limit(1);
        if (foundClients?.[0] && isUuid(foundClients[0].id)) {
          validUuidClientId = foundClients[0].id;
        }
      }

      const parts = clientName.split(' ');
      const prenom = parts[0] || '';
      const nom = parts.length > 1 ? parts.slice(1).join(' ') : prenom;

      const { error: clientErr } = await supabase.from('clients').upsert([{
        id: validUuidClientId,
        nom,
        prenom,
        telephone: clientPhone || localMatch?.telephone || '',
        adresse: localMatch?.adresse || ''
      }]);
      if (clientErr) throw new Error(clientErr.message);

      const robeItem = selectedDresses[0];
      const bijouItem = selectedBijoux[0];

      const { error: resError } = await supabase
        .from('reservations')
        .update({
          client_id: validUuidClientId,
          robe_id: robeItem && isUuid(robeItem.id) ? robeItem.id : null,
          bijou_id: bijouItem && isUuid(bijouItem.id) ? bijouItem.id : null,
          date_debut: dateSortie || null,
          date_fin: dateRetour || null,
          statut_reservation: statut,
          prix_total: Number(totalCost) || 0,
          acompte: Number(montantPaye) || 0,
          reste_a_payer: Number(remainingCost) || 0,
          caution_totale: Number(totalCaution) || 0,
          notes: notes || null
        })
        .eq('id', existing.id);
      if (resError) throw new Error(resError.message);

      // The join tables hold one row per article; a correction can add, remove
      // or swap any of them, so the previous set is cleared and rewritten
      // rather than patched row by row.
      await supabase.from('reservation_robes').delete().eq('reservation_id', existing.id);
      await supabase.from('reservation_bijoux').delete().eq('reservation_id', existing.id);

      const robeRows = selectedDresses
        .filter(d => isUuid(d.id))
        .map(d => ({
          id: crypto.randomUUID(),
          reservation_id: existing.id,
          robe_id: d.id,
          prix: priceFor(d) || 0,
          caution: d.caution_da || 0
        }));
      if (robeRows.length) {
        const { error } = await supabase.from('reservation_robes').insert(robeRows);
        if (error) console.warn('Could not link dresses to reservation:', error.message);
      }

      const bijouRows = selectedBijoux
        .filter(b => isUuid(b.id))
        .map(b => ({
          id: crypto.randomUUID(),
          reservation_id: existing.id,
          bijou_id: b.id,
          prix: priceFor(b) || 0,
          caution: 0
        }));
      if (bijouRows.length) {
        const { error } = await supabase.from('reservation_bijoux').insert(bijouRows);
        if (error) console.warn('Could not link jewellery to reservation:', error.message);
      }

      if (paidDelta !== 0) {
        const { error: trError } = await supabase.from('mouvements_caisse').insert([{
          type: 'entree',
          montant: paidDelta,
          source: 'caisse',
          beneficiaire: null,
          motif: `Correction acompte ${itemsLabel(updated)} - ${clientName}`
        }]);
        if (trError) throw new Error(trError.message);
      }

      notifySuccess(language === 'fr'
        ? 'Réservation modifiée et synchronisée.'
        : 'تم تعديل الحجز ومزامنته.');
    } catch (err) {
      console.error('Could not sync reservation update to Supabase:', err);
      notifyError(language === 'fr' ? LOCAL_SYNC_FAIL : 'تم التعديل على هذا الجهاز، لكن فشلت المزامنة مع السحابة.');
    }
  };

  // Save Booking Wizard
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (selectedDresses.length === 0 && selectedBijoux.length === 0) {
      notifyError(language === 'fr' ? 'Sélectionnez au moins une robe ou un bijou.' : 'يرجى اختيار فستان واحد أو حلي واحد على الأقل.');
      return;
    }

    const clientName = clientNameInput.trim();
    if (!clientName) {
      notifyError(language === 'fr' ? 'Veuillez renseigner le nom de la cliente.' : 'يرجى كتابة اسم الزبونة.');
      return;
    }

    setIsSubmitting(true);

    const clientPhone = clientPhoneInput.trim();

    // Keep the local client file in step with what was typed: record a new
    // client, or fill in / correct the number of one already on file.
    const { localClientId, localMatch } = resolveClient(clientName, clientPhone);

    // ── Record locally first ────────────────────────────────────────────
    // The shop must be able to take a booking with the network down, so the
    // reservation is committed on the device before the cloud is contacted.
    const localResId = crypto.randomUUID();
    const localItems: ReservationItem[] = [
      ...selectedDresses.map(d => ({
        id: crypto.randomUUID(),
        reservation_id: localResId,
        type_article: 'robe' as const,
        article_id: d.id,
        prix_da: priceFor(d),
        nom_article: d.nom
      })),
      ...selectedBijoux.map(b => ({
        id: crypto.randomUUID(),
        reservation_id: localResId,
        type_article: 'bijou' as const,
        article_id: b.id,
        prix_da: priceFor(b),
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
      // Recorded once, at creation, as the non-refundable initial deposit —
      // any amount paid later stays distinct from it.
      acompte_initial_da: montantPaye,
      reste_a_payer_da: remainingCost,
      statut: dateSortie > todayStr ? 'future' : 'en_cours',
      notes,
      date_creation: todayStr,
      items: localItems
    };
    onSaveReservations([localReservation, ...reservations]);

    if (montantPaye > 0) {
      onAddTransaction({
        id: crypto.randomUUID(),
        type: 'entree',
        montant_da: montantPaye,
        description: `Acompte ${itemsLabel(localReservation)} - ${clientName}`,
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

    // The local record already carries a UUID, so the same identifier is used
    // on both sides. Matching on the phone number rather than on the spelling
    // of a name is what stops the same person being filed twice.
    let validUuidClientId = isUuid(localClientId) ? localClientId : null;

    if (clientPhone) {
      const { data: foundClients } = await supabase
        .from('clients')
        .select('id')
        .eq('telephone', clientPhone)
        .limit(1);
      if (foundClients?.[0] && isUuid(foundClients[0].id)) {
        validUuidClientId = foundClients[0].id;
      }
    }

    const parts = clientName.trim().split(' ');
    const prenom = parts[0] || '';
    const nom = parts.length > 1 ? parts.slice(1).join(' ') : prenom;

    // upsert: creates the client on first sight, refreshes her details after.
    const { error: clientErr } = await supabase.from('clients').upsert([{
      id: validUuidClientId,
      nom,
      prenom,
      telephone: clientPhone || localMatch?.telephone || '',
      adresse: localMatch?.adresse || ''
    }]);
    if (clientErr) throw new Error(clientErr.message);

    const robeItem = selectedDresses[0];
    const validRobeId = robeItem && isUuid(robeItem.id) ? robeItem.id : null;

    const bijouItem = selectedBijoux[0];
    const validBijouId = bijouItem && isUuid(bijouItem.id) ? bijouItem.id : null;

    const { error: resError } = await supabase.from('reservations').insert([{
      // Same identifier on both sides, so the booking can be matched later.
      id: localResId,
      client_id: validUuidClientId,
      // The single columns keep the first item for compatibility; the full
      // selection goes to the join tables below.
      robe_id: validRobeId,
      bijou_id: validBijouId,
      date_debut: dateSortie || null,
      date_fin: dateRetour || null,
      statut_reservation: localReservation.statut,
      prix_total: Number(totalCost) || 0,
      acompte: Number(montantPaye) || 0,
      acompte_initial: Number(montantPaye) || 0,
      reste_a_payer: Number(remainingCost) || 0,
      // The deposit is money owed back to the client — it must not stay local.
      caution_totale: Number(totalCaution) || 0,
      notes: notes || null
    }]);

      if (resError) throw new Error(resError.message);

      // Every selected article, not just the first: a booking regularly holds
      // several dresses and several pieces of jewellery.
      const robeRows = selectedDresses
        .filter(d => isUuid(d.id))
        .map(d => ({
          id: crypto.randomUUID(),
          reservation_id: localResId,
          robe_id: d.id,
          prix: priceFor(d) || 0,
          caution: d.caution_da || 0
        }));
      if (robeRows.length) {
        const { error } = await supabase.from('reservation_robes').insert(robeRows);
        if (error) console.warn('Could not link dresses to reservation:', error.message);
      }

      const bijouRows = selectedBijoux
        .filter(b => isUuid(b.id))
        .map(b => ({
          id: crypto.randomUUID(),
          reservation_id: localResId,
          bijou_id: b.id,
          prix: priceFor(b) || 0,
          caution: 0
        }));
      if (bijouRows.length) {
        const { error } = await supabase.from('reservation_bijoux').insert(bijouRows);
        if (error) console.warn('Could not link jewellery to reservation:', error.message);
      }

      if (montantPaye > 0) {
        const trRowToInsert = {
          type: 'entree',
          montant: montantPaye,
          source: 'caisse',
          beneficiaire: null,
          motif: `Acompte ${itemsLabel(localReservation)} - ${clientName}`
        };

        const { error: trError } = await supabase.from('mouvements_caisse').insert([trRowToInsert]);
        if (trError) throw new Error(trError.message);
      }

      notifySuccess(language === 'fr'
        ? 'Réservation enregistrée et synchronisée.'
        : 'تم حفظ الحجز ومزامنته.');

      // Only pull the cloud copy back once it holds this booking, otherwise the
      // refresh would overwrite the local record we just committed.
    } catch (err) {
      console.error('Could not sync reservation to Supabase:', err);
      notifyError(language === 'fr'
        ? "Réservation enregistrée sur cet appareil, mais la synchronisation avec le cloud a échoué. Elle sera visible ici en attendant."
        : 'تم حفظ الحجز على هذا الجهاز، لكن فشلت المزامنة مع السحابة.');
    }
  };

  // Filter reservations, soonest departure first — a reservation made last
  // week for a client leaving tomorrow belongs above one just booked for
  // next month.
  const filteredReservations = reservations
    .filter(res => {
      const clientName = getClientName(res.cliente_id).toLowerCase();
      const clientPhone = getClientPhone(res.cliente_id);
      const matchesSearch = clientName.includes(searchTerm.toLowerCase()) || clientPhone.includes(searchTerm);

      const matchesStatus = statusFilter === 'all' || res.statut === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => a.date_sortie.localeCompare(b.date_sortie));

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

                      {/* Correct the booking — dates, articles, amounts, notes */}
                      <button
                        id={`edit-res-btn-${res.id}`}
                        onClick={() => openEditWizard(res)}
                        title={language === 'fr' ? 'Modifier la réservation' : 'تعديل الحجز'}
                        className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg border border-neutral-200 hover:border-orange-200 cursor-pointer transition-all duration-200"
                      >
                        <Pencil size={14} />
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
          <div onClick={() => { setIsWizardOpen(false); setEditingId(null); }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

          {/* Dialog Panel */}
          <div className="relative w-full max-w-xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col z-10 animate-scale-up max-h-[90vh]">
            
            {/* Header */}
            <div className={`p-6 border-b border-neutral-200 flex justify-between items-center bg-slate-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingId
                    ? (language === 'fr' ? 'Modifier la réservation' : 'تعديل الحجز')
                    : (language === 'fr' ? 'Assistant de Réservation' : 'مساعد تسجيل الحجوزات')}
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
              <button onClick={() => { setIsWizardOpen(false); setEditingId(null); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
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
                        const isAvail = isSelected ? { available: true } : checkItemAvailability('robe', dress.id, dateSortie, dateRetour, editingId ?? undefined);
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
                        const isAvail = isSelected ? { available: true } : checkItemAvailability('bijou', bijou.id, dateSortie, dateRetour, editingId ?? undefined);
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

                  {/* Items count — each price is editable: what this client actually
                      pays for the piece, agreed on the spot. The catalogue price
                      underneath is untouched. */}
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs text-gray-700">
                    <div className="flex justify-between items-baseline">
                      <p className="font-bold text-gray-400 uppercase tracking-wide text-[9px]">
                        {language === 'fr' ? 'Articles sélectionnées' : 'المواد المختارة'}
                      </p>
                      <p className="text-[9px] text-gray-400">
                        {language === 'fr' ? 'Prix modifiable' : 'السعر قابل للتعديل'}
                      </p>
                    </div>
                    {selectedDresses.map(d => (
                      <div key={d.id} className="flex justify-between items-center gap-2 font-medium">
                        <span className="truncate">👗 {d.nom}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {priceOverrides[d.id] !== undefined && priceOverrides[d.id] !== d.prix_location_da && (
                            <span className="text-[10px] text-gray-400 line-through font-mono">{formatDa(d.prix_location_da)}</span>
                          )}
                          <input
                            id={`wizard-price-override-${d.id}`}
                            type="number"
                            min="0"
                            value={priceFor(d)}
                            onChange={(e) => setPriceOverrides({ ...priceOverrides, [d.id]: Number(e.target.value) })}
                            className="w-20 p-1 text-right bg-white border border-neutral-200 rounded-lg font-bold font-mono focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>
                    ))}
                    {selectedBijoux.map(b => (
                      <div key={b.id} className="flex justify-between items-center gap-2 font-medium">
                        <span className="truncate">💍 {b.nom}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {priceOverrides[b.id] !== undefined && priceOverrides[b.id] !== b.prix_location_da && (
                            <span className="text-[10px] text-gray-400 line-through font-mono">{formatDa(b.prix_location_da)}</span>
                          )}
                          <input
                            id={`wizard-price-override-${b.id}`}
                            type="number"
                            min="0"
                            value={priceFor(b)}
                            onChange={(e) => setPriceOverrides({ ...priceOverrides, [b.id]: Number(e.target.value) })}
                            className="w-20 p-1 text-right bg-white border border-neutral-200 rounded-lg font-bold font-mono focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>
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
                  disabled={isSubmitting}
                  onClick={editingId ? handleUpdateReservation : handleCreateReservation}
                  className="py-3 px-6 bg-orange-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {editingId
                    ? (language === 'fr' ? 'Enregistrer les modifications' : 'حفظ التعديلات')
                    : (language === 'fr' ? 'Valider la réservation' : 'تأكيد وحفظ الحجز')}
                </button>
              )}

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
