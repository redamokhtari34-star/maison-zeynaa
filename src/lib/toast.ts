/**
 * Minimal notification bus.
 *
 * Errors used to surface through blocking `alert()` dialogs, which freeze the
 * page and look nothing like the rest of the app. `notify()` is a drop-in
 * replacement callable from anywhere — including plain modules like storage.ts
 * that sit outside the React tree — and `<Toaster />` renders the queue.
 */

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let listeners: Listener[] = [];
let nextId = 1;

const emit = () => listeners.forEach(l => l(toasts));

export function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  listener(toasts);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function dismiss(id: number) {
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

export function notify(message: string, kind: ToastKind = 'info', durationMs = 5200) {
  const id = nextId++;
  toasts = [...toasts, { id, message, kind }];
  emit();
  if (durationMs > 0) {
    setTimeout(() => dismiss(id), durationMs);
  }
  return id;
}

export const notifyError = (message: string) => notify(message, 'error', 8000);
export const notifySuccess = (message: string) => notify(message, 'success');
