import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { RunBundleError, loadRunBundle } from '../lib/load';
import type { ArtifactFailure } from '../lib/load';
import type { RunBundle } from '../lib/types';

export type RunDataState =
  | { status: 'loading' }
  | { status: 'error'; failures: ArtifactFailure[] }
  | { status: 'ready'; bundle: RunBundle };

interface RunDataContextValue {
  state: RunDataState;
  retry: () => void;
}

const RunDataContext = createContext<RunDataContextValue | null>(null);

export function RunDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RunDataState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadRunBundle(import.meta.env.BASE_URL).then(
      (bundle) => {
        if (!cancelled) setState({ status: 'ready', bundle });
      },
      (err: unknown) => {
        if (cancelled) return;
        const failures: ArtifactFailure[] =
          err instanceof RunBundleError
            ? err.failures
            : [{ file: '(bundle)', detail: err instanceof Error ? err.message : String(err) }];
        setState({ status: 'error', failures });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const value = useMemo(() => ({ state, retry }), [state, retry]);

  return <RunDataContext.Provider value={value}>{children}</RunDataContext.Provider>;
}

export function useRunData(): RunDataContextValue {
  const value = useContext(RunDataContext);
  if (value === null) {
    throw new Error('useRunData must be used inside <RunDataProvider>');
  }
  return value;
}
