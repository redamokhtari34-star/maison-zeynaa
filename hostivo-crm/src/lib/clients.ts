import type { Client } from '../types';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export { isSupabaseConfigured };

interface ClientRow {
  id: string;
  numero: number | null;
  date_demande: string;
  nom_entreprise: string;
  telephone: string;
  secteur: string;
  reseaux_souhaites: string[] | null;
  liens: string[] | null;
  compte_demarche: string | null;
  statut_site: string;
  derniere_mise_a_jour: string | null;
  date_mise_en_ligne: string | null;
  notes: string | null;
  statut_modification: string | null;
  note_modification: string | null;
  date_modification: string | null;
}

function rowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    numero: row.numero ?? undefined,
    dateDemande: row.date_demande,
    nomEntreprise: row.nom_entreprise,
    telephone: row.telephone,
    secteur: row.secteur,
    reseauxSouhaites: row.reseaux_souhaites ?? [],
    liens: row.liens ?? [],
    compteDemarche: row.compte_demarche ?? undefined,
    statutSite: row.statut_site,
    derniereMiseAJour: row.derniere_mise_a_jour ?? undefined,
    dateMiseEnLigne: row.date_mise_en_ligne ?? undefined,
    notes: row.notes ?? undefined,
    statutModification: row.statut_modification ?? undefined,
    noteModification: row.note_modification ?? undefined,
    dateModification: row.date_modification ?? undefined,
  };
}

export async function fetchClients(): Promise<Client[]> {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré.');
  const { data, error } = await supabase
    .from('hostivo_clients')
    .select('*')
    .order('numero', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data as ClientRow[]).map(rowToClient);
}
