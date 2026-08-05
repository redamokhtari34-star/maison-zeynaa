import type { ReactElement } from 'react';
import { detectNetwork, toAbsoluteUrl, type SocialNetwork } from '../lib/parse';

const PATHS: Record<SocialNetwork, ReactElement> = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.66 15.4 3.57 14.24 3.57c-2.42 0-4.08 1.48-4.08 4.19V9.9H7.4V13h2.76v8h3.34Z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.5 3c.4 2.2 1.9 3.7 4.3 3.9v2.6c-1.5 0-2.9-.5-4-1.3v6.6c0 3-2.3 5.2-5.1 5.2-2.9 0-5.2-2.3-5.2-5.2S7 9.6 9.9 9.6c.3 0 .6 0 .9.1v2.7c-.3-.1-.6-.2-.9-.2-1.4 0-2.6 1.1-2.6 2.6s1.1 2.6 2.6 2.6 2.7-1.1 2.7-2.6V3h2Z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3.5 9.5h3V21h-3zM10 9.5h2.9v1.57h.04c.4-.76 1.4-1.57 2.9-1.57 3.1 0 3.66 2.04 3.66 4.7V21h-3v-5.3c0-1.27-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21h-3z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.6 7.2s-.2-1.5-.8-2.1c-.8-.8-1.7-.8-2.1-.9C15.9 4 12 4 12 4h0s-3.9 0-6.7.2c-.4 0-1.3.1-2.1.9-.6.6-.8 2.1-.8 2.1S2.2 9 2.2 10.8v1.4C2.2 14 2.4 15.8 2.4 15.8s.2 1.5.8 2.1c.8.8 1.9.8 2.3.9 1.7.2 7.2.2 7.2.2s3.9 0 6.7-.2c.4 0 1.3-.1 2.1-.9.6-.6.8-2.1.8-2.1s.2-1.8.2-3.6v-1.4c0-1.8-.2-3.6-.2-3.6ZM9.9 14.6V9l5.4 2.8-5.4 2.8Z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.6 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.2.1.3 0 .5-.1.2-.1.3-.3.5-.1.2-.3.4-.4.5-.1.2-.3.3-.1.6.2.3.9 1.5 1.9 2.4 1.3 1.2 2.4 1.5 2.7 1.7.3.2.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.8.8.3.1.5.2.5.3.1.2.1.6-.1 1.2Z" />
    </svg>
  ),
  other: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
    </svg>
  ),
};

export function SocialIcon({ url, className = 'w-3 h-3' }: { url: string; className?: string }) {
  const network = detectNetwork(url);
  return <span className={className}>{PATHS[network]}</span>;
}

export function SocialLinkRow({ links, max = 4 }: { links: string[]; max?: number }) {
  if (!links.length) return <span className="text-xs text-slate-400">—</span>;
  const shown = links.slice(0, max);
  return (
    <div className="flex gap-1">
      {shown.map((url) => (
        <a
          key={url}
          href={toAbsoluteUrl(url)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={url}
          className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
        >
          <SocialIcon url={url} />
        </a>
      ))}
    </div>
  );
}
