import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Robes from './components/Robes';
import Bijoux from './components/Bijoux';
import Clientes from './components/Clientes';
import Reservations from './components/Reservations';
import Calendrier from './components/Calendrier';
import Caisse from './components/Caisse';
import Statistiques from './components/Statistiques';
import Retours from './components/Retours';
import Documents from './components/Documents';
import Parametres from './components/Parametres';

import { 
  Language, 
  Dress, 
  Bijou, 
  Cliente, 
  Reservation, 
  Transaction, 
  HistoriqueAction 
} from './types';

import { 
  getFullDatabaseState, 
  saveDresses, 
  saveBijoux, 
  saveClientes, 
  saveReservations, 
  saveTransactions, 
  saveHistory,
  resetDatabaseToDefaults,
  fetchFullDatabaseStateFromSupabase,
  getSupabaseClient,
  seedSupabaseWithSampleData,
  cleanFinancialsAndReservationsForProduction
} from './lib/storage';

export default function App() {
  // Lazily load full database state once on mount
  const [db, setDb] = useState(() => {
    cleanFinancialsAndReservationsForProduction();
    return getFullDatabaseState();
  });
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  // Whether the last sync actually reached the cloud. Drives the status pill,
  // which must never claim "synchronised" when it isn't.
  const [cloudReachable, setCloudReachable] = useState(false);

  const refreshFromSupabase = async () => {
    setSupabaseSyncing(true);
    try {
      // A dropped connection can leave these requests pending indefinitely, so
      // cap the wait — otherwise the status would spin forever and the app
      // would look stuck rather than simply offline.
      const withTimeout = <T,>(p: Promise<T>, ms = 12000) =>
        Promise.race([
          p,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Supabase sync timed out')), ms)
          )
        ]);

      await withTimeout(cleanFinancialsAndReservationsForProduction());
      const remoteState = await withTimeout(fetchFullDatabaseStateFromSupabase());
      setDb(remoteState);
      setCloudReachable(true);
    } catch (err) {
      console.warn('Could not sync with Supabase:', err);
      setCloudReachable(false);
    } finally {
      setSupabaseSyncing(false);
    }
  };

  useEffect(() => {
    refreshFromSupabase();
  }, []);

  // App shell state
  const [currentTab, setCurrentTab] = useState<string>('accueil');
  const [language, setLanguage] = useState<Language>('fr');

  // Trigger from invoices
  const [invoiceReservationId, setInvoiceReservationId] = useState<string | null>(null);

  // Quick Action triggers
  const [quickAction, setQuickAction] = useState<string | null>(null);

  const handleOpenQuickAction = (action: string) => {
    setQuickAction(action);
    if (action === 'reservation') {
      setCurrentTab('reservations');
    } else if (action === 'robe') {
      setCurrentTab('robes');
    } else if (action === 'bijou') {
      setCurrentTab('bijoux');
    } else if (action === 'cliente') {
      setCurrentTab('clientes');
    } else if (action === 'depense') {
      setCurrentTab('caisse');
    }
  };

  const handleFormOpenHandled = () => {
    setQuickAction(null);
  };

  const isRtl = language === 'ar';

  // Feeds the top bar: what actually needs the manager's attention today.
  const todayStr = '2026-07-21';
  const alertCount = db.reservations.filter(
    r => r.statut === 'en_retard' || (r.date_retour === todayStr && r.statut === 'en_cours')
  ).length;

  // Configured *and* proven reachable by the last sync.
  const cloudConnected = getSupabaseClient() !== null && cloudReachable;

  // Dynamic Save and update proxies
  const handleSaveDresses = (updatedDresses: Dress[]) => {
    saveDresses(updatedDresses);
    // Reload state so UI receives the update
    setDb(prev => ({ ...prev, dresses: updatedDresses }));
  };

  const handleSaveBijoux = (updatedBijoux: Bijou[]) => {
    saveBijoux(updatedBijoux);
    setDb(prev => ({ ...prev, bijoux: updatedBijoux }));
  };

  const handleSaveClientes = (updatedClientes: Cliente[]) => {
    saveClientes(updatedClientes);
    setDb(prev => ({ ...prev, clientes: updatedClientes }));
  };

  const handleSaveReservations = (updatedReservations: Reservation[]) => {
    saveReservations(updatedReservations);
    setDb(prev => ({ ...prev, reservations: updatedReservations }));
  };

  const handleSaveTransactions = (updatedTransactions: Transaction[]) => {
    saveTransactions(updatedTransactions);
    setDb(prev => ({ ...prev, transactions: updatedTransactions }));
  };

  // Add transaction proxy (passed down to components to append transaction easily)
  const handleAddTransaction = (newTransaction: Transaction) => {
    const updated = [newTransaction, ...db.transactions];
    saveTransactions(updated);
    setDb(prev => ({ ...prev, transactions: updated }));
  };

  // Reset database back to production mode
  const handleResetDatabase = async () => {
    await cleanFinancialsAndReservationsForProduction();
    const freshDb = getFullDatabaseState();
    setDb(freshDb);
    setCurrentTab('accueil');
    alert(language === 'fr' 
      ? 'Mise en production effectuée : Trésorerie et réservations réinitialisées à 0 DA. L’intégralité des catalogues de robes (78) et bijoux (400) a été conservée intacte avec le statut "Disponible".' 
      : 'تمت التهيئة للإنتاج: تم إعادة ضبط الخزينة والحجوزات إلى 0 د.ج مع الحفاظ على الكتالوج كاملاً.');
  };

  // Switch rendered tabs
  const renderTabContent = () => {
    switch (currentTab) {
      case 'accueil':
        return (
          <Dashboard 
            db={db}
            language={language}
            setCurrentTab={setCurrentTab}
            onOpenQuickAction={handleOpenQuickAction}
          />
        );
      case 'robes':
        return (
          <Robes 
            dresses={db.dresses}
            onSaveDresses={handleSaveDresses}
            language={language}
            initialOpenForm={quickAction === 'robe'}
            onFormOpenHandled={handleFormOpenHandled}
            onRefreshData={refreshFromSupabase}
          />
        );
      case 'bijoux':
        return (
          <Bijoux 
            bijoux={db.bijoux}
            onSaveBijoux={handleSaveBijoux}
            language={language}
            initialOpenForm={quickAction === 'bijou'}
            onFormOpenHandled={handleFormOpenHandled}
            onRefreshData={refreshFromSupabase}
          />
        );
      case 'clientes':
        return (
          <Clientes 
            clientes={db.clientes}
            onSaveClientes={handleSaveClientes}
            reservations={db.reservations}
            language={language}
            initialOpenForm={quickAction === 'cliente'}
            onFormOpenHandled={handleFormOpenHandled}
            onRefreshData={refreshFromSupabase}
          />
        );
      case 'reservations':
        return (
          <Reservations 
            reservations={db.reservations}
            onSaveReservations={handleSaveReservations}
            clientes={db.clientes}
            onSaveClientes={handleSaveClientes}
            dresses={db.dresses}
            bijoux={db.bijoux}
            language={language}
            onAddTransaction={handleAddTransaction}
            setCurrentTab={setCurrentTab}
            setInvoiceReservationId={setInvoiceReservationId}
            initialOpenForm={quickAction === 'reservation'}
            onFormOpenHandled={handleFormOpenHandled}
            onRefreshData={refreshFromSupabase}
          />
        );
      case 'calendrier':
        return (
          <Calendrier 
            reservations={db.reservations}
            dresses={db.dresses}
            clientes={db.clientes}
            bijoux={db.bijoux}
            language={language}
            setCurrentTab={setCurrentTab}
            onRefreshData={refreshFromSupabase}
          />
        );
      case 'caisse':
        return (
          <Caisse 
            transactions={db.transactions}
            onSaveTransactions={handleSaveTransactions}
            language={language}
            initialOpenExpense={quickAction === 'depense'}
            onFormOpenHandled={handleFormOpenHandled}
            onRefreshData={refreshFromSupabase}
          />
        );
      case 'statistiques':
        return (
          <Statistiques 
            reservations={db.reservations}
            dresses={db.dresses}
            bijoux={db.bijoux}
            clientes={db.clientes}
            transactions={db.transactions}
            language={language}
          />
        );
      case 'retours':
        return (
          <Retours 
            reservations={db.reservations}
            onSaveReservations={handleSaveReservations}
            dresses={db.dresses}
            onSaveDresses={handleSaveDresses}
            bijoux={db.bijoux}
            onSaveBijoux={handleSaveBijoux}
            onAddTransaction={handleAddTransaction}
            clientes={db.clientes}
            language={language}
            onRefreshData={refreshFromSupabase}
          />
        );
      case 'documents':
        return (
          <Documents 
            reservations={db.reservations}
            clientes={db.clientes}
            language={language}
            invoiceReservationId={invoiceReservationId}
            setInvoiceReservationId={setInvoiceReservationId}
          />
        );
      case 'parametres':
        return (
          <Parametres 
            language={language}
            onLanguageChange={setLanguage}
            onResetData={handleResetDatabase}
            languageList={['fr', 'ar']}
          />
        );
      default:
        return <div>Not found</div>;
    }
  };

  return (
    <div className={`min-h-screen bg-neutral-50 ${isRtl ? 'flex flex-row-reverse' : 'flex flex-row'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Sidebar Shell */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        language={language}
        setLanguage={setLanguage}
        transactions={db.transactions}
      />

      <TopBar
        language={language}
        dresses={db.dresses}
        bijoux={db.bijoux}
        clientes={db.clientes}
        alertCount={alertCount}
        syncing={supabaseSyncing}
        cloudConnected={cloudConnected}
        setCurrentTab={setCurrentTab}
      />

      {/* Main viewport — clears the fixed top bar and the desktop sidebar. */}
      <main className={`flex-1 px-4 pt-24 pb-12 sm:px-6 lg:px-8 ${
        isRtl ? 'lg:pr-[272px]' : 'lg:pl-[272px]'
      }`}>
        {renderTabContent()}
      </main>
    </div>
  );
}
