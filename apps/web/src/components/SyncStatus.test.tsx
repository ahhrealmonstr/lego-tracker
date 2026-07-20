import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncStatus } from './SyncStatus';

const noop = () => {};
const noopSecure = async () => ({ ok: true });

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
