import type { Session } from '../types';
import { isSupabaseConfigured, supabase } from './supabaseClient';

/** Un compte par personne n'a de sens que si Supabase est configuré. */
export const isAuthConfigured = isSupabaseConfigured;

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

/** Les 3 comptes de l'équipe — pas d'inscription libre, identifiants fixes. */
const ACCOUNT_EMAILS: Record<string, string> = {
  jules: 'jules@hostivo-crm.local',
  anis: 'anis@hostivo-crm.local',
  reda: 'reda@hostivo-crm.local',
};

function displayNameFor(username: string): string {
  return username.charAt(0).toUpperCase() + username.slice(1);
}

function usernameForEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  const entry = Object.entries(ACCOUNT_EMAILS).find(([, e]) => e === email);
  return entry ? entry[0] : null;
}

interface ProfileRow {
  display_name: string;
  must_change_password: boolean;
}

/** Le profil (nom affiché, obligation de changer le mot de passe) est créé au premier login. */
async function loadOrCreateProfile(userId: string, username: string): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('hostivo_profiles')
    .select('display_name, must_change_password')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as ProfileRow;

  const displayName = displayNameFor(username);
  const { error: insertError } = await supabase
    .from('hostivo_profiles')
    .insert({ id: userId, display_name: displayName, must_change_password: true });
  if (insertError) throw new Error(insertError.message);
  return { display_name: displayName, must_change_password: true };
}

export async function login(username: string, password: string): Promise<Session> {
  const email = ACCOUNT_EMAILS[username];
  if (!email) throw new Error('Identifiant inconnu.');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message === 'Invalid login credentials' ? 'Identifiant ou mot de passe incorrect.' : error?.message || 'Échec de la connexion.');
  }

  const profile = await loadOrCreateProfile(data.user.id, username);
  return {
    userId: data.user.id,
    username,
    displayName: profile.display_name,
    mustChangePassword: profile.must_change_password,
  };
}

/** Restaure la session persistée par supabase-js (localStorage), s'il y en a une valide. */
export async function restoreSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  const username = usernameForEmail(user?.email);
  if (!user || !username) return null;

  const profile = await loadOrCreateProfile(user.id, username);
  return {
    userId: user.id,
    username,
    displayName: profile.display_name,
    mustChangePassword: profile.must_change_password,
  };
}

export async function changePassword(session: Session, currentPassword: string, newPassword: string): Promise<Session> {
  const email = ACCOUNT_EMAILS[session.username];
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) throw new Error('Mot de passe actuel incorrect.');

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);

  const { error: profileError } = await supabase
    .from('hostivo_profiles')
    .update({ must_change_password: false })
    .eq('id', session.userId);
  if (profileError) throw new Error(profileError.message);

  return { ...session, mustChangePassword: false };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}
