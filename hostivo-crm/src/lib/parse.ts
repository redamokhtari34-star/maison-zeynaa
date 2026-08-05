const MONTHS: Record<string, number> = {
  jan: 1, janv: 1, january: 1, janvier: 1,
  feb: 2, fev: 2, february: 2, fevrier: 2, février: 2,
  mar: 3, mars: 3, march: 3,
  apr: 4, avr: 4, april: 4, avril: 4,
  may: 5, mai: 5,
  jun: 6, juin: 6, june: 6,
  jul: 7, juil: 7, july: 7, juillet: 7,
  aug: 8, august: 8, aout: 8, août: 8,
  sep: 9, sept: 9, september: 9, septembre: 9,
  oct: 10, october: 10, octobre: 10,
  nov: 11, november: 11, novembre: 11,
  dec: 12, dece: 12, december: 12, decembre: 12, décembre: 12,
};

function monthFromToken(token: string): number | undefined {
  const key = token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\./g, '');
  return MONTHS[key];
}

/**
 * Best-effort parser for the mixed date formats found across the Sheet
 * (ISO, dd/mm/yyyy, "May 22, 06:52 AM" without year, French month names…).
 * Returns null when nothing usable could be extracted.
 */
export function parseLooseDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  // ISO: 2026-05-10 or 2026-12-01 0:00:00
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }

  // dd/mm/yyyy
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }

  // "25 septembre 2026" / "1 august ,2026" — day, month name, year
  m = text.match(/^(\d{1,2})\s+([a-zA-Zéûôî.]+)\s*,?\s*(\d{4})/);
  if (m) {
    const [, d, moTok, y] = m;
    const mo = monthFromToken(moTok);
    if (mo) return new Date(Number(y), mo - 1, Number(d));
  }

  // "oct. 1 ,2026" / "Jul 1, 2026" — month name, day, year
  m = text.match(/^([a-zA-Zéûôî.]+)\.?\s+(\d{1,2})\s*,\s*(\d{4})/);
  if (m) {
    const [, moTok, d, y] = m;
    const mo = monthFromToken(moTok);
    if (mo) return new Date(Number(y), mo - 1, Number(d));
  }

  // "May 22, 06:52 AM" — month name, day, no year → assume current data year (2026)
  m = text.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (m) {
    const [, moTok, d, hh, mm, ampm] = m;
    const mo = monthFromToken(moTok);
    if (mo) {
      let hour = Number(hh);
      if (ampm?.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm?.toUpperCase() === 'AM' && hour === 12) hour = 0;
      return new Date(2026, mo - 1, Number(d), hour, Number(mm));
    }
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Displays a date in a stable dd/mm/yyyy form, or the raw source text if it couldn't be parsed. */
export function formatDate(raw: string | undefined | null): string {
  if (!raw || !raw.trim()) return '—';
  const date = parseLooseDate(raw);
  if (!date) return raw.trim();
  const d = String(date.getDate()).padStart(2, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${mo}/${y}`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

const KNOWN_NETWORKS = ['Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'YouTube', 'WhatsApp', 'Snapchat', 'Pinterest'];

function splitList(text: string): string[] {
  return text
    .split(/[,;/•]|(?:\s+et\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeNetworkLabel(raw: string): string {
  const key = raw.toLowerCase();
  const known = KNOWN_NETWORKS.find((n) => n.toLowerCase() === key || key.includes(n.toLowerCase()));
  return known ?? raw;
}

const URL_RE = /((?:https?:\/\/|www\.)[^\s,]+|wa\.me\/[^\s,]+|[a-z0-9._-]+\.(?:com|me)\/[^\s,]+)/gi;

/**
 * The "Réseaux sociaux" column sometimes arrives as two separate columns
 * (souhaités / liens) and sometimes as one merged cell containing both
 * ("Souhaités : Instagram, TikTok\nLiens :\nhttps://...\nhttps://...").
 * This parses either shape.
 */
export function parseReseauxCell(cell: string | undefined | null): { souhaites: string[]; liens: string[] } {
  if (!cell || !cell.trim()) return { souhaites: [], liens: [] };
  const text = cell.trim();

  const souhaitesMatch = text.match(/Souhait[ée]s?\s*:\s*([^\n]+)/i);
  const liensMatch = text.match(/Liens?\s*:\s*([\s\S]+)/i);

  const souhaites = souhaitesMatch
    ? splitList(souhaitesMatch[1]).map(normalizeNetworkLabel)
    : [];

  let liens: string[] = [];
  if (liensMatch) {
    liens = liensMatch[1].match(URL_RE) ?? [];
  } else if (!souhaitesMatch) {
    // No labels at all: the cell is either a plain network list or a bare set of links.
    const urls = text.match(URL_RE);
    if (urls && urls.length) {
      liens = urls;
    } else {
      return { souhaites: splitList(text).map(normalizeNetworkLabel), liens: [] };
    }
  }

  return { souhaites, liens: dedupe(liens) };
}

/** For a dedicated "Réseaux sociaux souhaités" column containing a plain comma-separated list. */
export function parseSouhaitesCell(cell: string | undefined | null): string[] {
  if (!cell || !cell.trim()) return [];
  return dedupe(splitList(cell).map(normalizeNetworkLabel));
}

export function parseLiensCell(cell: string | undefined | null): string[] {
  if (!cell || !cell.trim()) return [];
  const urls = cell.match(URL_RE);
  return urls ? dedupe(urls) : [];
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}

export type SocialNetwork = 'instagram' | 'tiktok' | 'facebook' | 'linkedin' | 'youtube' | 'whatsapp' | 'other';

export function detectNetwork(url: string): SocialNetwork {
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
  if (u.includes('linkedin.com')) return 'linkedin';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('wa.me') || u.includes('whatsapp.com')) return 'whatsapp';
  return 'other';
}

export function toAbsoluteUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^wa\.me\//i.test(trimmed)) return `https://${trimmed}`;
  return `https://${trimmed}`;
}
