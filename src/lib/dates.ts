/**
 * A single source of truth for "today".
 *
 * The app used to hard-code 2026-07-21 in every screen, which froze late
 * returns, today's movements and the statistics on one arbitrary day. Everything
 * now reads the real clock through these helpers.
 */

/** Today as an ISO date (YYYY-MM-DD), in the user's own timezone. */
export function todayIso(): string {
  return toIso(new Date());
}

/** Format a Date as YYYY-MM-DD without shifting it into UTC. */
export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today shifted by a number of days — used for default rental periods. */
export function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** Current wall-clock time as HH:MM, for stamping history entries. */
export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** A stored YYYY-MM-DD date as people read it: "8 sept. 2026". */
export function formatDay(iso: string | undefined | null, language: 'fr' | 'ar' = 'fr', withYear = true): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-DZ' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {})
  }).format(new Date(y, m - 1, d));
}

/** Today spelled out for the header: "jeudi 8 octobre". */
export function formatTodayLong(language: 'fr' | 'ar' = 'fr'): string {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-DZ' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());
}

/** The first block of a UUID — enough to tell bookings apart on screen. */
export function shortRef(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

/** The current month as YYYY-MM. */
export function currentMonth(): string {
  return todayIso().slice(0, 7);
}

/** The current year as YYYY. */
export function currentYear(): string {
  return todayIso().slice(0, 4);
}
