import { useEffect, useMemo, useState } from 'react';
import { AddClientModal } from './components/AddClientModal';
import { ChangePasswordScreen } from './components/ChangePasswordScreen';
import { ClientDetail } from './components/ClientDetail';
import { ClientTable, type SortKey } from './components/ClientTable';
import { Filters } from './components/Filters';
import { LoginScreen } from './components/LoginScreen';
import { StatsBar } from './components/StatsBar';
import { TopBar } from './components/TopBar';
import { sampleClients } from './data/sampleData';
import * as auth from './lib/auth';
import { fetchClients, isSupabaseConfigured } from './lib/clients';
import { createClient, isWriteConfigured, writeClientUpdates } from './lib/clientsWrite';
import { parseLooseDate } from './lib/parse';
import type { Client, ClientUpdates, NewClientInput, Session, SourceMode } from './types';

type AuthState = 'checking' | 'loggedOut' | 'mustChangePassword' | 'loggedIn' | 'changingPasswordVoluntary';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>(auth.isAuthConfigured ? 'checking' : 'loggedIn');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!auth.isAuthConfigured) return;
    auth
      .restoreSession()
      .then((s) => {
        if (!s) {
          setAuthState('loggedOut');
          return;
        }
        setSession(s);
        setAuthState(s.mustChangePassword ? 'mustChangePassword' : 'loggedIn');
      })
      .catch(() => setAuthState('loggedOut'));
  }, []);

  async function handleLogin(username: string, password: string) {
    const s = await auth.login(username, password);
    setSession(s);
    setAuthState(s.mustChangePassword ? 'mustChangePassword' : 'loggedIn');
  }

  async function handleForcedChangePassword(currentPassword: string, newPassword: string) {
    if (!session) return;
    const s = await auth.changePassword(session, currentPassword, newPassword);
    setSession(s);
    setAuthState('loggedIn');
  }

  async function handleVoluntaryChangePassword(currentPassword: string, newPassword: string) {
    if (!session) return;
    const s = await auth.changePassword(session, currentPassword, newPassword);
    setSession(s);
    setAuthState('loggedIn');
  }

  function handleLogout() {
    auth.logout();
    setSession(null);
    setAuthState('loggedOut');
  }

  if (authState === 'checking') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-[13px] text-slate-400">Chargement…</div>;
  }
  if (authState === 'loggedOut') {
    return <LoginScreen onLogin={handleLogin} />;
  }
  if (authState === 'mustChangePassword' && session) {
    return <ChangePasswordScreen displayName={session.displayName} forced onSubmit={handleForcedChangePassword} />;
  }
  if (authState === 'changingPasswordVoluntary' && session) {
    return (
      <ChangePasswordScreen
        displayName={session.displayName}
        forced={false}
        onSubmit={handleVoluntaryChangePassword}
        onCancel={() => setAuthState('loggedIn')}
      />
    );
  }

  return (
    <CrmApp
      session={session}
      onChangePassword={() => setAuthState('changingPasswordVoluntary')}
      onLogout={handleLogout}
    />
  );
}

function CrmApp({
  session,
  onChangePassword,
  onLogout,
}: {
  session: Session | null;
  onChangePassword: () => void;
  onLogout: () => void;
}) {
  const [clients, setClients] = useState<Client[]>(sampleClients);
  const [source, setSource] = useState<SourceMode>('demo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [secteur, setSecteur] = useState('');
  const [statut, setStatut] = useState('');
  const [modification, setModification] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('numero');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<Client | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  async function load() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const fromSupabase = await fetchClients();
      if (fromSupabase.length) {
        setClients(fromSupabase);
        setSource('supabase');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const secteurs = useMemo(
    () => Array.from(new Set(clients.map((c) => c.secteur).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr')),
    [clients],
  );
  const statuts = useMemo(
    () => Array.from(new Set(clients.map((c) => c.statutSite).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr')),
    [clients],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => {
        if (secteur && c.secteur !== secteur) return false;
        if (statut && c.statutSite !== statut) return false;
        if (modification && c.statutModification !== modification) return false;
        if (q) {
          const haystack = `${c.nomEntreprise} ${c.secteur} ${c.telephone}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let av: string | number = '';
        let bv: string | number = '';
        if (sortKey === 'numero') {
          av = a.numero ?? Number.MAX_SAFE_INTEGER;
          bv = b.numero ?? Number.MAX_SAFE_INTEGER;
        } else if (sortKey === 'dateMiseEnLigne') {
          av = parseLooseDate(a.dateMiseEnLigne)?.getTime() ?? 0;
          bv = parseLooseDate(b.dateMiseEnLigne)?.getTime() ?? 0;
        } else {
          av = (a[sortKey] ?? '').toString().toLowerCase();
          bv = (b[sortKey] ?? '').toString().toLowerCase();
        }
        if (av < bv) return -1 * sortDir;
        if (av > bv) return 1 * sortDir;
        return 0;
      });
  }, [clients, query, secteur, statut, modification, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function resetFilters() {
    setQuery('');
    setSecteur('');
    setStatut('');
    setModification('');
  }

  const canEdit = isWriteConfigured && source === 'supabase';

  async function handleSaveClient(client: Client, updates: ClientUpdates) {
    await writeClientUpdates(client, updates);
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ...updates } : c)));
    setSelected((prev) => (prev && prev.id === client.id ? { ...prev, ...updates } : prev));
  }

  async function handleCreateClient(input: NewClientInput) {
    const { id, numero } = await createClient(input);
    const newClient: Client = {
      id,
      numero,
      dateDemande: input.dateDemande ?? '',
      nomEntreprise: input.nomEntreprise,
      telephone: input.telephone ?? '',
      secteur: input.secteur ?? '',
      reseauxSouhaites: input.reseauxSouhaites ?? [],
      liens: [],
      compteDemarche: input.compteDemarche,
      statutSite: input.statutSite ?? '',
      derniereMiseAJour: input.derniereMiseAJour,
      dateMiseEnLigne: input.dateMiseEnLigne,
      notes: input.notes,
      statutModification: input.statutModification,
      noteModification: input.noteModification,
      dateModification: input.dateModification,
    };
    setClients((prev) => [newClient, ...prev]);
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      {!isSupabaseConfigured && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          <svg className="h-3.5 w-3.5 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          Aucune base Supabase connectée — affichage des données de démonstration. Renseignez{' '}
          <code className="rounded bg-amber-100 px-1 font-mono">VITE_SUPABASE_URL</code> et{' '}
          <code className="rounded bg-amber-100 px-1 font-mono">VITE_SUPABASE_ANON_KEY</code> dans{' '}
          <code className="rounded bg-amber-100 px-1 font-mono">.env.local</code> pour lire vos vraies données (voir README.md).
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>
      )}

      <div className="mb-4">
        <TopBar
          query={query}
          onQueryChange={setQuery}
          source={source}
          loading={loading}
          onRefresh={load}
          session={session}
          onChangePassword={onChangePassword}
          onLogout={onLogout}
        />
      </div>

      <div className="mb-4">
        <StatsBar clients={clients} activeStatut={statut} onSelectStatut={setStatut} />
      </div>

      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Filters
            secteurs={secteurs}
            statuts={statuts}
            secteur={secteur}
            statut={statut}
            modification={modification}
            onSecteurChange={setSecteur}
            onStatutChange={setStatut}
            onModificationChange={setModification}
            onReset={resetFilters}
            count={filtered.length}
            total={clients.length}
          />
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex flex-none items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-black"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nouveau client
          </button>
        )}
      </div>

      <ClientTable clients={filtered} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onSelect={setSelected} />

      <ClientDetail client={selected} onClose={() => setSelected(null)} canEdit={canEdit} onSave={handleSaveClient} />
      <AddClientModal open={showAddModal} onClose={() => setShowAddModal(false)} onCreate={handleCreateClient} secteurs={secteurs} />
    </div>
  );
}
