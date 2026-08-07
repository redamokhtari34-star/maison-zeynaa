/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Dress, Bijou, Cliente, Reservation, Transaction, HistoriqueAction, SupabaseConfig, StoreProfile, NotebookSheet } from '../types';
import { sampleDresses, sampleBijoux, sampleClientes, sampleReservations, sampleTransactions, sampleHistory, defaultStoreProfile } from '../data/sampleData';

// LocalStorage keys — the device-side mirror of the shop's records
const KEYS = {
  DRESSES: 'zeyna_dresses_v1',
  BIJOUX: 'zeyna_bijoux_v1',
  CLIENTES: 'zeyna_clientes_v1',
  RESERVATIONS: 'zeyna_reservations_v1',
  TRANSACTIONS: 'zeyna_transactions_v1',
  HISTORY: 'zeyna_history_v1',
  SUPABASE_CONFIG: 'zeyna_supabase_config_v1',
  STORE_PROFILE: 'zeyna_store_profile_v1',
  NOTEBOOK: 'zeyna_notebook_v1'
};

// Records are mirrored to the device so that anything entered while the
// network is down survives a reload instead of living only in this tab.
function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Could not read ${key} from storage:`, err);
  }
  return fallback;
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Could not persist ${key}:`, err);
  }
}

// Global state store, hydrated from the device. Everything starts empty and is
// filled by the first sync, then kept locally so the shop can work offline.
// Seeding demonstration dresses here made the catalogue jump from 78 to 70 the
// moment the real data arrived.
const memoryState = {
  dresses: loadLocal<Dress[]>(KEYS.DRESSES, []),
  bijoux: loadLocal<Bijou[]>(KEYS.BIJOUX, []),
  clientes: loadLocal<Cliente[]>(KEYS.CLIENTES, []),
  reservations: loadLocal<Reservation[]>(KEYS.RESERVATIONS, []),
  transactions: loadLocal<Transaction[]>(KEYS.TRANSACTIONS, []),
  history: loadLocal<HistoriqueAction[]>(KEYS.HISTORY, []),
  profile: defaultStoreProfile as StoreProfile
};

// Global Supabase client instance (lazy initialized)
let supabaseClient: SupabaseClient | null = null;

// Retrieve Supabase config
// Project defaults, used when no environment variables are supplied. The
// publishable key is meant to be shipped to the browser — the database is
// protected by row-level security, not by hiding this string — but keeping the
// values in .env lets the app be pointed at another project without a rebuild
// of the source.
const DEFAULT_SUPABASE_URL = 'https://ldmwnqbuwryqnoftbxfh.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_QHiv-07EQfrcarnHJQpb1g_Mt7rbRpe';

/** Strips the stray quotes, spaces and /rest/v1 suffixes that break the client. */
function cleanSetting(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '')
    : '';
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = cleanSetting((import.meta as any).env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
  const anonKey = cleanSetting((import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_KEY;
  return { url, anonKey, isConnected: Boolean(url && anonKey) };
}

// Save Supabase config and initialize client
export function saveSupabaseConfig(config: SupabaseConfig): boolean {
  if (config.url && config.anonKey) {
    try {
      let cleanUrl = config.url;
      if (cleanUrl.includes('/rest/v1/')) {
        cleanUrl = cleanUrl.replace('/rest/v1/', '');
      }
      if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      supabaseClient = createClient(cleanUrl, config.anonKey);
      config.isConnected = true;
      return true;
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      config.isConnected = false;
      return false;
    }
  } else {
    supabaseClient = null;
    config.isConnected = false;
    return false;
  }
}

// Get initialized Supabase client
export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseClient) {
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    const config = getSupabaseConfig();
    const url = envUrl || config.url;
    const anonKey = envKey || config.anonKey;

    if (url && anonKey) {
      try {
        let cleanUrl = url;
        if (cleanUrl.includes('/rest/v1/')) {
          cleanUrl = cleanUrl.replace('/rest/v1/', '');
        }
        if (cleanUrl.endsWith('/')) {
          cleanUrl = cleanUrl.slice(0, -1);
        }
        supabaseClient = createClient(cleanUrl, anonKey);
      } catch (e) {
        console.error('Failed to init Supabase client:', e);
        supabaseClient = null;
      }
    }
  }
  return supabaseClient;
}

// Synchronize dates and statuses on reservations & items
function autoUpdateStatuses(
  reservations: Reservation[],
  dresses: Dress[],
  bijoux: Bijou[]
): { reservations: Reservation[]; dresses: Dress[]; bijoux: Bijou[] } {
  const todayStr = todayIso();

  // Create lookup maps or deep copies
  const updatedReservations = reservations.map(r => {
    let newStatut = r.statut;
    if (r.statut !== 'retourne') {
      if (r.date_retour < todayStr) {
        newStatut = 'en_retard';
      } else if (r.date_sortie <= todayStr && r.date_retour >= todayStr) {
        newStatut = 'en_cours';
      } else if (r.date_sortie > todayStr) {
        newStatut = 'future';
      }
    }
    return { ...r, statut: newStatut };
  });

  // Automatically update Dress availability based on active reservations
  const updatedDresses = dresses.map(d => {
    // Find if there is an active rental today
    const activeRes = updatedReservations.find(r => 
      (r.statut === 'en_cours' || r.statut === 'en_retard') &&
      r.items.some(item => item.type_article === 'robe' && item.article_id === d.id)
    );

    let newStatus = d.statut;
    if (activeRes) {
      newStatus = activeRes.statut === 'en_retard' ? 'en_location' : 'en_location'; 
    } else {
      // Find if there is a future reservation
      const futureRes = updatedReservations.find(r => 
        r.statut === 'future' &&
        r.items.some(item => item.type_article === 'robe' && item.article_id === d.id)
      );
      if (futureRes) {
        newStatus = 'reservee';
      } else if (d.statut !== 'en_entretien') {
        newStatus = 'disponible';
      }
    }
    return { ...d, statut: newStatus };
  });

  // Automatically update Jewelry availability
  const updatedBijoux = bijoux.map(b => {
    const activeRes = updatedReservations.find(r => 
      (r.statut === 'en_cours' || r.statut === 'en_retard') &&
      r.items.some(item => item.type_article === 'bijou' && item.article_id === b.id)
    );

    let newStatus = b.statut;
    if (activeRes) {
      newStatus = 'en_location';
    } else {
      const futureRes = updatedReservations.find(r => 
        r.statut === 'future' &&
        r.items.some(item => item.type_article === 'bijou' && item.article_id === b.id)
      );
      if (futureRes) {
        newStatus = 'reserve';
      } else if (b.statut !== 'en_entretien') {
        newStatus = 'disponible';
      }
    }
    return { ...b, statut: newStatus };
  });

  return { reservations: updatedReservations, dresses: updatedDresses, bijoux: updatedBijoux };
}

import { DressCategory, DressStatus, ReservationStatus, ReservationItem, TransactionType } from '../types';
import { todayIso, toIso } from './dates';
import { notifyError } from './toast';

// Helper to check if string is a valid UUID
export function isUuid(val: any): boolean {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

// Database column mappers
export function mapClientFromDb(row: any): Cliente {
  return {
    id: String(row.id),
    nom_complet: [row.prenom, row.nom].filter(Boolean).join(' ') || row.nom || row.prenom || 'Sans nom',
    telephone: row.telephone || '',
    adresse: row.adresse || '',
    notes: '',
    date_creation: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  };
}

export function mapClientToDb(client: Cliente) {
  const parts = (client.nom_complet || '').trim().split(' ');
  const prenom = parts[0] || '';
  const nom = parts.length > 1 ? parts.slice(1).join(' ') : prenom;
  const row: any = {
    nom,
    prenom,
    telephone: client.telephone || '',
    adresse: client.adresse || ''
  };
  if (isUuid(client.id)) {
    row.id = client.id;
  }
  return row;
}

export function mapDressFromDb(row: any): Dress {
  return {
    id: String(row.id),
    nom: row.nom || '',
    categorie: (row.categorie || 'autre') as DressCategory,
    couleur: row.couleur || '',
    taille: row.taille || '',
    prix_location_da: Number(row.prix_location || 0),
    caution_da: Number(row.caution || 0),
    description: '',
    photo_principale: row.photo_url || '',
    photos: row.photo_url ? [row.photo_url] : [],
    statut: (row.statut || 'disponible') as DressStatus,
    date_creation: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  };
}

export function mapDressToDb(dress: Dress) {
  let photoUrl = dress.photo_principale || '';
  if (photoUrl.startsWith('blob:')) {
    photoUrl = '';
  }
  const row: any = {
    nom: dress.nom,
    categorie: dress.categorie,
    taille: dress.taille,
    couleur: dress.couleur,
    prix_location: dress.prix_location_da,
    caution: dress.caution_da,
    statut: dress.statut,
    photo_url: photoUrl
  };
  if (isUuid(dress.id)) {
    row.id = dress.id;
  }
  return row;
}

export function mapBijouFromDb(row: any): Bijou {
  let photosArr: string[] = [];
  if (Array.isArray(row.photos)) {
    photosArr = row.photos;
  } else if (typeof row.photos === 'string') {
    try {
      const parsed = JSON.parse(row.photos);
      if (Array.isArray(parsed)) photosArr = parsed;
    } catch {
      // Ignore parse error
    }
  }

  const primaryPhoto = row.photo_url || (photosArr.length > 0 ? photosArr[0] : '');
  if (photosArr.length === 0 && primaryPhoto) {
    photosArr = [primaryPhoto];
  }

  return {
    id: String(row.id),
    nom: row.nom || '',
    categorie: row.type || 'autre',
    prix_location_da: Number(row.prix_location || 0),
    description: '',
    photo: primaryPhoto,
    photos: photosArr,
    statut: (row.statut || 'disponible') as any,
    date_creation: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  };
}

export function mapBijouToDb(bijou: Bijou) {
  let photoUrl = bijou.photo || (bijou.photos && bijou.photos[0]) || '';
  if (photoUrl.startsWith('blob:')) {
    photoUrl = '';
  }
  const cleanPhotos = (bijou.photos || (photoUrl ? [photoUrl] : [])).filter(p => p && !p.startsWith('blob:'));

  const row: any = {
    nom: bijou.nom,
    type: bijou.categorie,
    prix_location: bijou.prix_location_da,
    caution: 0,
    statut: bijou.statut,
    photo_url: photoUrl
  };

  if (cleanPhotos.length > 0) {
    row.photos = cleanPhotos;
  }

  if (isUuid(bijou.id)) {
    row.id = bijou.id;
  }
  return row;
}

// Upload image file/blob directly to Supabase Storage bucket
export async function uploadImageToSupabase(file: File | Blob, bucketName: string = 'robes'): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Client Supabase non configuré.');
  }

  let fileExt = 'jpg';
  if ('name' in file && typeof file.name === 'string' && file.name.includes('.')) {
    fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  } else if (file.type && file.type.includes('/')) {
    fileExt = file.type.split('/')[1]?.toLowerCase() || 'jpg';
  }
  const cleanExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(fileExt) ? fileExt : 'jpg';
  const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${cleanExt}`;
  const filePath = fileName;

  let { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || `image/${cleanExt}`
    });

  // Attempt creating bucket if missing
  if (error && (error.message?.toLowerCase().includes('bucket not found') || (error as any).statusCode === '404' || (error as any).status === 404)) {
    try {
      await supabase.storage.createBucket(bucketName, { public: true });
      const retry = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || `image/${cleanExt}`
        });
      data = retry.data;
      error = retry.error;
    } catch (e) {
      console.warn('Bucket creation attempt warning:', e);
    }
  }

  if (error) {
    console.error(`Erreur upload Supabase storage (${bucketName}):`, error);
    throw new Error(`Échec de l'envoi de l'image sur Supabase Storage: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData?.publicUrl;

  if (!publicUrl || publicUrl.startsWith('blob:')) {
    throw new Error("L'URL publique générée par Supabase est invalide.");
  }

  return publicUrl;
}

// Ensure an image URL is a valid public URL and not a blob: URL
export async function ensurePublicUrl(url: string, bucketName: string = 'robes'): Promise<string> {
  if (!url) return '';
  if (url.startsWith('blob:')) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return await uploadImageToSupabase(blob, bucketName);
    } catch (e) {
      console.error('Erreur conversion URL blob:', e);
      return '';
    }
  }
  return url;
}

// robeRows/bijouRows are this reservation's rows from reservation_robes /
// reservation_bijoux — every article booked, with the price actually
// charged. Names come from the current catalogue, since neither join table
// stores one; a robe_id/bijou_id no longer in the catalogue (or a booking
// made before these tables existed, which only ever held one of each) falls
// back to the legacy single columns on the reservation row itself, so older
// data still shows something better than a bare "Robe".
export function mapReservationFromDb(row: any, robeRows: any[] = [], bijouRows: any[] = []): Reservation {
  const items: ReservationItem[] = [];

  if (robeRows.length) {
    for (const r of robeRows) {
      const dress = memoryState.dresses.find(d => d.id === String(r.robe_id));
      items.push({
        id: String(r.id),
        reservation_id: String(row.id),
        type_article: 'robe',
        article_id: String(r.robe_id),
        prix_da: Number(r.prix || 0),
        nom_article: dress?.nom || 'Robe'
      });
    }
  } else if (row.robe_id) {
    const dress = memoryState.dresses.find(d => d.id === String(row.robe_id));
    items.push({
      id: `item-${row.id}-robe`,
      reservation_id: String(row.id),
      type_article: 'robe',
      article_id: String(row.robe_id),
      prix_da: Number(row.prix_total || 0),
      nom_article: dress?.nom || 'Robe'
    });
  }

  if (bijouRows.length) {
    for (const r of bijouRows) {
      const bijou = memoryState.bijoux.find(b => b.id === String(r.bijou_id));
      items.push({
        id: String(r.id),
        reservation_id: String(row.id),
        type_article: 'bijou',
        article_id: String(r.bijou_id),
        prix_da: Number(r.prix || 0),
        nom_article: bijou?.nom || 'Bijou'
      });
    }
  } else if (row.bijou_id) {
    const bijou = memoryState.bijoux.find(b => b.id === String(row.bijou_id));
    items.push({
      id: `item-${row.id}-bijou`,
      reservation_id: String(row.id),
      type_article: 'bijou',
      article_id: String(row.bijou_id),
      prix_da: 0,
      nom_article: bijou?.nom || 'Bijou'
    });
  }

  return {
    id: String(row.id),
    cliente_id: String(row.client_id || row.nom_cliente || row.client_nom || (row.client ? `${row.client.prenom || ''} ${row.client.nom || ''}`.trim() : '') || ''),
    date_sortie: row.date_debut || '',
    date_retour: row.date_fin || '',
    montant_total_da: Number(row.prix_total || 0),
    caution_da: Number(row.caution_totale || 0),
    montant_paye_da: Number(row.acompte || 0),
    reste_a_payer_da: Number(row.reste_a_payer || 0),
    statut: (row.statut_reservation || 'future') as ReservationStatus,
    notes: row.notes || '',
    date_creation: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    items: items
  };
}

export function mapReservationToDb(res: Reservation) {
  const robeItem = res.items.find(i => i.type_article === 'robe');
  const bijouItem = res.items.find(i => i.type_article === 'bijou');
  const row: any = {
    client_id: isUuid(res.cliente_id) ? res.cliente_id : null,
    robe_id: robeItem && isUuid(robeItem.article_id) ? robeItem.article_id : null,
    bijou_id: bijouItem && isUuid(bijouItem.article_id) ? bijouItem.article_id : null,
    date_debut: res.date_sortie || null,
    date_fin: res.date_retour || null,
    statut_reservation: res.statut || 'future',
    prix_total: Number(res.montant_total_da) || 0,
    acompte: Number(res.montant_paye_da) || 0,
    reste_a_payer: Number(res.reste_a_payer_da) || 0
  };
  if (isUuid(res.id)) {
    row.id = res.id;
  }
  return row;
}

export function mapTransactionFromDb(row: any): Transaction {
  let type: TransactionType = 'entree';
  if (row.type === 'sortie') type = 'depense';
  else if (row.type === 'vidage') type = 'vidage_caisse';

  return {
    id: String(row.id),
    type: type,
    montant_da: Number(row.montant || 0),
    description: row.motif || '',
    categorie: type === 'vidage_caisse' ? 'Vidage de caisse' : (type === 'depense' ? 'Dépense' : 'Réservation'),
    date: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    heure: row.created_at ? new Date(row.created_at).toTimeString().split(' ')[0].substring(0, 5) : '12:00',
    utilisateur: 'Zeyna',
    note: '',
    beneficiaire: row.beneficiaire || undefined,
    source_argent: row.source || 'caisse'
  };
}

export function mapTransactionToDb(tr: Transaction) {
  let type = 'entree';
  if (tr.type === 'depense') type = 'sortie';
  else if (tr.type === 'vidage_caisse') type = 'vidage';

  const row: any = {
    type: type,
    montant: Number(tr.montant_da) || 0,
    source: tr.source_argent || 'caisse',
    beneficiaire: tr.beneficiaire || null,
    motif: tr.description || ''
  };
  if (isUuid(tr.id)) {
    row.id = tr.id;
  }
  return row;
}

// Reusable table synchronization helper
export async function syncTableToSupabase<TLocal, TDb>(
  tableName: string,
  localItems: TLocal[],
  mapToDb: (item: TLocal) => TDb,
  getId: (item: TLocal) => string
) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    // 1. Get current list of IDs in DB to handle deletions
    const { data: dbItems, error: fetchError } = await supabase.from(tableName).select('id');
    if (fetchError) {
      console.error(`Failed to fetch IDs from ${tableName} for sync:`, fetchError);
      notifyError(`Erreur Supabase (${tableName} Sync): ${fetchError.message}`);
      return;
    }

    const localIds = new Set(localItems.map(getId));
    const dbIds = (dbItems || []).map(row => row.id);
    const idsToDelete = dbIds.filter(id => !localIds.has(id));

    // 2. Perform deletions
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from(tableName).delete().in('id', idsToDelete);
      if (deleteError) {
        console.error(`Failed to delete removed rows from ${tableName}:`, deleteError);
        notifyError(`Erreur Supabase (${tableName} Delete): ${deleteError.message}`);
      }
    }

    // 3. Upsert current local state to Supabase
    if (localItems.length > 0) {
      const dbRows = localItems.map(mapToDb);
      const { error: upsertError } = await supabase.from(tableName).upsert(dbRows as any);
      if (upsertError) {
        console.error(`Failed to upsert to ${tableName}:`, upsertError);
        notifyError(`Erreur Supabase (${tableName} Upsert): ${upsertError.message}`);
      }
    }
  } catch (err: any) {
    console.error(`Error in syncTableToSupabase for ${tableName}:`, err);
    notifyError(`Erreur de connexion Supabase (${tableName}): ${err?.message || err}`);
  }
}

// Update safe/vault balance in tresorerie table
export async function updateTresorerieInDb() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { data: movements, error } = await supabase.from('mouvements_caisse').select('*');
    if (error) {
      console.error('Failed to fetch movements for tresorerie update:', error);
      return;
    }

    let solde = 0;
    for (const mov of movements || []) {
      if (mov.type === 'vidage') {
        solde += Number(mov.montant || 0);
      } else if (mov.type === 'sortie' && mov.source === 'tresorerie') {
        solde -= Number(mov.montant || 0);
      }
    }

    // Try selecting first to avoid upsert issues with unique keys/primary keys
    const { data: existing, error: selectErr } = await supabase.from('tresorerie').select('*');
    if (selectErr) {
      console.error('Failed to select from tresorerie table:', selectErr.message, selectErr.details, selectErr.hint);
      // Fallback: try direct upsert if select failed (maybe table has no select policy but has insert/update?)
      const { error: upsertErr } = await supabase.from('tresorerie').upsert({
        id: 1,
        solde_actuel: solde,
        updated_at: new Date().toISOString()
      });
      if (upsertErr) {
        console.error('Failed to upsert tresorerie row on fallback:', upsertErr.message, upsertErr.details, upsertErr.hint);
      }
      return;
    }

    if (existing && existing.length > 0) {
      // Update existing row
      const targetId = existing[0].id;
      const { error: updateErr } = await supabase.from('tresorerie').update({
        solde_actuel: solde,
        updated_at: new Date().toISOString()
      }).eq('id', targetId);

      if (updateErr) {
        console.error('Failed to update tresorerie row:', updateErr.message, updateErr.details, updateErr.hint);
      }
    } else {
      // Try inserting with id: 1
      const { error: insertErr } = await supabase.from('tresorerie').insert({
        id: 1,
        solde_actuel: solde,
        updated_at: new Date().toISOString()
      });

      if (insertErr) {
        console.warn('Failed to insert tresorerie row with id: 1, trying without explicit id:', insertErr.message);
        const { error: insertNoIdErr } = await supabase.from('tresorerie').insert({
          solde_actuel: solde,
          updated_at: new Date().toISOString()
        });
        if (insertNoIdErr) {
          console.error('Failed to insert tresorerie row without id:', insertNoIdErr.message, insertNoIdErr.details, insertNoIdErr.hint);
        }
      }
    }
  } catch (err) {
    console.error('Error in updateTresorerieInDb:', err);
  }
}

// Seeding DB with sample data - resets caisse, transactions, reservations and history while keeping catalog
export async function seedSupabaseWithSampleData(supabase: SupabaseClient) {
  try {
    await cleanFinancialsAndReservationsForProduction();
  } catch (err) {
    console.error('Error seeding Supabase default data:', err);
  }
}

// Clean production financial and reservation data while strictly keeping dress & bijou catalogs intact
export async function cleanFinancialsAndReservationsForProduction() {
  const dressesToKeep = memoryState.dresses.length > 0 ? memoryState.dresses : sampleDresses;
  const bijouxToKeep = memoryState.bijoux.length > 0 ? memoryState.bijoux : sampleBijoux;

  memoryState.dresses = dressesToKeep.map(d => ({ ...d, statut: 'disponible' as const }));
  memoryState.bijoux = bijouxToKeep.map(b => ({ ...b, statut: 'disponible' as const }));
  memoryState.clientes = [];
  memoryState.reservations = [];
  memoryState.transactions = [];
  memoryState.history = [];

  persist(KEYS.DRESSES, memoryState.dresses);
  persist(KEYS.BIJOUX, memoryState.bijoux);
  persist(KEYS.CLIENTES, []);
  persist(KEYS.RESERVATIONS, []);
  persist(KEYS.TRANSACTIONS, []);
  persist(KEYS.HISTORY, []);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // 1. Delete all test reservations
      const { error: resErr } = await supabase.from('reservations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (resErr) console.warn('Supabase reservations clear warning:', resErr.message);

      // 2. Delete all cash movements
      const { error: trErr } = await supabase.from('mouvements_caisse').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (trErr) console.warn('Supabase mouvements_caisse clear warning:', trErr.message);

      // 2b. Clients and the activity log are cleared locally too, so they must
      // go in the cloud as well — otherwise the next sync would bring back the
      // records the shop just asked to erase.
      const { error: cliErr } = await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (cliErr) console.warn('Supabase clients clear warning:', cliErr.message);

      const { error: histErr } = await supabase.from('historique_actions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (histErr) console.warn('Supabase historique_actions clear warning:', histErr.message);

      // 3. Reset tresorerie / safe balance
      await updateTresorerieInDb();

      // 4. Reset all dress statuses to 'disponible'
      const { error: dressErr } = await supabase.from('robes').update({ statut: 'disponible' }).neq('id', '00000000-0000-0000-0000-000000000000');
      if (dressErr) console.warn('Supabase robes status reset warning:', dressErr.message);

      // 5. Reset all bijou statuses to 'disponible'
      const { error: bijouErr } = await supabase.from('bijoux').update({ statut: 'disponible' }).neq('id', '00000000-0000-0000-0000-000000000000');
      if (bijouErr) console.warn('Supabase bijoux status reset warning:', bijouErr.message);

      // 6. Ensure default dress catalog exists if robes table is empty
      const { count: dressCount } = await supabase.from('robes').select('*', { count: 'exact', head: true });
      if (!dressCount || dressCount === 0) {
        const defaultDresses = sampleDresses.map(mapDressToDb);
        if (defaultDresses.length > 0) {
          await supabase.from('robes').upsert(defaultDresses as any);
        }
      }

      // 7. Ensure default bijou catalog exists if bijoux table is empty
      const { count: bijouCount } = await supabase.from('bijoux').select('*', { count: 'exact', head: true });
      if (!bijouCount || bijouCount === 0) {
        const defaultBijoux = sampleBijoux.map(mapBijouToDb);
        if (defaultBijoux.length > 0) {
          await supabase.from('bijoux').upsert(defaultBijoux as any);
        }
      }
    } catch (err) {
      console.error('Error cleaning production database in Supabase:', err);
    }
  }

  return getFullDatabaseState();
}

// Fetch entire database state from Supabase
export async function fetchFullDatabaseStateFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not configured.');
  }

  const [
    { data: dressesDb, error: dressesErr },
    { data: bijouxDb, error: bijouxErr },
    { data: clientsDb, error: clientsErr },
    { data: reservationsDb, error: reservationsErr },
    { data: reservationRobesDb, error: reservationRobesErr },
    { data: reservationBijouxDb, error: reservationBijouxErr },
    { data: transactionsDb, error: transactionsErr },
    { data: historyDb, error: historyErr }
  ] = await Promise.all([
    supabase.from('robes').select('*'),
    supabase.from('bijoux').select('*'),
    supabase.from('clients').select('*'),
    supabase.from('reservations').select('*'),
    supabase.from('reservation_robes').select('*'),
    supabase.from('reservation_bijoux').select('*'),
    supabase.from('mouvements_caisse').select('*'),
    supabase.from('historique_actions').select('*').order('created_at', { ascending: false }).limit(300)
  ]);

  if (dressesErr) {
    console.error('Error loading robes from Supabase:', dressesErr);
  }
  if (bijouxErr) {
    console.error('Error loading bijoux from Supabase:', bijouxErr);
  }
  if (clientsErr) {
    console.error('Error loading clients from Supabase:', clientsErr);
  }
  if (reservationsErr) {
    console.error('Error loading reservations from Supabase:', reservationsErr);
  }
  if (reservationRobesErr) {
    console.error('Error loading reservation_robes from Supabase:', reservationRobesErr);
  }
  if (reservationBijouxErr) {
    console.error('Error loading reservation_bijoux from Supabase:', reservationBijouxErr);
  }
  if (transactionsErr) {
    console.error('Error loading mouvements_caisse from Supabase:', transactionsErr);
  }
  if (historyErr) {
    console.error('Error loading historique_actions from Supabase:', historyErr);
  }

  // Adopt the cloud copy only when it actually carries something.
  //
  // A failed request yields null, and a table that is empty (or unreadable
  // because of row-level security) yields zero rows. Writing either straight
  // into memory wiped the catalogue and every record created on this device —
  // the shop watched its dresses vanish seconds after adding them. An empty
  // remote result is therefore never allowed to erase a non-empty local list;
  // real deletions still propagate, since they come back as fewer rows rather
  // than as none at all.
  const adopt = <TRow, TLocal>(
    rows: TRow[] | null,
    map: (row: TRow) => TLocal,
    current: TLocal[]
  ): TLocal[] => {
    if (!rows) return current;              // request failed
    if (rows.length === 0 && current.length > 0) return current;
    return rows.map(map);
  };

  // Dresses and bijoux land first, so mapReservationFromDb below resolves
  // each booked article against the catalogue as it stands right now, not
  // the one from before this sync.
  memoryState.dresses = adopt(dressesDb, mapDressFromDb, memoryState.dresses);
  memoryState.bijoux = adopt(bijouxDb, mapBijouFromDb, memoryState.bijoux);
  memoryState.clientes = adopt(clientsDb, mapClientFromDb, memoryState.clientes);

  const robeRowsByReservation = new Map<string, any[]>();
  for (const r of reservationRobesDb || []) {
    const key = String(r.reservation_id);
    (robeRowsByReservation.get(key) || robeRowsByReservation.set(key, []).get(key)!).push(r);
  }
  const bijouRowsByReservation = new Map<string, any[]>();
  for (const r of reservationBijouxDb || []) {
    const key = String(r.reservation_id);
    (bijouRowsByReservation.get(key) || bijouRowsByReservation.set(key, []).get(key)!).push(r);
  }
  memoryState.reservations = adopt(
    reservationsDb,
    (row: any) => mapReservationFromDb(
      row,
      robeRowsByReservation.get(String(row.id)) || [],
      bijouRowsByReservation.get(String(row.id)) || []
    ),
    memoryState.reservations
  );

  memoryState.transactions = adopt(transactionsDb, mapTransactionFromDb, memoryState.transactions);
  memoryState.history = adopt(historyDb, mapHistoryFromDb, memoryState.history);

  persist(KEYS.DRESSES, memoryState.dresses);
  persist(KEYS.BIJOUX, memoryState.bijoux);
  persist(KEYS.CLIENTES, memoryState.clientes);
  persist(KEYS.RESERVATIONS, memoryState.reservations);
  persist(KEYS.TRANSACTIONS, memoryState.transactions);
  persist(KEYS.HISTORY, memoryState.history);

  return getFullDatabaseState();
}

// Core retrieval functions
export function getDresses(): Dress[] {
  return memoryState.dresses;
}

export function saveDresses(dresses: Dress[]) {
  memoryState.dresses = dresses;
  persist(KEYS.DRESSES, dresses);
  syncTableToSupabase('robes', dresses, mapDressToDb, d => d.id);
}

export function getBijoux(): Bijou[] {
  return memoryState.bijoux;
}

export function saveBijoux(bijoux: Bijou[]) {
  memoryState.bijoux = bijoux;
  persist(KEYS.BIJOUX, bijoux);
  syncTableToSupabase('bijoux', bijoux, mapBijouToDb, b => b.id);
}

export function getClientes(): Cliente[] {
  return memoryState.clientes;
}

export function saveClientes(clientes: Cliente[]) {
  memoryState.clientes = clientes;
  persist(KEYS.CLIENTES, clientes);
  syncTableToSupabase('clients', clientes, mapClientToDb, c => c.id);
}

export function getReservations(): Reservation[] {
  return memoryState.reservations;
}

export function saveReservations(reservations: Reservation[]) {
  memoryState.reservations = reservations;
  persist(KEYS.RESERVATIONS, reservations);
  syncTableToSupabase('reservations', reservations, mapReservationToDb, r => r.id);
}

export function getTransactions(): Transaction[] {
  return memoryState.transactions;
}

export function saveTransactions(transactions: Transaction[]) {
  memoryState.transactions = transactions;
  persist(KEYS.TRANSACTIONS, transactions);
  syncTableToSupabase('mouvements_caisse', transactions, mapTransactionToDb, t => t.id).then(() => {
    updateTresorerieInDb();
  });
}

export function getHistory(): HistoriqueAction[] {
  return memoryState.history;
}

// The activity log is written from deep inside the components, far from the
// React tree that displays it. Listeners let those screens refresh instead of
// showing a stale copy until the next page load.
type HistoryListener = () => void;
let historyListeners: HistoryListener[] = [];

export function subscribeToHistory(listener: HistoryListener): () => void {
  historyListeners.push(listener);
  return () => {
    historyListeners = historyListeners.filter(l => l !== listener);
  };
}

export function saveHistory(history: HistoriqueAction[]) {
  memoryState.history = history;
  persist(KEYS.HISTORY, history);
  historyListeners.forEach(l => l());
}

// The notebook is the one thing the shop authors by hand, so it is persisted
// to localStorage rather than living only in memory: a page reload must not
// throw away notes that were never part of the Supabase schema.
export function getNotebook(): NotebookSheet[] {
  try {
    const raw = localStorage.getItem(KEYS.NOTEBOOK);
    if (raw) return JSON.parse(raw) as NotebookSheet[];
  } catch (err) {
    console.warn('Could not read notebook from storage:', err);
  }
  return [
    {
      id: 'sheet-1',
      nom: 'Feuille 1',
      colonnes: ['Désignation', 'Quantité', 'Montant (DA)', 'Remarque'],
      lignes: Array.from({ length: 6 }, () => ['', '', '', ''])
    }
  ];
}

export function saveNotebook(sheets: NotebookSheet[]) {
  try {
    localStorage.setItem(KEYS.NOTEBOOK, JSON.stringify(sheets));
  } catch (err) {
    console.warn('Could not save notebook:', err);
  }
}

export function getStoreProfile(): StoreProfile {
  return memoryState.profile;
}

export function saveStoreProfile(profile: StoreProfile) {
  memoryState.profile = profile;
}

// Consolidated dynamic database state fetcher
export function getFullDatabaseState() {
  const rawDresses = memoryState.dresses;
  const rawBijoux = memoryState.bijoux;
  const rawClientes = memoryState.clientes;
  const rawReservations = memoryState.reservations;
  const rawTransactions = memoryState.transactions;
  const rawHistory = memoryState.history;
  const rawProfile = memoryState.profile;

  // Run auto state updates
  const updated = autoUpdateStatuses(rawReservations, rawDresses, rawBijoux);

  memoryState.reservations = updated.reservations;
  memoryState.dresses = updated.dresses;
  memoryState.bijoux = updated.bijoux;

  return {
    dresses: updated.dresses,
    bijoux: updated.bijoux,
    clientes: rawClientes,
    reservations: updated.reservations,
    transactions: rawTransactions,
    history: rawHistory,
    profile: rawProfile
  };
}

// Download the whole database as a timestamped JSON backup. Everything lives
// in the browser (and, when configured, Supabase), so this is the escape hatch
// that lets the shop keep a copy of its own records.
export function exportDatabaseToFile() {
  const state = getFullDatabaseState();
  const payload = {
    application: 'Maison Zeyna',
    exported_at: new Date().toISOString(),
    version: 1,
    ...state
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);

  const link = document.createElement('a');
  link.href = url;
  link.download = `maison-zeyna-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return payload;
}

// Log a business action
export function mapHistoryFromDb(row: any): HistoriqueAction {
  const at = row.created_at ? new Date(row.created_at) : new Date();
  return {
    id: String(row.id),
    action: row.action || '',
    utilisateur: row.utilisateur || 'Zeyna',
    date: toIso(at),
    heure: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
    details: row.details || ''
  };
}

// Set from the signed-in account, so the activity log can say who did what.
let currentUser = 'Zeyna';
export function setCurrentUser(name: string) {
  currentUser = name || 'Zeyna';
}
export function getCurrentUser() {
  return currentUser;
}

export function addHistoryEntry(action: string, details: string, user: string = currentUser) {
  const now = new Date();

  const entry: HistoriqueAction = {
    id: `h-${Date.now()}`,
    action,
    utilisateur: user,
    date: toIso(now),
    heure: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    details
  };

  saveHistory([entry, ...getHistory()]);

  // Mirror the entry so the log follows the shop from one device to another,
  // in the background: a slow network must never hold up the action that is
  // being recorded.
  const supabase = getSupabaseClient();
  if (supabase) {
    void supabase
      .from('historique_actions')
      .insert([{ action, details, utilisateur: user }])
      .then(({ error }) => {
        if (error) console.warn('Could not record history entry in Supabase:', error.message);
      });
  }
}

// Check overlapping rentals for specific dress or jewelry
export function checkItemAvailability(
  itemType: 'robe' | 'bijou',
  itemId: string,
  startDate: string,
  endDate: string,
  excludeReservationId?: string
): { available: boolean; conflictingReservation?: Reservation } {
  const reservations = getReservations();

  for (const res of reservations) {
    if (res.id === excludeReservationId) continue;
    if (res.statut === 'retourne') continue; // Completed rentals don't block anymore

    // Check overlap
    // Period A overlaps with Period B if: StartA <= EndB AND EndA >= StartB
    const overlap = startDate <= res.date_retour && endDate >= res.date_sortie;

    if (overlap) {
      const containsItem = res.items.some(
        item => item.type_article === itemType && item.article_id === itemId
      );
      if (containsItem) {
        return { available: false, conflictingReservation: res };
      }
    }
  }

  return { available: true };
}

// Reset data to defaults while maintaining dresses and bijoux catalog intact and available
export function resetDatabaseToDefaults() {
  const dressesToKeep = memoryState.dresses.length > 0 ? memoryState.dresses : sampleDresses;
  const bijouxToKeep = memoryState.bijoux.length > 0 ? memoryState.bijoux : sampleBijoux;

  memoryState.dresses = dressesToKeep.map(d => ({ ...d, statut: 'disponible' as const }));
  memoryState.bijoux = bijouxToKeep.map(b => ({ ...b, statut: 'disponible' as const }));
  memoryState.clientes = [];
  memoryState.reservations = [];
  memoryState.transactions = [];
  memoryState.history = [];

  persist(KEYS.DRESSES, memoryState.dresses);
  persist(KEYS.BIJOUX, memoryState.bijoux);
  persist(KEYS.CLIENTES, []);
  persist(KEYS.RESERVATIONS, []);
  persist(KEYS.TRANSACTIONS, []);
  persist(KEYS.HISTORY, []);
  memoryState.profile = { ...defaultStoreProfile };
}
