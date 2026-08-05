import type { Client, ClientUpdates } from '../types';

const WRITE_URL = import.meta.env.VITE_SHEET_WRITE_URL?.trim();
const WRITE_SECRET = import.meta.env.VITE_SHEET_WRITE_SECRET?.trim() ?? '';
const SHEET_NAME = import.meta.env.VITE_GOOGLE_SHEET_NAME?.trim();

export const isWriteConfigured = Boolean(WRITE_URL);

interface WritePayload {
  secret: string;
  sheetName?: string;
  rowNumber: number;
  nomEntreprise: string;
  updates: ClientUpdates;
}

/**
 * Envoie une mise à jour au Web App Apps Script déployé sur le Sheet
 * (voir apps-script/Code.gs). Le corps est posté en text/plain plutôt
 * qu'en application/json pour éviter le pré-vol CORS que Apps Script
 * Web Apps ne gère pas — le script lit quand même `e.postData.contents` en JSON.
 */
export async function writeClientUpdates(client: Client, updates: ClientUpdates): Promise<void> {
  if (!WRITE_URL) throw new Error('Aucun VITE_SHEET_WRITE_URL configuré — impossible d\'enregistrer.');
  if (!client.sheetRow) throw new Error('Ligne Sheet inconnue pour ce client — rechargez les données puis réessayez.');

  const payload: WritePayload = {
    secret: WRITE_SECRET,
    sheetName: SHEET_NAME || undefined,
    rowNumber: client.sheetRow,
    nomEntreprise: client.nomEntreprise,
    updates,
  };

  const res = await fetch(WRITE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });

  let body: { ok?: boolean; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    // La réponse Apps Script est parfois une page HTML d'erreur — ok=false ci-dessous.
  }

  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Échec de l'enregistrement (HTTP ${res.status}).`);
  }
}
