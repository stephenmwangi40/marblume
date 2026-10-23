// Checks www/levels.json: every level solvable, well-formed and unique (ignoring tube order and colour swaps).
// Frozen-tube levels are solved with the frozen rule and must still reach their par.
import fs from 'node:fs';
import { shapeKey, solve, solveFrozen } from './generate-levels.mjs';
const d = JSON.parse(fs.readFileSync('www/levels.json', 'utf8'));
const seen = new Map(); let bad = 0, dup = 0, unsolved = 0, frozen = 0, badFrozen = 0; const types = [0, 0, 0];
d.levels.forEach((L, i) => {
  const n = i + 1, [str, cap, par, diff, hidden, type, fz] = L;
  const T = str.split('|').map((t) => (t ? [...t].map((c) => parseInt(c, 36)) : []));
  types[type]++;
  const counts = {}; T.flat().forEach((c) => (counts[c] = (counts[c] || 0) + 1));
  if (Object.values(counts).some((x) => x !== cap) || T.some((t) => t.length > cap)) bad++;
  let f = null;
  if (fz) {
    frozen++;
    const m = /^f(\d+)\.(\d+)$/.exec(fz);
    f = m && { fi: +m[1], kc: +m[2] };
    if (!f || T[f.fi]?.length !== 0 || counts[f.kc] !== cap) { badFrozen++; f = null; }
  }
  const k = shapeKey(T, cap, hidden);
  if (seen.has(k)) { dup++; if (dup < 5) console.log('duplicate:', seen.get(k), n); } else seen.set(k, n);
  if (process.argv[2] === '--solve') {
    const r = f ? solveFrozen(T, cap, f.fi, f.kc, 250000) : solve(T, cap, 250000);
    if (r < 0) { unsolved++; if (unsolved < 5) console.log('unsolved:', n); }
  }
});
console.log({ levels: d.levels.length, malformed: bad, duplicates: dup, unsolved: process.argv[2] === '--solve' ? unsolved : 'skipped', frozen, badFrozen, normal: types[0], breather: types[1], boss: types[2] });
