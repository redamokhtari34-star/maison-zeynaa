export type StatutSite =
  | 'Mis en ligne'
  | 'En attente client'
  | 'Maquette envoyée'
  | 'Refus'
  | 'Site en cours'
  | (string & {});

export type StatutModification = 'Modification à faire' | 'Modification faite' | (string & {});

export interface Client {
  /** Identifiant stable côté app (pas forcément le numéro affiché dans le Sheet). */
  id: string;
  /** Colonne "#" du Sheet, quand elle existe. */
  numero?: number;
  /** Numéro de ligne réel dans le Sheet (1-indexé), utilisé pour écrire les modifications. Absent en mode démo. */
  sheetRow?: number;
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

export type SourceMode = 'sheet' | 'demo';

/** Champs que l'app peut réécrire dans le Sheet — voir lib/sheetsWrite.ts. */
export interface ClientUpdates {
  statutSite?: string;
  statutModification?: string;
  notes?: string;
  noteModification?: string;
}

/** Champs saisis à la création d'un nouveau client — voir lib/sheetsWrite.ts. */
export interface NewClientInput {
  nomEntreprise: string;
  dateDemande?: string;
  telephone?: string;
  secteur?: string;
  reseauxSouhaites?: string[];
  statutSite?: string;
  notes?: string;
}
