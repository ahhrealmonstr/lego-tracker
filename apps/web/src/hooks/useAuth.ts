import { useEffect, useRef, useState } from 'react';
import { ensureAnonymousSession, getSessionSnapshot, linkEmailIdentity } from '@lego-tracker/core';
import type { LinkResult } from '@lego-tracker/core';

export type BackupState = 'initializing' | 'backed-up' | 'backing-up' | 'offline' | 'error';

export interface UseAuth {
  userId: string | null;
  isAnonymous: boolean;
  sessionReady: boolean;
  backupState: BackupState;
  linkEmail: (email: string) => Promise<LinkResult>;
}

export function useAuth(): UseAuth {
  const [snapshot, setSnapshot] = useState(() => getSessionSnapshot());
  const [sessionReady, setSessionReady] = useState(false);
  const [backupState, setBackupState] = useState<BackupState>('initializing');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const result = await ensureAnonymousSession();
      setSnapshot(getSessionSnapshot());
      setSessionReady(true);
      setBackupState(result.ok ? 'backed-up' : 'error'); // fail-open (D6/SC9)
    })();
  }, []);

  return {
    userId: snapshot.userId,
    isAnonymous: snapshot.isAnonymous,
    sessionReady,
    backupState,
    linkEmail: linkEmailIdentity,
  };
}
