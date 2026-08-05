import { useEffect, useMemo, useState } from 'react';
import { ClientDetail } from './components/ClientDetail';
import { ClientTable, type SortKey } from './components/ClientTable';
import { Filters } from './components/Filters';
import { StatsBar } from './components/StatsBar';
import { TopBar } from './components/TopBar';
import { sampleClients } from './data/sampleData';
import { fetchClientsFromSheet, isSheetConfigured } from './lib/sheets';
import { isWriteConfigured, writeClientUpdates } from './lib/sheetsWrite';
import { parseLooseDate } from './lib/parse';
import type { Client, ClientUpdates, SourceMode } from './types';

export default function App() {
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

  async function load() {
    if (!isSheetConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const fromSheet = await fetchClientsFromSheet();
      if (fromSheet.length) {
        setClients(fromSheet);
        setSource('sheet');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue lors de la lecture du Sheet.');
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

  const canEdit = isWriteConfigured && source === 'sheet';

  async function handleSaveClient(client: Client, updates: ClientUpdates) {
    await writeClientUpdates(client, updates);
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ...updates } : c)));
    setSelected((prev) => (prev && prev.id === client.id ? { ...prev, ...updates } : prev));
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
      {!isSheetConfigured && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          <svg className="h-3.5 w-3.5 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          Aucun Google Sheet connecté — affichage des données de démonstration. Renseignez{' '}
          <code className="rounded bg-amber-100 px-1 font-mono">VITE_GOOGLE_SHEET_ID</code> dans <code className="rounded bg-amber-100 px-1 font-mono">.env.local</code>{' '}
          pour lire vos vraies données (voir README.md).
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</div>
      )}

      <div className="mb-4">
        <TopBar query={query} onQueryChange={setQuery} source={source} loading={loading} onRefresh={load} />
      </div>

      <div className="mb-4">
        <StatsBar clients={clients} activeStatut={statut} onSelectStatut={setStatut} />
      </div>

      <div className="mb-3.5">
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

      <ClientTable clients={filtered} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onSelect={setSelected} />

      <ClientDetail client={selected} onClose={() => setSelected(null)} canEdit={canEdit} onSave={handleSaveClient} />
    </div>
  );
}
