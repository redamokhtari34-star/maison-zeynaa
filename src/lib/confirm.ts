/**
 * Confirmation dialog, as a promise.
 *
 * `window.confirm` freezes the page, ignores the app's typography and shows up
 * in the browser's language rather than the shop's. `askConfirm` reads the same
 * way at the call site — `if (await askConfirm(...))` — while rendering inside
 * the application.
 */

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
}

type Pending = ConfirmRequest & { resolve: (ok: boolean) => void };
type Listener = (pending: Pending | null) => void;

let pending: Pending | null = null;
let listeners: Listener[] = [];

const emit = () => listeners.forEach(l => l(pending));

export function subscribeToConfirm(listener: Listener): () => void {
  listeners.push(listener);
  listener(pending);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function askConfirm(request: Omit<ConfirmRequest, 'confirmLabel' | 'cancelLabel'> & {
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<boolean> {
  return new Promise(resolve => {
    pending = {
      confirmLabel: 'Confirmer',
      cancelLabel: 'Annuler',
      ...request,
      resolve: (ok: boolean) => {
        pending = null;
        emit();
        resolve(ok);
      }
    };
    emit();
  });
}
