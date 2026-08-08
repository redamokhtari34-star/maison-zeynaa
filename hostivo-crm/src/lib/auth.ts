import type { Session } from '../types';

const WRITE_URL = import.meta.env.VITE_SHEET_WRITE_URL?.trim();
const WRITE_SECRET = import.meta.env.VITE_SHEET_WRITE_SECRET?.trim() ?? '';

/** Un compte par personne n'a de sens que si un backend existe pour les vérifier. */
export const isAuthConfigured = Boolean(WRITE_URL);

const STORAGE_KEY = 'hostivo-crm.session';

export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordCheck {
  minLength: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

export function checkPassword(pw: string): PasswordCheck {
  return {
    minLength: pw.length >= PASSWORD_MIN_LENGTH,
    hasUpper: /[A-Z]/.test(pw),
    hasDigit: /[0-9]/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw),
  };
}

export function passwordIsValid(pw: string): boolean {
  const c = checkPassword(pw);
  return c.minLength && c.hasUpper && c.hasDigit && c.hasSpecial;
}

interface AuthResponse {
  ok?: boolean;
  error?: string;
  token?: string;
  username?: string;
  displayName?: string;
  mustChangePassword?: boolean;
}

async function postAuth(payload: Record<string, unknown>): Promise<AuthResponse> {
  if (!WRITE_URL) throw new Error('Authentification non configurée.');
  const res = await fetch(WRITE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret: WRITE_SECRET, ...payload }),
  });
  let body: AuthResponse = {};
  try {
    body = await res.json();
  } catch {
    // réponse HTML inattendue — body.ok reste undefined, gérée ci-dessous
  }
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Échec de la requête (HTTP ${res.status}).`);
  }
  return body;
}

function toSession(body: AuthResponse): Session {
  return {
    token: body.token!,
    username: body.username!,
    displayName: body.displayName || body.username!,
    mustChangePassword: Boolean(body.mustChangePassword),
  };
}

export async function login(username: string, password: string): Promise<Session> {
  const body = await postAuth({ action: 'login', username, password });
  return toSession(body);
}

export async function verifySession(token: string): Promise<Session> {
  const body = await postAuth({ action: 'verifySession', token });
  return toSession({ ...body, token });
}

export async function changePassword(session: Session, currentPassword: string, newPassword: string): Promise<Session> {
  const body = await postAuth({
    action: 'changePassword',
    token: session.token,
    currentPassword,
    newPassword,
  });
  return { ...session, token: body.token || session.token, mustChangePassword: false };
}

export function loadStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === 'string') return parsed as Session;
    return null;
  } catch {
    return null;
  }
}

export function storeSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
