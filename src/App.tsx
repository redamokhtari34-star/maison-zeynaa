import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
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

  const refreshFromSupabase = async () => {
    setSupabaseSyncing(true);
    try {
      await cleanFinancialsAndReservationsForProduction();
      const remoteState = await fetchFullDatabaseStateFromSupabase();
      setDb(remoteState);
    } catch (err) {
      console.warn('Could not sync with Supabase:', err);
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
    <div className={`min-h-screen bg-neutral-100 flex ${isRtl ? 'flex-row-reverse' : 'flex-row'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Sidebar Shell */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        language={language}
        setLanguage={setLanguage}
        transactions={db.transactions}
      />

      {/* Main Container viewport — clears the mobile top bar and bottom tab bar,
          and the floating desktop rail. */}
      <main className={`flex-1 px-4 pt-20 pb-32 sm:px-6 lg:p-8 lg:pb-8 transition-all ${
        isRtl ? 'lg:pr-[268px]' : 'lg:pl-[268px]'
      }`}>
        {renderTabContent()}
      </main>
    </div>
  );
}
