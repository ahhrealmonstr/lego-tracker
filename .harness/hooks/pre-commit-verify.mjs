#!/usr/bin/env node
// pre-commit-verify.js — PreToolUse:Bash hook
// Intercepts "git commit" and "git push" commands and runs typecheck + tests
// first. Blocks the commit/push if checks fail.
// Exit codes: 0 = allow, 2 = block

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const GATE_COMMANDS = [/\bgit\s+commit\b/, /\bgit\s+push\b/];

function main() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf-8');
  } catch {
    process.exit(0);
  }

  if (!raw.trim()) process.exit(0);

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const command = input?.tool_input?.command ?? '';
  if (typeof command !== 'string') process.exit(0);

  if (!GATE_COMMANDS.some(re => re.test(command))) process.exit(0);

  const cwd = process.cwd();

  process.stderr.write('[pre-commit-verify] Running typecheck + tests before commit/push…\n');

  const checks = [
    { label: 'typecheck', args: ['run', 'typecheck'] },
    { label: 'tests',     args: ['test'] },
  ];

  const failures = [];

  for (const check of checks) {
    try {
      process.stderr.write(`[pre-commit-verify] → ${check.label}…\n`);
      const output = execFileSync('npm', check.args, {
        cwd,
        encoding: 'utf-8',
        timeout: 120_000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      process.stderr.write(`[pre-commit-verify] ✓ ${check.label} passed\n`);
      if (output.trim()) process.stderr.write(output.slice(-800));
    } catch (err) {
      const out = (err.stdout ?? '') + (err.stderr ?? '') + (err.message ?? '');
      process.stderr.write(`[pre-commit-verify] ✗ ${check.label} FAILED\n${out.slice(-1200)}\n`);
      failures.push(check.label);
    }
  }

  if (failures.length > 0) {
    const msg = `Pre-commit checks FAILED: ${failures.join(', ')}. Fix the errors above before committing.`;
    process.stdout.write(JSON.stringify({ continue: false, stopReason: msg }));
    process.exit(2);
  }

  process.stderr.write('[pre-commit-verify] All checks passed — proceeding.\n');
  process.exit(0);
}

main();
