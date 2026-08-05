import type { Client, ClientUpdates, NewClientInput } from '../types';

const WRITE_URL = import.meta.env.VITE_SHEET_WRITE_URL?.trim();
const WRITE_SECRET = import.meta.env.VITE_SHEET_WRITE_SECRET?.trim() ?? '';
const SHEET_NAME = import.meta.env.VITE_GOOGLE_SHEET_NAME?.trim();

export const isWriteConfigured = Boolean(WRITE_URL);

interface ApiResponse {
  ok?: boolean;
  error?: string;
  rowNumber?: number;
  numero?: number;
}

/**
 * Envoie une requête au Web App Apps Script déployé sur le Sheet
 * (voir apps-script/Code.gs). Le corps est posté en text/plain plutôt
 * qu'en application/json pour éviter le pré-vol CORS que Apps Script
 * Web Apps ne gère pas — le script lit quand même `e.postData.contents` en JSON.
 */
async function postToSheet(payload: Record<string, unknown>): Promise<ApiResponse> {
  if (!WRITE_URL) throw new Error("Aucun VITE_SHEET_WRITE_URL configuré — impossible d'enregistrer.");

  const res = await fetch(WRITE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret: WRITE_SECRET, sheetName: SHEET_NAME || undefined, ...payload }),
  });

  let body: ApiResponse = {};
  try {
    body = await res.json();
  } catch {
    // La réponse Apps Script est parfois une page HTML d'erreur — ok manquant ci-dessous.
  }

  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Échec de la requête (HTTP ${res.status}).`);
  }
  return body;
}

export async function writeClientUpdates(client: Client, updates: ClientUpdates): Promise<void> {
  if (!client.sheetRow) throw new Error('Ligne Sheet inconnue pour ce client — rechargez les données puis réessayez.');
  await postToSheet({
    action: 'update',
    rowNumber: client.sheetRow,
    nomEntreprise: client.nomEntreprise,
    updates,
  });
}

/** Ajoute une nouvelle ligne cliente en bas du Sheet et renvoie sa position réelle. */
export async function createClient(input: NewClientInput): Promise<{ sheetRow: number; numero?: number }> {
  const body = await postToSheet({ action: 'create', fields: input });
  if (!body.rowNumber) throw new Error("Réponse inattendue du Sheet — impossible de confirmer l'ajout.");
  return { sheetRow: body.rowNumber, numero: body.numero };
}
