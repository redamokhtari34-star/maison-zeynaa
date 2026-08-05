import type { Client } from '../types';
import { parseLiensCell, parseReseauxCell, parseSouhaitesCell } from './parse';

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID?.trim();
const SHEET_NAME = import.meta.env.VITE_GOOGLE_SHEET_NAME?.trim();
const SHEET_GID = import.meta.env.VITE_GOOGLE_SHEET_GID?.trim();

export const isSheetConfigured = Boolean(SHEET_ID);

function normalizeHeader(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

type FieldKey =
  | 'numero'
  | 'dateDemande'
  | 'nomEntreprise'
  | 'telephone'
  | 'secteur'
  | 'reseauxSouhaitesSeparate'
  | 'reseauxCombined'
  | 'liens'
  | 'compteDemarche'
  | 'statutSite'
  | 'derniereMiseAJour'
  | 'dateMiseEnLigne'
  | 'notes'
  | 'statutModification'
  | 'noteModification'
  | 'dateModification';

function matchHeader(rawLabel: string): FieldKey | null {
  const h = normalizeHeader(rawLabel);
  if (h === '#' || h.startsWith('n°') || h === 'numero' || h === 'num') return 'numero';
  if (h.includes('date') && h.includes('demande')) return 'dateDemande';
  if (h.includes('entreprise')) return 'nomEntreprise';
  if (h.includes('telephone') || h === 'tel') return 'telephone';
  if (h.includes('secteur')) return 'secteur';
  if (h.includes('reseau') && h.includes('souhait')) return 'reseauxSouhaitesSeparate';
  if (h.includes('reseau')) return 'reseauxCombined';
  if (h.includes('lien')) return 'liens';
  if (h.includes('compte') && h.includes('demarch')) return 'compteDemarche';
  if (h.includes('statut') && h.includes('modif')) return 'statutModification';
  if (h.includes('statut')) return 'statutSite';
  if (h.includes('derniere') && h.includes('mise')) return 'derniereMiseAJour';
  if (h.includes('mise en ligne')) return 'dateMiseEnLigne';
  if (h.includes('note') && h.includes('modif')) return 'noteModification';
  if (h.includes('note')) return 'notes';
  if (h.includes('date') && h.includes('modif')) return 'dateModification';
  return null;
}

interface GvizCell {
  v: unknown;
  f?: string;
}
interface GvizRow {
  c: (GvizCell | null)[];
}
interface GvizTable {
  cols: { label: string }[];
  rows: GvizRow[];
}

function cellText(cell: GvizCell | null | undefined): string {
  if (!cell) return '';
  if (typeof cell.f === 'string') return cell.f;
  if (cell.v === null || cell.v === undefined) return '';
  return String(cell.v);
}

function buildGvizUrl(): string {
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
  // Le gid (visible dans l'URL du Sheet après "#gid=") cible l'onglet sans
  // dépendre de son nom exact — pratique s'il n'a pas été renseigné.
  if (SHEET_GID) return `${base}&gid=${encodeURIComponent(SHEET_GID)}`;
  if (SHEET_NAME) return `${base}&sheet=${encodeURIComponent(SHEET_NAME)}`;
  return base;
}

async function fetchGvizTable(): Promise<GvizTable> {
  const res = await fetch(buildGvizUrl());
  if (!res.ok) {
    throw new Error(
      `Impossible de lire le Google Sheet (HTTP ${res.status}). Vérifiez qu'il est partagé en "Toute personne disposant du lien peut consulter".`,
    );
  }
  const raw = await res.text();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Réponse inattendue de Google Sheets — le classeur est-il bien public ?');
  }
  const json = JSON.parse(raw.slice(start, end + 1));
  return json.table as GvizTable;
}

function rowToClient(fieldByCol: (FieldKey | null)[], row: GvizRow, fallbackIndex: number): Client {
  const get = (key: FieldKey): string => {
    const col = fieldByCol.indexOf(key);
    return col === -1 ? '' : cellText(row.c[col]);
  };

  const souhaitesSeparate = parseSouhaitesCell(get('reseauxSouhaitesSeparate'));
  const liensSeparate = parseLiensCell(get('liens'));
  const combined = parseReseauxCell(get('reseauxCombined'));

  const numeroRaw = get('numero');
  const numero = numeroRaw ? Number.parseInt(numeroRaw, 10) : undefined;

  const nomEntreprise = get('nomEntreprise').trim();

  return {
    id: `${numero ?? fallbackIndex}-${nomEntreprise || fallbackIndex}`,
    numero: Number.isFinite(numero) ? numero : undefined,
    // gviz renvoie les lignes de données sans la ligne d'en-tête (rangée 1) :
    // la ligne réelle dans le Sheet est donc l'index + 2. Le point d'écriture
    // revérifie le nom d'entreprise avant d'écrire, au cas où le Sheet a été trié.
    sheetRow: fallbackIndex + 2,
    dateDemande: get('dateDemande').trim(),
    nomEntreprise,
    telephone: get('telephone').trim(),
    secteur: get('secteur').trim(),
    reseauxSouhaites: souhaitesSeparate.length ? souhaitesSeparate : combined.souhaites,
    liens: liensSeparate.length ? liensSeparate : combined.liens,
    compteDemarche: get('compteDemarche').trim() || undefined,
    statutSite: get('statutSite').trim(),
    derniereMiseAJour: get('derniereMiseAJour').trim() || undefined,
    dateMiseEnLigne: get('dateMiseEnLigne').trim() || undefined,
    notes: get('notes').trim() || undefined,
    statutModification: get('statutModification').trim() || undefined,
    noteModification: get('noteModification').trim() || undefined,
    dateModification: get('dateModification').trim() || undefined,
  };
}

export async function fetchClientsFromSheet(): Promise<Client[]> {
  if (!SHEET_ID) throw new Error('Aucun VITE_GOOGLE_SHEET_ID configuré.');
  const table = await fetchGvizTable();
  const fieldByCol = table.cols.map((c) => matchHeader(c.label ?? ''));

  return table.rows
    .map((row, i) => rowToClient(fieldByCol, row, i))
    .filter((c) => c.nomEntreprise.length > 0);
}
