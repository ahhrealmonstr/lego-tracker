import React from 'react';
import { Check, CloudOff, RefreshCw, WifiOff } from 'lucide-react';

export type BackupState = 'initializing' | 'backed-up' | 'backing-up' | 'offline' | 'error';

export interface SecureResult {
  ok: boolean;
  reason?: string;
}

interface Props {
  backupState: BackupState;
  errorReason?: string | null;
  isAnonymous: boolean;
  onRetry: () => void;
  onSecure: (email: string) => Promise<SecureResult>;
}

export function SyncStatus({ backupState, errorReason, onRetry }: Props) {
  if (backupState === 'initializing') return null;

  if (backupState === 'backing-up') {
    return (
      <div className="sync-status sync-status--syncing" data-testid="backup-status-backingup">
        <RefreshCw size={14} className="spinning" />
        <span>Backing up…</span>
      </div>
    );
  }

  if (backupState === 'backed-up') {
    return (
      <div className="sync-status sync-status--done" data-testid="backup-status-done">
        <Check size={14} />
        <span>Backed up</span>
      </div>
    );
  }

  if (backupState === 'offline') {
    return (
      <div className="sync-status sync-status--offline" data-testid="backup-status-offline">
        <WifiOff size={14} />
        <span>Offline — will back up when online</span>
      </div>
    );
  }

  return (
    <div className="sync-status sync-status--error" data-testid="backup-status-error">
      <CloudOff size={14} />
      <span>Backup failed{errorReason ? ` — ${errorReason}` : ''}</span>
      <button type="button" onClick={onRetry} data-testid="backup-status-retry">
        Retry
      </button>
    </div>
  );
}
