import React from 'react';
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import type { SyncStatus } from '@lego-tracker/core';

interface Props {
  status: SyncStatus;
  onRetry: () => void;
}

export function SyncStatus({ status, onRetry }: Props) {
  if (status === 'idle') return null;

  if (status === 'syncing') {
    return (
      <div className="sync-status sync-status--syncing" data-testid="sync-status-syncing">
        <RefreshCw size={14} className="spinning" />
        <span>Syncing…</span>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className="sync-status sync-status--offline" data-testid="sync-status-offline">
        <WifiOff size={14} />
        <span>Offline — changes will sync when reconnected</span>
      </div>
    );
  }

  return (
    <div className="sync-status sync-status--error" data-testid="sync-status-error">
      <CloudOff size={14} />
      <span>Sync failed</span>
      <button type="button" onClick={onRetry} data-testid="sync-status-retry">
        Retry
      </button>
    </div>
  );
}
