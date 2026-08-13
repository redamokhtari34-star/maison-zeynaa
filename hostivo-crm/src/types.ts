export type StatutSite =
  | 'Mis en ligne'
  | 'En attente client'
  | 'Maquette envoyée'
  | 'Refus'
  | 'Site en cours'
  | (string & {});

export type StatutModification = 'Modification à faire' | 'Modification faite' | (string & {});

export interface Client {
  /** UUID de la ligne dans public.hostivo_clients (Supabase). */
  id: string;
  /** Numéro d'ordre affiché, hérité de l'ancien Sheet — informatif uniquement. */
  numero?: number;
  dateDemande: string;
  nomEntreprise: string;
  telephone: string;
  secteur: string;
  reseauxSouhaites: string[];
  liens: string[];
  compteDemarche?: string;
  statutSite: StatutSite;
  derniereMiseAJour?: string;
  dateMiseEnLigne?: string;
  notes?: string;
  statutModification?: StatutModification;
  noteModification?: string;
  dateModification?: string;
}

export type SourceMode = 'supabase' | 'demo';

/** Champs que l'app peut réécrire dans Supabase — voir lib/clientsWrite.ts. */
export interface ClientUpdates {
  dateDemande?: string;
  nomEntreprise?: string;
  telephone?: string;
  secteur?: string;
  reseauxSouhaites?: string[];
  liens?: string[];
  compteDemarche?: string;
  statutSite?: string;
  derniereMiseAJour?: string;
  dateMiseEnLigne?: string;
  notes?: string;
  statutModification?: string;
  noteModification?: string;
  dateModification?: string;
}

/** Champs saisis à la création d'un nouveau client — voir lib/clientsWrite.ts. */
export interface NewClientInput {
  nomEntreprise: string;
  dateDemande?: string;
  telephone?: string;
  secteur?: string;
  reseauxSouhaites?: string[];
  compteDemarche?: string;
  statutSite?: string;
  derniereMiseAJour?: string;
  dateMiseEnLigne?: string;
  notes?: string;
  statutModification?: string;
  noteModification?: string;
  dateModification?: string;
}

/** Session utilisateur — voir lib/auth.ts. */
export interface Session {
  userId: string;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
}

/** Paiement Stripe — voir supabase/migrations/20240813_create_stripe_payments_table.sql. */
export interface StripePayment {
  id: string;
  stripe_payment_intent_id: string;
  client_id?: string;
  customer_email: string;
  customer_name: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'requires_payment_method';
  failure_reason?: string;
  created_at: string;
  updated_at: string;
  last_reminder_sent_at?: string;
}
