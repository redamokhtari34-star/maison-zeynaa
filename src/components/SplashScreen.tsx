import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  /** Called once the splash has faded out and can be removed from the tree. */
  onDone: () => void;
}

const HOLD_MS = 1200;
const FADE_MS = 450;

/**
 * Brief house card shown while the app boots, so the installed app opens on
 * something composed rather than on a blank page.
 */
export default function SplashScreen({ onDone }: SplashScreenProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Someone who asked for less motion gets the app straight away.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      onDone();
      return;
    }

    const fade = window.setTimeout(() => setFading(true), HOLD_MS);
    const done = window.setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      role="presentation"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-neutral-50 transition-opacity duration-[450ms] ease-out ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-neutral-950 font-display text-2xl font-semibold text-white">
        MZ
      </div>

      <div className="text-center">
        <p className="font-display text-2xl text-neutral-900">Maison Zeyna</p>
        <p className="eyebrow mt-2">Gestion haute couture</p>
      </div>

      <span className="mt-2 h-0.5 w-24 overflow-hidden rounded-full bg-neutral-200">
        <span className="block h-full w-1/3 animate-pulse rounded-full bg-orange-600" />
      </span>
    </div>
  );
}
