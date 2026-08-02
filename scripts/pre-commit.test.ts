/**
 * Black-box tests for `.githooks/pre-commit`.
 *
 * These exercise the hook's DECISION — does it run the checks or skip them —
 * not the checks themselves. `npm` is stubbed onto PATH so no real typecheck or
 * test run happens inside the fixture; the stub records each invocation and
 * exits with a code the test controls.
 *
 * Why this exists: the hook's dangerous failure mode is a silent false negative
 * (failing to gate), which leaves no trace. The original revision used
 * `--diff-filter=ACMR` and so skipped delete-only commits entirely — caught by
 * review, not by any test. These cases pin that shut.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, copyFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const hookSource = join(dirname(fileURLToPath(import.meta.url)), '..', '.githooks', 'pre-commit');

let workdir: string | undefined;

interface CommitResult {
  exitCode: number;
  /** One line per stubbed `npm` invocation. Empty means the gate was skipped. */
  npmCalls: string[];
  output: string;
}

function setup(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pre-commit-test-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf-8' });

  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('config', 'commit.gpgsign', 'false');

  // Install the real hook under test.
  mkdirSync(join(dir, '.githooks'));
  copyFileSync(hookSource, join(dir, '.githooks', 'pre-commit'));
  chmodSync(join(dir, '.githooks', 'pre-commit'), 0o755);
  git('config', 'core.hooksPath', '.githooks');

  // Stub npm: log argv, exit with FAKE_NPM_EXIT.
  mkdirSync(join(dir, 'fakebin'));
  const stub = join(dir, 'fakebin', 'npm');
  writeFileSync(stub, '#!/bin/sh\necho "$@" >> "$NPM_LOG"\nexit "${FAKE_NPM_EXIT:-0}"\n');
  chmodSync(stub, 0o755);

  // A baseline commit so deletions and renames have something to act on.
  writeFileSync(join(dir, 'seed.ts'), 'export const seed = 1;\n');
  writeFileSync(join(dir, 'README.md'), '# seed\n');
  git('add', '.');
  git('-c', 'core.hooksPath=', 'commit', '-q', '-m', 'seed');

  return dir;
}

function commit(dir: string, stage: (git: (...a: string[]) => string) => void, npmExit = 0): CommitResult {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf-8' });
  const npmLog = join(dir, 'npm.log');
  if (existsSync(npmLog)) rmSync(npmLog);

  stage(git);

  const env = {
    ...process.env,
    PATH: `${join(dir, 'fakebin')}:${process.env.PATH ?? ''}`,
    NPM_LOG: npmLog,
    FAKE_NPM_EXIT: String(npmExit),
  };

  let exitCode = 0;
  let output = '';
  try {
    output = execFileSync('git', ['commit', '-m', 'subject'], { cwd: dir, env, encoding: 'utf-8', stdio: 'pipe' });
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    exitCode = e.status ?? 1;
    output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }

  const npmCalls = existsSync(npmLog)
    ? readFileSync(npmLog, 'utf-8').split('\n').filter(Boolean)
    : [];

  return { exitCode, npmCalls, output };
}

afterEach(() => {
  if (workdir) rmSync(workdir, { recursive: true, force: true });
  workdir = undefined;
});

describe('pre-commit hook gating', () => {
  it('skips the gate for a markdown-only commit', () => {
    workdir = setup();
    const r = commit(workdir, (git) => {
      writeFileSync(join(workdir!, 'README.md'), '# changed\n');
      git('add', 'README.md');
    });

    expect(r.exitCode).toBe(0);
    expect(r.npmCalls).toEqual([]);
  });

  it('skips the gate for a LICENSE in a subdirectory', () => {
    workdir = setup();
    const r = commit(workdir, (git) => {
      mkdirSync(join(workdir!, 'packages'), { recursive: true });
      writeFileSync(join(workdir!, 'packages', 'LICENSE'), 'MIT\n');
      git('add', 'packages/LICENSE');
    });

    expect(r.exitCode).toBe(0);
    expect(r.npmCalls).toEqual([]);
  });

  it('runs the gate for a source change', () => {
    workdir = setup();
    const r = commit(workdir, (git) => {
      writeFileSync(join(workdir!, 'a.ts'), 'export const a = 1;\n');
      git('add', 'a.ts');
    });

    expect(r.exitCode).toBe(0);
    expect(r.npmCalls).toHaveLength(2);
  });

  it('runs the gate for a mixed docs + source commit', () => {
    workdir = setup();
    const r = commit(workdir, (git) => {
      writeFileSync(join(workdir!, 'README.md'), '# changed\n');
      writeFileSync(join(workdir!, 'a.ts'), 'export const a = 1;\n');
      git('add', 'README.md', 'a.ts');
    });

    expect(r.exitCode).toBe(0);
    expect(r.npmCalls).toHaveLength(2);
  });

  // Regression: --diff-filter=ACMR excluded D, so this skipped the gate entirely.
  it('runs the gate for a delete-only commit', () => {
    workdir = setup();
    const r = commit(workdir, (git) => {
      git('rm', '-q', 'seed.ts');
    });

    expect(r.exitCode).toBe(0);
    expect(r.npmCalls).toHaveLength(2);
  });

  // Regression: with rename detection, --name-only reported only the .md
  // destination, so moving a source file into docs/ read as docs-only.
  it('runs the gate when a source file is renamed to markdown', () => {
    workdir = setup();
    const r = commit(workdir, (git) => {
      mkdirSync(join(workdir!, 'docs'), { recursive: true });
      git('mv', 'seed.ts', 'docs/seed.md');
    });

    expect(r.exitCode).toBe(0);
    expect(r.npmCalls).toHaveLength(2);
  });

  it('gates .txt fixtures rather than treating them as docs', () => {
    workdir = setup();
    const r = commit(workdir, (git) => {
      writeFileSync(join(workdir!, 'fixture.txt'), 'data\n');
      git('add', 'fixture.txt');
    });

    expect(r.exitCode).toBe(0);
    expect(r.npmCalls).toHaveLength(2);
  });

  it('blocks the commit when a check fails', () => {
    workdir = setup();
    const r = commit(
      workdir,
      (git) => {
        writeFileSync(join(workdir!, 'a.ts'), 'export const a = 1;\n');
        git('add', 'a.ts');
      },
      1,
    );

    expect(r.exitCode).not.toBe(0);
    expect(r.output).toContain('Commit blocked');

    const log = execFileSync('git', ['log', '--oneline'], { cwd: workdir, encoding: 'utf-8' });
    expect(log.trim().split('\n')).toHaveLength(1); // only the seed commit
  });
});
