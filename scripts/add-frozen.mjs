// Adds frozen tubes to some levels in www/levels.json (and levels.js).
// A frozen tube is one of the spare (empty) tubes. It can't be used until the player finishes a tube of the
// "key" colour shown on the ice. Every frozen level is re-solved with the frozen rule; its par becomes the
// new (longer) solution. Levels where no key colour gives a solution keep no frozen tube.
// Field 7 of a level is then "f<tubeIndex>.<colour>", e.g. "f8.3".
// Usage: node scripts/add-frozen.mjs
import fs from 'node:fs';
import { solveFrozen } from './generate-levels.mjs';

const FILE = 'www/levels.json', PER = 500;
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
// how often a world uses frozen tubes (world index from 0); world 1 never does
const RATE = { 1: 0.6, 12: 0.8 };
const rateOf = (w) => (w === 0 ? 0 : RATE[w] ?? 0.4);
function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const t0 = Date.now(); let made = 0, tried = 0;
data.levels.forEach((L, i) => {
  const n = i + 1, w = Math.floor((n - 1) / PER);
  L.length = Math.min(L.length, 6); // drop an older frozen field before re-adding
  const [str, cap, , , hidden, type] = L;
  const T = str.split('|').map((t) => (t ? [...t].map((c) => parseInt(c, 36)) : []));
  const empties = T.map((t, k) => (t.length ? -1 : k)).filter((k) => k >= 0);
  const r = rng(n * 48271 + 11);
  if (type === 1 || empties.length < 2 || r() >= rateOf(w)) return;
  tried++;
  const fi = empties[empties.length - 1];
  const colours = [...new Set(T.flat())];
  for (let k = colours.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [colours[k], colours[j]] = [colours[j], colours[k]]; }
  for (const kc of colours) {
    const par = solveFrozen(T, cap, fi, kc, 150000);
    if (par > 0) { L[2] = Math.max(L[2], par); L[3] = Math.min(100, L[3] + 4); L[6] = `f${fi}.${kc}`; made++; break; }
  }
  if (n % 500 === 0) console.log(`level ${n}: ${made} frozen so far (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
});
data.version = 4;
data.format[6] = 'frozen tube "f<tube>.<key colour>" (optional)';
fs.writeFileSync(FILE, JSON.stringify(data));
fs.writeFileSync('www/levels.js', 'window.MARBLUME_LEVELS=' + JSON.stringify(data) + ';');
console.log(`Frozen tubes on ${made} of ${tried} chosen levels, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
