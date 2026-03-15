import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiOptions {
  pollInterval?: number;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Simple data-fetching hook. Fetches from /api{url} on mount and when
 * url or trigger changes. Call refetch() to manually re-fetch.
 * Pass pollInterval (ms) to automatically re-fetch at that cadence.
 */
export function useApi<T>(url: string | null, options?: UseApiOptions): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [trigger, setTrigger] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setLoading(true);
    setError(null);

    fetch(`/api${url}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(res => {
        if (res.status === 401) {
          if (window.location.pathname !== '/login' && window.location.pathname !== '/login/2fa') {
            window.location.href = '/login';
          }
          throw new Error('Authentication required');
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<T>;
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        if ((err as Error).name === 'AbortError') return;
        setError(err as Error);
        setLoading(false);
      });

    return () => controller.abort();
  }, [url, trigger]);

  const refetch = useCallback(() => setTrigger(t => t + 1), []);

  useEffect(() => {
    if (!options?.pollInterval || !url) return;
    const id = setInterval(refetch, options.pollInterval);
    return () => clearInterval(id);
  }, [url, options?.pollInterval, refetch]);

  return { data, loading, error, refetch };
}
