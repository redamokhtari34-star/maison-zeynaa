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
