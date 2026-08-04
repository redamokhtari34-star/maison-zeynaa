import React, { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Toaster from './components/Toaster';
import SplashScreen from './components/SplashScreen';
import InstallPrompt from './components/InstallPrompt';
import Login from './components/Login';
import ConfirmDialog from './components/ConfirmDialog';

// Loaded on demand — the dashboard should not wait for screens nobody opened.
const Robes = lazy(() => import('./components/Robes'));
const Bijoux = lazy(() => import('./components/Bijoux'));
const Clientes = lazy(() => import('./components/Clientes'));
const Reservations = lazy(() => import('./components/Reservations'));
const Calendrier = lazy(() => import('./components/Calendrier'));
const Caisse = lazy(() => import('./components/Caisse'));
const Statistiques = lazy(() => import('./components/Statistiques'));
const Retours = lazy(() => import('./components/Retours'));
const Documents = lazy(() => import('./components/Documents'));
const Parametres = lazy(() => import('./components/Parametres'));
const BlocNotes = lazy(() => import('./components/BlocNotes'));
const Equipe = lazy(() => import('./components/Equipe'));

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
  cleanFinancialsAndReservationsForProduction,
  getHistory,
  subscribeToHistory,
  setCurrentUser
} from './lib/storage';
import { todayIso } from './lib/dates';
import { notifySuccess } from './lib/toast';
import { getSession, onSessionChange, signOut, type Session } from './lib/auth';
import { askConfirm } from './lib/confirm';

export default function App() {
  // Lazily load full database state once on mount.
  // NB: this must never wipe anything — resetting the shop's records is an
  // explicit action from Paramètres, not a side effect of opening the app.
  const [db, setDb] = useState(() => getFullDatabaseState());
  // The splash covers the first paint only; it is skipped for reduced motion.
  const [booting, setBooting] = useState(true);
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  // Whether the last sync actually reached the cloud. Drives the status pill,
  // which must never claim "synchronised" when it isn't.
  const [cloudReachable, setCloudReachable] = useState(false);

  // Records are only reachable once signed in: the policies grant the
  // `authenticated` role, never anonymous visitors.
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    getSession().then(s => { setSession(s); setAuthChecked(true); });
    return onSessionChange(setSession);
  }, []);

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
    if (!session) return;
    // The part before the @ is what a colleague would recognise in the log.
    setCurrentUser(session.user.email?.split('@')[0] ?? 'Zeyna');
    refreshFromSupabase();
  }, [session]);

  // Actions logged from anywhere in the app land on screen straight away.
  useEffect(
    () => subscribeToHistory(() => setDb(prev => ({ ...prev, history: getHistory() }))),
    []
  );

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
  const todayStr = todayIso();
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

  // Wipe reservations, clients and cash records — irreversible, so it is
  // confirmed explicitly and never runs on its own.
  const handleResetDatabase = async () => {
    const warning = language === 'fr'
      ? 'Réinitialisation\n\nSeront supprimés définitivement, sur cet appareil et dans le cloud :\n• les clientes\n• les réservations\n• la caisse et la trésorerie\n• le journal d’activité\n\nSeront conservés :\n• le catalogue des robes\n• le catalogue des bijoux\n\nVoulez-vous vraiment continuer ?'
      : 'إعادة الضبط\n\nسيتم حذفه نهائياً، على هذا الجهاز وفي السحابة:\n• الزبونات\n• الحجوزات\n• الصندوق والخزينة\n• سجل النشاط\n\nسيتم الاحتفاظ به:\n• كتالوج الفساتين\n• كتالوج المجوهرات\n\nهل تريد المتابعة؟';
    if (!(await askConfirm({ title: language === 'fr' ? 'Réinitialisation' : 'إعادة الضبط', message: warning, danger: true, confirmLabel: language === 'fr' ? 'Tout effacer' : 'حذف الكل', cancelLabel: language === 'fr' ? 'Annuler' : 'إلغاء' }))) return;

    await cleanFinancialsAndReservationsForProduction();
    const freshDb = getFullDatabaseState();
    setDb(freshDb);
    setCurrentTab('accueil');
    notifySuccess(language === 'fr'
      ? 'Réinitialisation effectuée : trésorerie et réservations remises à zéro, catalogues conservés.'
      : 'تمت إعادة الضبط: الخزينة والحجوزات صفر، مع الحفاظ على الكتالوج.');
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
      case 'notes':
        return <BlocNotes language={language} />;
      case 'equipe':
        return <Equipe language={language} history={db.history} />;
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

  // Wait for the stored session to be read before deciding what to show, so a
  // signed-in user never sees the login screen flash on reload.
  if (!authChecked) return null;
  if (!session) return <><Login /><Toaster /><ConfirmDialog /></>;

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

      {booting && <SplashScreen onDone={() => setBooting(false)} />}
      <InstallPrompt language={language} />
      <Toaster />
      <ConfirmDialog />

      <TopBar
        language={language}
        dresses={db.dresses}
        bijoux={db.bijoux}
        clientes={db.clientes}
        reservations={db.reservations}
        alertCount={alertCount}
        syncing={supabaseSyncing}
        cloudConnected={cloudConnected}
        setCurrentTab={setCurrentTab}
        userLabel={session.user.email ?? ''}
        onSignOut={signOut}
      />

      {/* Main viewport — clears the fixed top bar and the desktop sidebar. */}
      <main className={`flex-1 px-4 pt-24 pb-12 sm:px-6 lg:px-8 ${
        isRtl ? 'lg:pr-[272px]' : 'lg:pl-[272px]'
      }`}>
        <Suspense fallback={<div className="py-24 text-center text-sm text-neutral-400">Chargement…</div>}>
          {renderTabContent()}
        </Suspense>
      </main>
    </div>
  );
}
