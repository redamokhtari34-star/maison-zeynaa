import { notifyError } from './toast';

/**
 * Mirror a change to Supabase without making the interface wait for it.
 *
 * Handlers used to `await` the cloud write before touching local state, so a
 * slow or unreachable network made buttons feel frozen — and an error made them
 * look inert. Local state is now updated first and the cloud call runs in the
 * background; only its failure is reported, and never as a blocker.
 */
export function mirrorToCloud(
  run: () => PromiseLike<{ error?: unknown } | void>,
  failureMessage: string
): void {
  void (async () => {
    try {
      const result = await run();
      const error = result && (result as { error?: unknown }).error;
      if (error) {
        const message = (error as { message?: string }).message ?? String(error);
        throw new Error(message);
      }
    } catch (err) {
      console.error('Cloud sync failed:', err);
      notifyError(failureMessage);
    }
  })();
}
