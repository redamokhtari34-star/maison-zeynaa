import type { Client, ClientUpdates, NewClientInput } from '../types';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export const isWriteConfigured = isSupabaseConfigured;

const CAMEL_TO_SNAKE: Record<string, string> = {
  dateDemande: 'date_demande',
  nomEntreprise: 'nom_entreprise',
  telephone: 'telephone',
  secteur: 'secteur',
  reseauxSouhaites: 'reseaux_souhaites',
  liens: 'liens',
  compteDemarche: 'compte_demarche',
  statutSite: 'statut_site',
  derniereMiseAJour: 'derniere_mise_a_jour',
  dateMiseEnLigne: 'date_mise_en_ligne',
  notes: 'notes',
  statutModification: 'statut_modification',
  noteModification: 'note_modification',
  dateModification: 'date_modification',
};

function toRow(fields: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    const col = CAMEL_TO_SNAKE[key];
    if (col && value !== undefined) row[col] = value;
  }
  return row;
}

export async function writeClientUpdates(client: Client, updates: ClientUpdates): Promise<void> {
  const { error } = await supabase.from('hostivo_clients').update(toRow(updates as Record<string, unknown>)).eq('id', client.id);
  if (error) throw new Error(error.message);
}

/** Ajoute une nouvelle ligne cliente et renvoie son identifiant. */
export async function createClient(input: NewClientInput): Promise<{ id: string; numero?: number }> {
  const { data, error } = await supabase
    .from('hostivo_clients')
    .insert(toRow(input as unknown as Record<string, unknown>))
    .select('id, numero')
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, numero: (data.numero as number | null) ?? undefined };
}
