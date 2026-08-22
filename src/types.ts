/**
 * Types definition for Maison Zeyna App
 */

export type Language = 'fr' | 'ar';

export type DressCategory = 'caftan' | 'karakou' | 'chaouia' | 'kabyle' | 'badroune' | 'soiree' | 'autre';
export type DressStatus = 'disponible' | 'reservee' | 'en_location' | 'en_entretien';
export type ItemType = 'robe' | 'bijou';

export interface Dress {
  id: string;
  nom: string;
  categorie: DressCategory;
  couleur: string;
  taille: string;
  prix_location_da: number;
  caution_da: number;
  description: string;
  photo_principale: string;
  photos: string[];
  statut: DressStatus;
  date_creation: string;
}

export interface Bijou {
  id: string;
  nom: string;
  categorie: string;
  prix_location_da: number;
  description: string;
  photo: string;
  photos?: string[];
  statut: 'disponible' | 'reserve' | 'en_location' | 'en_entretien';
  date_creation: string;
}

export interface Cliente {
  id: string;
  nom_complet: string;
  telephone: string;
  adresse?: string;
  notes?: string;
  date_creation: string;
}

export type ReservationStatus = 'future' | 'en_cours' | 'retourne' | 'en_retard';

export interface ReservationItem {
  id: string;
  reservation_id: string;
  type_article: ItemType;
  article_id: string;
  prix_da: number;
  nom_article: string;
}

export interface Reservation {
  id: string;
  cliente_id: string;
  date_sortie: string;
  date_retour: string;
  montant_total_da: number;
  caution_da: number;
  montant_paye_da: number;
  // The deposit taken when the booking was first made, kept separate from any
  // amount added afterward (a correction, the balance) — cancelling a booking
  // refunds only what came after this, never this initial deposit itself.
  acompte_initial_da?: number;
  reste_a_payer_da: number;
  statut: ReservationStatus;
  notes?: string;
  date_creation: string;
  items: ReservationItem[];
}

export type TransactionType = 'entree' | 'depense' | 'vidage_caisse';

export interface Transaction {
  id: string;
  type: TransactionType;
  montant_da: number;
  description: string;
  categorie: string;
  date: string;
  heure: string;
  utilisateur: string;
  note?: string;
  beneficiaire?: string;
  source_argent?: 'caisse' | 'tresorerie';
}

export interface HistoriqueAction {
  id: string;
  action: string;
  utilisateur: string;
  date: string;
  heure: string;
  details: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
}

export interface StoreProfile {
  nom: string;
  telephone: string;
  adresse: string;
  instagram: string;
  facebook: string;
}
