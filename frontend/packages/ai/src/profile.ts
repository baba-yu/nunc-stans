// Agent profiles (v1 plan §2.7, Phase D PD2/PD3): plain JSON files at
// `<data store>/profiles/<id>.json` + a `defaults.json` pointer per
// calling context. The gate's Rust validator (gate/src/profiles.rs) is
// the write-path authority; this mirror lets TS consumers (the agent,
// tests) validate and load without the gate in the middle. The two rails
// are identical on both sides:
// - F3: no profile may grant write access to self-scope commitments.
// - BYOL: credential-shaped keys inside `ui` are rejected — profiles
//   name providers/models, never secrets.
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { VerifyConfig } from './types.ts';

export interface MemoryScope {
  read: string[];
  write: string[];
}

export interface Profile {
  id: string;
  name: string;
  provider: string;
  model?: string;
  system_prompt?: string;
  skills?: string[];
  memory_scope?: MemoryScope;
  goal_verify?: Partial<VerifyConfig>;
  ui?: Record<string, unknown>;
}

export type ProfileContext = 'fourfive-chat' | 'news-steps' | 'agents';

export type ProfileDefaults = Partial<Record<ProfileContext, string>>;

const SLUG = /^[a-z0-9-]+$/;
const CREDENTIAL_WORDS = ['key', 'token', 'secret', 'password', 'credential'];

function credentialShaped(key: string): boolean {
  const k = key.toLowerCase();
  return CREDENTIAL_WORDS.some(w => k.includes(w));
}

function scanUiKeys(value: unknown, errors: string[]): void {
  if (Array.isArray(value)) {
    for (const v of value) scanUiKeys(v, errors);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (credentialShaped(k)) {
        errors.push(`ui contains a credential-shaped key ${JSON.stringify(k)} — profiles never hold secrets (BYOL: keys stay in the environment)`);
      }
      scanUiKeys(v, errors);
    }
  }
}

/** Mirror of the gate-side validation. Returns every violation (empty =
 * valid) so UIs can show them all at once. */
export function validateProfile(p: Profile): string[] {
  const errors: string[] = [];
  if (!p.id || !SLUG.test(p.id) || p.id === 'defaults') {
    errors.push(`id must be a lowercase slug ([a-z0-9-], not 'defaults'), got ${JSON.stringify(p.id)}`);
  }
  if (!p.name?.trim()) errors.push('name must not be empty');
  if (!p.provider?.trim()) errors.push('provider must not be empty');
  if (p.memory_scope) {
    for (const entry of [...p.memory_scope.read, ...p.memory_scope.write]) {
      if (!entry.trim() || /\s/.test(entry)) {
        errors.push(`memory_scope entries must be scope ids, got ${JSON.stringify(entry)}`);
      }
    }
    for (const entry of p.memory_scope.write) {
      const normalized = entry.endsWith('/*') ? entry.slice(0, -2) : entry;
      if (normalized === 'self/commitment' || entry.startsWith('self/commitment/')
        || entry === 'self/*' || entry === 'self') {
        errors.push(`F3: no profile may grant write access to self-scope commitments (memory_scope.write contains ${JSON.stringify(entry)}); commitments are user-only`);
      }
    }
  }
  if (p.goal_verify?.verify && p.goal_verify.verify !== 'on' && p.goal_verify.verify !== 'off') {
    errors.push(`goal_verify.verify must be 'on' or 'off', got ${JSON.stringify(p.goal_verify.verify)}`);
  }
  if (p.goal_verify?.maxIters !== undefined && p.goal_verify.maxIters < 1) {
    errors.push('goal_verify.maxIters must be at least 1');
  }
  if (p.ui !== undefined) {
    if (typeof p.ui !== 'object' || p.ui === null || Array.isArray(p.ui)) {
      errors.push('ui must be an object');
    } else {
      scanUiKeys(p.ui, errors);
    }
  }
  return errors;
}

export function profilesDir(dataDir: string): string {
  return path.join(dataDir, 'profiles');
}

/** Load one profile by id. Throws with the validation errors when the
 * file exists but violates the rails (defense in depth — the gate should
 * never have written such a file). */
export function loadProfile(dataDir: string, id: string): Profile {
  const file = path.join(profilesDir(dataDir), `${id}.json`);
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error(`no profile ${JSON.stringify(id)} in ${profilesDir(dataDir)}`);
  }
  const profile = JSON.parse(raw) as Profile;
  const errors = validateProfile(profile);
  if (errors.length) throw new Error(`profile ${id} is invalid: ${errors.join('; ')}`);
  return profile;
}

export function loadDefaults(dataDir: string): ProfileDefaults {
  try {
    return JSON.parse(fs.readFileSync(path.join(profilesDir(dataDir), 'defaults.json'), 'utf8')) as ProfileDefaults;
  } catch {
    return {};
  }
}

/** Resolve the profile for a calling context: explicit id > the
 * context's default pointer. Null when neither names one. */
export function resolveProfile(dataDir: string, context: ProfileContext, explicitId?: string): Profile | null {
  const id = explicitId ?? loadDefaults(dataDir)[context];
  return id ? loadProfile(dataDir, id) : null;
}
