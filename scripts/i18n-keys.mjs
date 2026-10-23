// Lists every English phrase the game shows, so each language in www/i18n.js can be checked for gaps.
// Collects: fixed page text, text inside tr()/trn() calls, and the game's data lists (worlds, badges, shop…).
// Usage: node scripts/i18n-keys.mjs            -> writes scripts/i18n-keys.json and reports missing translations
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const html = fs.readFileSync('www/index.html', 'utf8');
const js = html.slice(html.indexOf("'use strict';"));
const keys = new Set();
// string literals inside tr( … ) and trn( … ) calls
for (const call of ['tr(', 'trn(']) for (let i = js.indexOf(call); i >= 0; i = js.indexOf(call, i + 3)) {
  if (/[\w.$]/.test(js[i - 1] || '')) continue; // part of a longer name
  let depth = 0, j = i + call.length - 1, q = null, buf = '', lits = [];
  for (; j < js.length; j++) {
    const ch = js[j];
    if (q) { if (ch === '\\') { buf += js[++j]; continue; } if (ch === q) { lits.push(buf); buf = ''; q = null; } else buf += ch; continue; }
    if (ch === "'" || ch === '"') { q = ch; continue; }
    if (ch === '`') break; // template literals are not translation keys
    if (ch === '(') depth++; else if (ch === ')') { depth--; if (depth === 0) break; }
  }
  for (const l of lits) if (/[A-Za-z]{2}/.test(l) && !/^(auto|light|dark|stars|choice|text|level|daily|zen)$/.test(l)) keys.add(l);
}
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const p = await b.newPage();
await p.goto(pathToFileURL(path.resolve('www/index.html')).href); await p.waitForFunction(() => typeof go === 'function');
const fromPage = await p.evaluate(() => {
  const k = [];
  for (const nd of STATIC) { if (nd.nodeType === 3) k.push(ORIG.get(nd).trim()); else { const m = ORIGA.get(nd); for (const a in m) k.push(m[a]); } }
  for (const w of WORLD_INFO) k.push(...w);
  for (const h of HELP) k.push(...h);
  for (const o of OB) k.push(o[0], o[1]);
  for (const x of BADGES) k.push(x[1], x[2]);
  for (const x of SHOP) { k.push(x[2]); if (x[4]) k.push(x[4][0]); }
  for (const r of RANKS) k.push(r[1]);
  for (const a of AV) k.push(a.n);
  for (const x of BALLS) k.push(x.n);
  for (const x of TIERS) k.push(x[1]);
  for (const x of KINDS) k.push(x[1]);
  for (const x of NAV) k.push(x[2]);
  k.push('Ball', 'Tube', 'Scene', 'Effect', 'Shape');
  return k;
});
await b.close();
for (const k of fromPage) if (k && /[A-Za-z]{2}/.test(k)) keys.add(k);
const list = [...keys].filter((k) => !/^(Marblume|MB1\.…|OK|\d+%|Text \{x\}|Main)$/.test(k)).sort();
fs.writeFileSync('scripts/i18n-keys.json', JSON.stringify(list, null, 1));
console.log(list.length, 'phrases');
// report gaps per language
const src = fs.existsSync('www/i18n.js') ? fs.readFileSync('www/i18n.js', 'utf8') : '';
if (src) {
  const w = {}; new Function('window', src)(w);
  for (const [lang, d] of Object.entries(w.MARBLUME_I18N)) {
    const miss = list.filter((k) => !(k in d)), extra = Object.keys(d).filter((k) => !keys.has(k));
    const badParams = Object.entries(d).filter(([k, v]) => { const a = (k.match(/\{\w+\}/g) || []).sort().join(), z = (v.match(/\{\w+\}/g) || []).sort().join(); return a !== z; }).map(([k]) => k);
    console.log(`${lang}: ${Object.keys(d).length} translated, ${miss.length} missing${miss.length ? ' → ' + miss.slice(0, 8).join(' | ') : ''}${extra.length ? `, ${extra.length} unused` : ''}${badParams.length ? `, PARAM MISMATCH: ${badParams.join(' | ')}` : ''}`);
  }
}
