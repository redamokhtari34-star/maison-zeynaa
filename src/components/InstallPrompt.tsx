import React, { useEffect, useState } from 'react';
import { Download, Share, Plus, X } from 'lucide-react';
import { Language } from '../types';
import { isIos, isStandalone } from '../lib/pwa';

interface InstallPromptProps {
  language: Language;
}

/** A dismissal is respected for this long before the invitation returns. */
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SNOOZE_KEY = 'zeyna_install_prompt_dismissed_at';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Invitation to install the app on the device. Chromium fires an event that
 * lets us open the real install dialog; iOS has no such API, so it gets the
 * two-step instruction instead of a button that could not work.
 */
export default function InstallPrompt({ language }: InstallPromptProps) {
  const isRtl = language === 'ar';
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed, nothing to offer

    const dismissedAt = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < SNOOZE_MS) return;

    if (isIos()) {
      // Give the shop a moment to land on the page before interrupting.
      const timer = window.setTimeout(() => setShowIosHint(true), 4000);
      return () => window.clearTimeout(timer);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // keep the browser's own bar from appearing
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    setDeferred(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  if (!deferred && !showIosHint) return null;

  return (
    <div
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg lg:left-auto lg:right-6 lg:mx-0"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className={`flex items-start gap-3 ${isRtl ? 'flex-row-reverse text-right' : ''}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-950 font-display text-sm text-white">
          MZ
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-neutral-900">
            {language === 'fr' ? "Installer l'application" : 'تثبيت التطبيق'}
          </p>

          {showIosHint ? (
            <p className={`mt-1 flex flex-wrap items-center gap-1 text-[13px] leading-relaxed text-neutral-500 ${isRtl ? 'flex-row-reverse' : ''}`}>
              {language === 'fr' ? 'Touchez' : 'اضغط'}
              <Share size={13} className="inline text-neutral-700" />
              {language === 'fr' ? 'puis' : 'ثم'}
              <span className={`inline-flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-700 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <Plus size={11} />
                {language === 'fr' ? "Sur l'écran d'accueil" : 'إضافة إلى الشاشة الرئيسية'}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
              {language === 'fr'
                ? 'Ouvrez Maison Zeyna depuis votre écran d’accueil, et travaillez même sans connexion.'
                : 'افتحي دار زينة من الشاشة الرئيسية، واعملي حتى دون اتصال.'}
            </p>
          )}

          {deferred && (
            <button
              onClick={install}
              className={`mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              <Download size={15} />
              {language === 'fr' ? 'Installer' : 'تثبيت'}
            </button>
          )}
        </div>

        <button
          onClick={snooze}
          aria-label={language === 'fr' ? 'Fermer' : 'إغلاق'}
          className="shrink-0 rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
