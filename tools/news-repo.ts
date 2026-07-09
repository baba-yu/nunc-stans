#!/usr/bin/env node
// Resolve the linked nunc-fluens instance (the world-view source) and print
// its path, or nothing when none is linked. Mirrors tools/data-dir.ts:
// `just up` passes the result to the gate as --news-repo so the topics API
// (gate/src/topics.rs) can read/write the instance's news-topics.json.
// Resolution: NS_NEWS_REPO env > app config `news_repo` (see
// tools/lib/data-dir.ts, shared with build-world.ts and the pipeline).
import { resolveNewsRepo } from './lib/data-dir.ts'

const dir = resolveNewsRepo()
if (dir) console.log(dir)
