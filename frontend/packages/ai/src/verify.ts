import type { VerifyConfig } from './types.ts';

/** Normalize a partial verify config. Off by default everywhere; the
 * full judge/retry loop is Phase D — Phase C only parses, plumbs, and
 * logs the flag so call sites don't change shape later. */
export function normalizeVerify(cfg?: Partial<VerifyConfig>): VerifyConfig {
  return {
    verify: cfg?.verify ?? 'off',
    goal: cfg?.goal,
    judge: cfg?.judge,
    maxIters: cfg?.maxIters ?? 2,
    tokenBudget: cfg?.tokenBudget,
  };
}
