import { useCallback, useEffect, useRef, useState } from 'react';
import type { SyncStatus } from '@lego-tracker/core';
import { reconcile } from '../services/reconcile';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useSync(): { status: SyncStatus; triggerSync: () => void } {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runSync = useCallback(async () => {
    setStatus('syncing');
    try {
      await reconcile();
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, []);

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(runSync, SYNC_INTERVAL_MS);
  }, [runSync]);

  useEffect(() => {
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }

    runSync();
    startInterval();

    function handleOnline() {
      setStatus('idle');
      runSync();
      startInterval();
    }

    function handleOffline() {
      setStatus('offline');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [runSync, startInterval]);

  return { status, triggerSync: runSync };
}
