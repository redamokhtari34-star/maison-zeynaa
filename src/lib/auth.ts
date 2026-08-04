import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './storage';

/**
 * Access control.
 *
 * The database is reached with a key that ships inside the JavaScript bundle,
 * so it cannot be what protects the records. Protection comes from the
 * row-level security policies, which only grant the `authenticated` role — this
 * module is how the app obtains that role.
 */

export type { Session };

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** Fires whenever the user signs in, signs out, or the token is refreshed. */
export function onSessionChange(listener: (session: Session | null) => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Base de données non configurée.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function signUp(email: string, password: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Base de données non configurée.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
  // Supabase returns a user without a session when it wants the address
  // confirmed first; the caller has to say so rather than appear to hang.
  return { needsEmailConfirmation: Boolean(data.user && !data.session) };
}

export async function signOut() {
  const supabase = getSupabaseClient();
  await supabase?.auth.signOut();
}

/** Supabase reports these in English; the shop works in French. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Adresse ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return 'Adresse non confirmée : ouvrez le lien reçu par courriel.';
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Cette adresse a déjà un compte — utilisez « Se connecter ».';
  }
  if (m.includes('password should be at least')) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (m.includes('unable to validate email')) return 'Adresse électronique invalide.';
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Impossible de joindre le serveur. Vérifiez la connexion.';
  }
  return message;
}
