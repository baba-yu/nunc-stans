#!/usr/bin/env node
// Set one key in the app config (<config-home>/nunc-stans/config.json),
// PRESERVING every other key — the merge-write bootstrap.sh needs (its old
// whole-file printf erased news_repo/manda_data_dir/llama_model on every
// re-designation). Usage: node tools/config-set.ts <key> <value>
import { writeConfigKey } from './lib/data-dir.ts'

const [key, value] = process.argv.slice(2)
if (!key || value === undefined) {
  console.error('usage: node tools/config-set.ts <key> <value>')
  process.exit(2)
}
console.log(writeConfigKey(key, value))
