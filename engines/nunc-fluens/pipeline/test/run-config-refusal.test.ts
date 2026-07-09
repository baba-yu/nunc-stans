// cmdRun's hand-placed news-config reads (instance store override,
// main-store fallback) refuse malformed JSON with a message naming the
// offending file — never a raw JSON.parse stack (systemd logs must be
// actionable). Spawned through the real CLI: the refusal happens before
// any heavy import.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initInstance } from '../src/instance.ts';

const CLI = join(import.meta.dirname, '..', 'src', 'cli.ts');

function runCli(args: string[], extraEnv: Record<string, string> = {}):
{ status: number | null; stderr: string } {
  const env = { ...process.env };
  delete env.NS_INSTANCE;
  delete env.NS_DATA;
  delete env.NS_NEWS_REPO;
  Object.assign(env, extraEnv);
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env });
  return { status: r.status, stderr: r.stderr };
}

describe('run refuses malformed news-config.json cleanly', () => {
  it('names the instance store override file', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-cfg-'));
    try {
      const inst = join(root, 'inst');
      initInstance(inst);
      const cfg = join(inst, 'store', 'news-config.json');
      writeFileSync(cfg, '{ "locales": ["ja"], }\n'); // trailing comma
      const r = runCli(['run', '--instance', inst, '--date', '2026-01-02']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('refusing to start');
      expect(r.stderr).toContain(cfg);
      expect(r.stderr).not.toContain('    at '); // no stack trace
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('names the main-store fallback file', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-cfg-'));
    try {
      const inst = join(root, 'inst');
      initInstance(inst); // no store/news-config.json of its own
      const store = join(root, 'store');
      mkdirSync(join(store, 'world'), { recursive: true });
      const cfg = join(store, 'world', 'news-config.json');
      writeFileSync(cfg, 'not json at all\n');
      const r = runCli(['run', '--instance', inst, '--date', '2026-01-02'],
        { NS_DATA: store });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('refusing to start');
      expect(r.stderr).toContain(cfg);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
