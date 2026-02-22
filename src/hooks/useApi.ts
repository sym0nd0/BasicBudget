import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Simple data-fetching hook. Fetches from /api{url} on mount and when
 * url or trigger changes. Call refetch() to manually re-fetch.
 */
export function useApi<T>(url: string | null): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [trigger, setTrigger] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(`/api${url}`, { signal: controller.signal })
      .then(res => {
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

  return { data, loading, error, refetch };
}
