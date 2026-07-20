import React, { useState } from 'react';
import { Check, CloudOff, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';

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

const SECURE_FAILURE_MESSAGES: Record<string, string> = {
  'invalid-email': "That email doesn't look right — check and try again.",
  'email-taken': 'That email is already registered. Try signing in instead.',
  network: "Couldn't reach the server. Try again in a moment.",
};

function secureFailureMessage(reason?: string): string {
  return (reason && SECURE_FAILURE_MESSAGES[reason]) || "Couldn't secure your backup. Try again.";
}

function renderStatus(backupState: BackupState, errorReason: string | null | undefined, onRetry: () => void) {
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

/**
 * Low-key, non-nagging affordance to upgrade the anonymous backup to an
 * email-linked account via a magic link. One button that reveals a small
 * email field — never a modal.
 */
function SecureMyBackup({ onSecure }: { onSecure: (email: string) => Promise<SecureResult> }) {
  const [revealed, setRevealed] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <p className="secure-backup secure-backup--sent" data-testid="secure-backup-sent">
        Check your email to finish securing your backup
      </p>
    );
  }

  if (!revealed) {
    return (
      <button
        type="button"
        className="text-button secure-backup__toggle"
        data-testid="secure-backup-toggle"
        onClick={() => setRevealed(true)}
      >
        <ShieldCheck size={14} /> Secure my backup
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSecure(email);
      if (result.ok) {
        setSent(true);
      } else {
        setError(secureFailureMessage(result.reason));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="secure-backup" onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email for backup"
        data-testid="secure-backup-email"
      />
      <button type="submit" disabled={submitting} data-testid="secure-backup-submit">
        Send link
      </button>
      {error ? (
        <p className="secure-backup__error" data-testid="secure-backup-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function SyncStatus({ backupState, errorReason, isAnonymous, onRetry, onSecure }: Props) {
  const status = renderStatus(backupState, errorReason, onRetry);
  const secure = isAnonymous && backupState !== 'initializing' ? <SecureMyBackup onSecure={onSecure} /> : null;

  if (!status && !secure) return null;

  return (
    <>
      {status}
      {secure}
    </>
  );
}
