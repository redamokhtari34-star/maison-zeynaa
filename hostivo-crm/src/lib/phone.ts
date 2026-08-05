/** Normalizes French-style numbers (with or without spaces, +33, leading 0) to E.164 digits only. */
export function toE164(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('33')) return digits;
  if (digits.startsWith('0')) return `33${digits.slice(1)}`;
  return digits;
}

export function formatPhoneDisplay(raw: string | undefined | null): string {
  if (!raw || !raw.trim()) return '—';
  const e164 = toE164(raw);
  if (!e164 || !e164.startsWith('33') || e164.length !== 11) return raw.trim();
  const local = `0${e164.slice(2)}`;
  return local.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

export function telHref(raw: string | undefined | null): string | null {
  const e164 = toE164(raw);
  return e164 ? `tel:+${e164}` : null;
}

export function whatsappHref(raw: string | undefined | null): string | null {
  const e164 = toE164(raw);
  return e164 ? `https://wa.me/${e164}` : null;
}
