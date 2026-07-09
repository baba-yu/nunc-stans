// T4 (Phase D): the TS mirror of the gate's profile validator + the
// loader/resolver the agent uses. Rails must match gate/src/profiles.rs.
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  loadDefaults, loadProfile, resolveProfile, validateProfile,
} from '../src/profile.ts';
import type { Profile } from '../src/profile.ts';

const tmp: string[] = [];
function tmpStore(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nunc-ai-profiles-'));
  tmp.push(d);
  fs.mkdirSync(path.join(d, 'profiles'), { recursive: true });
  return d;
}
afterEach(() => { for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

const minimal = (id: string): Profile => ({ id, name: 'A profile', provider: 'ollama' });

describe('validateProfile rails (mirror of gate/src/profiles.rs)', () => {
  it('accepts a full §2.7 record', () => {
    expect(validateProfile({
      ...minimal('local-chat'),
      model: 'qwen3.6:27b',
      system_prompt: 'be brief',
      skills: ['memory'],
      memory_scope: { read: ['notes/*', 'self/commitment/*'], write: ['notes/*'] },
      goal_verify: { verify: 'off', maxIters: 2 },
      ui: { accent: 'cyan' },
    })).toEqual([]);
  });

  it('F3: rejects commitment write scopes in every spelling', () => {
    for (const scope of ['self/commitment/x', 'self/commitment', 'self/commitment/*', 'self/*', 'self']) {
      const errors = validateProfile({
        ...minimal('p'),
        memory_scope: { read: [], write: [scope] },
      });
      expect(errors.join(' '), scope).toMatch(/F3/);
    }
  });

  it('BYOL: rejects credential-shaped ui keys recursively', () => {
    for (const key of ['apiKey', 'TOKEN', 'client_secret', 'password', 'x-credential']) {
      const errors = validateProfile({ ...minimal('p'), ui: { nested: { [key]: 'v' } } });
      expect(errors.join(' '), key).toMatch(/credential-shaped/);
    }
  });

  it('slug ids only, and never the defaults name', () => {
    expect(validateProfile(minimal('ok-slug-9'))).toEqual([]);
    for (const bad of ['', 'Upper', 'with space', 'dot.json', 'defaults']) {
      expect(validateProfile(minimal(bad)).length, bad).toBeGreaterThan(0);
    }
  });
});

describe('load/resolve (the agent path)', () => {
  it('loads a stored profile and resolves the context default', () => {
    const store = tmpStore();
    const profile: Profile = { ...minimal('agents-default'), model: 'qwen3.6:27b' };
    fs.writeFileSync(path.join(store, 'profiles', 'agents-default.json'), JSON.stringify(profile));
    fs.writeFileSync(path.join(store, 'profiles', 'defaults.json'), JSON.stringify({ agents: 'agents-default' }));

    expect(loadProfile(store, 'agents-default').model).toBe('qwen3.6:27b');
    expect(loadDefaults(store)).toEqual({ agents: 'agents-default' });
    expect(resolveProfile(store, 'agents', undefined)?.id).toBe('agents-default');
    expect(resolveProfile(store, 'fourfive-chat', undefined)).toBeNull();
    expect(resolveProfile(store, 'fourfive-chat', 'agents-default')?.id).toBe('agents-default');
  });

  it('refuses to load a stored profile that violates the rails', () => {
    const store = tmpStore();
    const rogue = { ...minimal('rogue'), memory_scope: { read: [], write: ['self/commitment/x'] } };
    fs.writeFileSync(path.join(store, 'profiles', 'rogue.json'), JSON.stringify(rogue));
    expect(() => loadProfile(store, 'rogue')).toThrow(/F3/);
  });

  it('missing profile / empty defaults degrade cleanly', () => {
    const store = tmpStore();
    expect(() => loadProfile(store, 'ghost')).toThrow(/no profile "ghost"/);
    expect(loadDefaults(store)).toEqual({});
  });
});
