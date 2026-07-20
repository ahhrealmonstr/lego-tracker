import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncStatus } from './SyncStatus';

const noop = () => {};
const noopSecure = async () => ({ ok: true });

async function revealAndSubmit(email: string) {
  fireEvent.click(screen.getByTestId('secure-backup-toggle'));
  fireEvent.change(screen.getByTestId('secure-backup-email'), { target: { value: email } });
  fireEvent.click(screen.getByTestId('secure-backup-submit'));
}

describe('SyncStatus (backup status)', () => {
  it('renders nothing while initializing', () => {
    const { container } = render(
      <SyncStatus
        backupState="initializing"
        isAnonymous={false}
        onRetry={noop}
        onSecure={noopSecure}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a backing-up indicator', () => {
    render(
      <SyncStatus
        backupState="backing-up"
        isAnonymous={false}
        onRetry={noop}
        onSecure={noopSecure}
      />,
    );
    expect(screen.getByTestId('backup-status-backingup')).toBeInTheDocument();
    expect(screen.getByText('Backing up…')).toBeInTheDocument();
  });

  it('shows a backed-up confirmation', () => {
    render(
      <SyncStatus
        backupState="backed-up"
        isAnonymous={false}
        onRetry={noop}
        onSecure={noopSecure}
      />,
    );
    expect(screen.getByTestId('backup-status-done')).toBeInTheDocument();
    expect(screen.getByText('Backed up')).toBeInTheDocument();
  });

  it('shows an offline, will-back-up-later message', () => {
    render(
      <SyncStatus
        backupState="offline"
        isAnonymous={false}
        onRetry={noop}
        onSecure={noopSecure}
      />,
    );
    expect(screen.getByTestId('backup-status-offline')).toBeInTheDocument();
    expect(screen.getByText('Offline — will back up when online')).toBeInTheDocument();
  });

  it('shows a distinguishable failure with reason and a working Retry', () => {
    const onRetry = vi.fn();
    render(
      <SyncStatus
        backupState="error"
        errorReason="rate-limited"
        isAnonymous={false}
        onRetry={onRetry}
        onSecure={noopSecure}
      />,
    );
    const retry = screen.getByTestId('backup-status-retry');
    expect(retry).toBeInTheDocument();
    expect(screen.getByText(/Backup failed/)).toBeInTheDocument();
    expect(screen.getByText(/rate-limited/)).toBeInTheDocument();
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('SyncStatus (Secure my backup)', () => {
  it('hides the affordance for a linked (non-anonymous) account', () => {
    render(
      <SyncStatus
        backupState="backed-up"
        isAnonymous={false}
        onRetry={noop}
        onSecure={noopSecure}
      />,
    );
    expect(screen.queryByTestId('secure-backup-toggle')).not.toBeInTheDocument();
  });

  it('shows the affordance for an anonymous account', () => {
    render(
      <SyncStatus
        backupState="backed-up"
        isAnonymous
        onRetry={noop}
        onSecure={noopSecure}
      />,
    );
    expect(screen.getByTestId('secure-backup-toggle')).toBeInTheDocument();
  });

  it('submits a valid email to onSecure and confirms via email', async () => {
    const onSecure = vi.fn().mockResolvedValue({ ok: true });
    render(
      <SyncStatus
        backupState="backed-up"
        isAnonymous
        onRetry={noop}
        onSecure={onSecure}
      />,
    );
    await revealAndSubmit('user@example.com');
    expect(onSecure).toHaveBeenCalledWith('user@example.com');
    expect(
      await screen.findByText('Check your email to finish securing your backup'),
    ).toBeInTheDocument();
  });

  it('surfaces an email-taken failure reason', async () => {
    const onSecure = vi.fn().mockResolvedValue({ ok: false, reason: 'email-taken' });
    render(
      <SyncStatus
        backupState="backed-up"
        isAnonymous
        onRetry={noop}
        onSecure={onSecure}
      />,
    );
    await revealAndSubmit('taken@example.com');
    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
  });
});
