#!/usr/bin/env node
// Validates data/tools.json. Usage: node scripts/check.mjs [--links]
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/tools.json', root), 'utf8'));

const ENUMS = {
  type: ['app', 'platform', 'program', 'resource', 'experiment'],
  pricing: ['free', 'freemium', 'paid', 'unknown'],
  status: ['active', 'beta', 'discontinued', 'unavailable'],
};
const PLATFORMS = ['web', 'android', 'ios', 'desktop'];
const REQUIRED = ['id', 'name', 'tagline', 'url', 'category', 'type', 'pricing', 'status'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const errors = [];
const cats = new Set(data.categories.map((c) => c.id));
const cols = new Set(data.collections.map((c) => c.id));
const ids = new Set();

for (const t of data.tools) {
  const at = `[${t.id ?? t.name ?? '?'}]`;
  for (const k of REQUIRED) if (!t[k]) errors.push(`${at} missing "${k}"`);
  if (ids.has(t.id)) errors.push(`${at} duplicate id`);
  ids.add(t.id);
  if (t.id && !/^[a-z0-9-]+$/.test(t.id)) errors.push(`${at} id must be kebab-case`);
  if (t.url && !/^https:\/\//.test(t.url)) errors.push(`${at} url must be https`);
  if (t.category && !cats.has(t.category)) errors.push(`${at} unknown category "${t.category}"`);
  for (const [k, vals] of Object.entries(ENUMS)) if (t[k] && !vals.includes(t[k])) errors.push(`${at} bad ${k} "${t[k]}"`);
  for (const p of t.platforms ?? []) if (!PLATFORMS.includes(p)) errors.push(`${at} bad platform "${p}"`);
  for (const c of t.collections ?? []) if (!cols.has(c)) errors.push(`${at} unknown collection "${c}"`);
  for (const k of ['added', 'verified']) if (t[k] && !DATE.test(t[k])) errors.push(`${at} ${k} must be YYYY-MM-DD`);
  if (t.image && !existsSync(new URL(t.image, root))) errors.push(`${at} image not found: ${t.image}`);
  if ((t.tagline ?? '').length > 120) errors.push(`${at} tagline over 120 chars`);
}
for (const t of data.tools)
  for (const r of t.related ?? []) if (!ids.has(r)) errors.push(`[${t.id}] related id "${r}" does not exist`);

if (process.argv.includes('--links')) {
  const live = data.tools.filter((t) => t.status !== 'discontinued');
  await Promise.all(live.map(async (t) => {
    try {
      const res = await fetch(t.url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 google-gifts-link-check' }, signal: AbortSignal.timeout(15000) });
      if (res.status >= 400) errors.push(`[${t.id}] ${t.url} -> HTTP ${res.status}`);
    } catch (e) {
      if (e.cause?.code === 'UND_ERR_HEADERS_OVERFLOW') return; // server answered, headers just exceed Node's limit
      errors.push(`[${t.id}] ${t.url} -> ${e.cause?.code ?? e.name}`);
    }
  }));
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s) in data/tools.json`);
  process.exit(1);
}
console.log(`OK: ${data.tools.length} tools, ${cats.size} categories`);
