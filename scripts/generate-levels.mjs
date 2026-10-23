// Marblume level generator.
// Deals random boards (seeded by level number, so the same number is always the same board),
// solves each one with a weighted A* solver (smart-pour moves) and keeps only solvable deals.
// Each level has its own setup (colours, tube size, spare tubes, hidden balls) on a rising difficulty curve.
// Usage: node scripts/generate-levels.mjs [count] [outDir]
import fs from 'node:fs';
import path from 'node:path';

const COUNT = +process.argv[2] || 10000;
const OUT = process.argv[3] || 'www';
const PER = 500;

export const WORLDS = [
  ['Seedling', 'core'], ['Sprout', 'combo'], ['Meadow', 'mystery'], ['Grove', 'locked'], ['Orchard', 'mixed'],
  ['Tide', 'wild'], ['Summit', 'frozen'], ['Canyon', 'tall'], ['Aurora', 'mystery+'], ['Cosmos', 'remix'],
  ['Savanna', 'locked'], ['Monsoon', 'mystery'], ['Glacier', 'frozen'], ['Lantern', 'onespare'], ['Prism', 'wild'],
  ['Harbor', 'tall'], ['Nebula', 'mystery+'], ['Eclipse', 'onespare'], ['Zenith', 'tower'], ['Infinity', 'remix'],
].map(([name, mechanic]) => ({ name, mechanic }));

// ---------- level design ----------
// Every level gets its own board setup: number of colours (5-12), tube size (3-7 balls) and spare
// tubes (1-3), sometimes with hidden balls. A difficulty curve rises across all 10,000 levels (with a
// gentler breather every 10th level and a boss every 25th); each level takes a setup whose estimated
// difficulty matches its target, and must look different from the levels just before it.
const CONFIGS = [];
for (let colors = 5; colors <= 12; colors++) for (const cap of [3, 4, 5, 6, 7]) for (const spare of [1, 2, 3]) {
  if (cap === 7 && colors > 9) continue;          // keep tall boards solvable and phone-sized
  if (cap === 6 && colors > 11) continue;
  if (spare === 1 && (colors > 10 || (cap === 6 && colors > 8) || (cap === 7 && colors > 6))) continue;
  if (spare === 3 && colors < 7) continue;         // 3 spares on a small board would be too easy
  CONFIGS.push({ colors, cap, spare });
}
// world flavour: which setups a world prefers (weights) and how often it hides balls
const FLAVOUR = [
  { cap: { 3: 1.5, 4: 1.5 }, hidden: 0 },                 // Seedling
  { hidden: 0.05 },                                         // Sprout
  { hidden: 0.65, hf: 0.4 },                                // Meadow   - mystery balls
  { colors: (c) => (c >= 9 ? 2 : 1), hidden: 0.05 },        // Grove    - full boards
  { cap: { 5: 2.5 }, hidden: 0.05 },                        // Orchard  - 5-ball tubes
  { hidden: 0.08 },                                         // Tide
  { spare: { 1: 4 }, hidden: 0.05 },                        // Summit   - one spare tube
  { cap: { 5: 2, 6: 2.5 }, hidden: 0.05 },                  // Canyon   - tall tubes
  { hidden: 0.85, hf: 0.75 },                               // Aurora   - deep mystery
  { colors: (c) => (c >= 10 ? 2 : 1), hidden: 0.08 },       // Cosmos
  { cap: { 6: 2.5, 7: 3 }, hidden: 0.05 },                  // Savanna  - towers
  { cap: { 5: 2 }, hidden: 0.65, hf: 0.4 },                 // Monsoon  - tall mystery
  { spare: { 1: 4 }, hidden: 0.05 },                        // Glacier  - one spare
  { spare: { 1: 3 }, cap: { 3: 2.5 }, hidden: 0.05 },       // Lantern  - short tubes, one spare
  { colors: (c) => (c >= 11 ? 3 : 0.6), hidden: 0.08 },     // Prism    - full spectrum
  { cap: { 5: 2, 6: 2 }, hidden: 0.08 },                    // Harbor
  { hidden: 0.85, hf: 0.75 },                               // Nebula   - darkness
  { spare: { 1: 4 }, hidden: 0.08 },                        // Eclipse  - one spare
  { cap: { 6: 2.5, 7: 3 }, hidden: 0.08 },                  // Zenith   - towers
  { hidden: 0.5, hf: 0.5 },                                 // Infinity - everything
];
const estimate = (c, hf) => c.colors * (c.cap - 1) * (c.spare === 1 ? 1.55 : c.spare === 3 ? 0.72 : 1) + hf * c.colors * (c.cap - 1) * 0.35;
function targetFor(n, type) {
  const t = (n - 1) / 9999, inWorld = ((n - 1) % 500) / 499;
  let d = 20 + 52 * Math.pow(t, 0.8) + 4 * inWorld;      // steady climb + a rise inside each world
  if (type === 1) d *= 0.84;                              // breather
  if (type === 2) d *= 1.18;                              // boss
  return d;
}
const recent = [];                                        // setups of the last four levels
const sameLook = (a, b) => a && a.cap === b.cap && a.spare === b.spare && Math.abs(a.colors - b.colors) < 2;

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function plan(n) {
  const w = Math.min(FLAVOUR.length - 1, Math.floor((n - 1) / PER)), F = FLAVOUR[w];
  const type = n % 25 === 0 ? 2 : n % 10 === 0 ? 1 : 0;
  const r = rng(n * 92821 + 7);
  const hf = r() < (F.hidden || 0) ? (F.hf || 0.4) : 0;
  const target = targetFor(n, type);
  const scored = CONFIGS.filter((c) => !recent.some((p) => sameLook(p, c)))
    .map((c) => {
      const off = Math.abs(estimate(c, hf) - target) / target;
      const wgt = ((F.cap && F.cap[c.cap]) || 1) * ((F.spare && F.spare[c.spare]) || 1) * (F.colors ? F.colors(c.colors) : 1);
      return { ...c, off, wgt };
    })
    .sort((a, b) => a.off - b.off);
  // choose among the setups close to the target, favouring the world's flavour
  const near = scored.filter((c) => c.off <= Math.max(0.16, scored[0].off + 0.05));
  const total = near.reduce((s, c) => s + c.wgt, 0);
  let x = r() * total, first = near[near.length - 1];
  for (const c of near) { x -= c.wgt; if (x <= 0) { first = c; break; } }
  const order = [first, ...scored.filter((c) => c !== first)];
  return { w, type, hf, target, order };
}

// ---------- solver ----------
class Heap {
  constructor() { this.a = []; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}
const key = (T) => T.map((t) => t.join('')).sort().join(',');
function h(T) { let s = 0; for (const t of T) for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1]) s++; return s; }
const solved = (T, cap) => T.every((t) => !t.length || (t.length === cap && t.every((x) => x === t[0])));

export function solve(start, cap, limit = 60000, weight = 2) {
  const heap = new Heap();
  const seen = new Set([key(start)]);
  heap.push({ T: start, g: 0, f: weight * h(start) });
  let expanded = 0;
  while (heap.size && expanded < limit) {
    const { T, g } = heap.pop();
    if (solved(T, cap)) return g;
    expanded++;
    for (let a = 0; a < T.length; a++) {
      const A = T[a];
      let emptyUsed = false;
      if (!A.length) continue;
      const c = A[A.length - 1];
      let run = 0; for (let k = A.length - 1; k >= 0 && A[k] === c; k--) run++;
      if (run === A.length && A.length === cap) continue; // finished tube
      for (let b = 0; b < T.length; b++) {
        if (a === b) continue;
        const B = T[b];
        if (B.length >= cap) continue;
        if (B.length) { if (B[B.length - 1] !== c) continue; }
        else { if (run === A.length) continue; if (emptyUsed) continue; emptyUsed = true; }
        const n = Math.min(run, cap - B.length);
        const N = T.map((t) => t.slice());
        for (let k = 0; k < n; k++) N[b].push(N[a].pop());
        const kk = key(N);
        if (seen.has(kk)) continue;
        seen.add(kk);
        heap.push({ T: N, g: g + 1, f: g + 1 + weight * h(N) });
      }
    }
  }
  return -1;
}

// Same search with one frozen tube: tube `fi` (empty) can't be used until a tube of colour `kc` is finished.
export function solveFrozen(start, cap, fi, kc, limit = 60000, weight = 2) {
  const heap = new Heap();
  const done = (T) => T.some((t) => t.length === cap && t[0] === kc && t.every((x) => x === kc));
  const k0 = key(start) + '#1';
  const seen = new Set([k0]);
  heap.push({ T: start, g: 0, f: weight * h(start), locked: true });
  let expanded = 0;
  while (heap.size && expanded < limit) {
    const { T, g, locked } = heap.pop();
    if (solved(T, cap)) return g;
    expanded++;
    for (let a = 0; a < T.length; a++) {
      if (locked && a === fi) continue;
      const A = T[a];
      let emptyUsed = false;
      if (!A.length) continue;
      const c = A[A.length - 1];
      let run = 0; for (let k = A.length - 1; k >= 0 && A[k] === c; k--) run++;
      if (run === A.length && A.length === cap) continue;
      for (let b = 0; b < T.length; b++) {
        if (a === b || (locked && b === fi)) continue;
        const B = T[b];
        if (B.length >= cap) continue;
        if (B.length) { if (B[B.length - 1] !== c) continue; }
        else { if (run === A.length) continue; if (emptyUsed) continue; emptyUsed = true; }
        const n = Math.min(run, cap - B.length);
        const N = T.map((t) => t.slice());
        for (let k = 0; k < n; k++) N[b].push(N[a].pop());
        const lk = locked && !done(N);
        const kk = key(N) + (lk ? '#1' : '#0');
        if (seen.has(kk)) continue;
        seen.add(kk);
        heap.push({ T: N, g: g + 1, f: g + 1 + weight * h(N), locked: lk });
      }
    }
  }
  return -1;
}

// Shape key that ignores tube order and which colour is which, so a board that is only a
// recolouring or reshuffle of an earlier level counts as the same puzzle. Colours are
// labelled by repeated refinement over where they sit; equal keys are treated as duplicates.
export function shapeKey(T, cap, hidden) {
  const hd = (i) => (hidden ? +String(hidden)[i] || 0 : 0);
  let lab = new Map();
  for (const t of T) for (const c of t) lab.set(c, '');
  let tubeSig = [];
  for (let round = 0; round < 4; round++) {
    tubeSig = T.map((t, i) => t.map((c) => lab.get(c)).join('.') + '/' + hd(i));
    const occ = new Map([...lab.keys()].map((c) => [c, []]));
    T.forEach((t, i) => t.forEach((c, j) => occ.get(c).push(j + '@' + tubeSig[i])));
    const raw = new Map([...occ].map(([c, o]) => [c, o.sort().join(';')]));
    const names = [...new Set(raw.values())].sort();
    lab = new Map([...raw].map(([c, r]) => [c, names.indexOf(r).toString(36)]));
  }
  return cap + ':' + T.map((t, i) => t.map((c) => lab.get(c)).join('') + '/' + hd(i)).sort().join(',');
}
const usedShapes = new Set();

function deal(n, attempt, P) {
  const r = rng(n * 7919 + attempt * 104729 + 17);
  const balls = [];
  for (let c = 0; c < P.colors; c++) for (let i = 0; i < P.cap; i++) balls.push(c);
  for (let i = balls.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [balls[i], balls[j]] = [balls[j], balls[i]]; }
  const T = [];
  for (let t = 0; t < P.colors; t++) T.push(balls.slice(t * P.cap, t * P.cap + P.cap));
  for (let s = 0; s < P.spare; s++) T.push([]);
  if (T.some((t) => t.length && t.every((x) => x === t[0]))) return null; // no finished tube at start
  let hidden = 0;
  if (P.hf > 0) {
    const hs = T.map((t) => (t.length && r() < P.hf ? P.cap - 1 : 0));
    if (hs.some((x) => x)) hidden = hs.join('');
  }
  if (usedShapes.has(shapeKey(T, P.cap, hidden))) return null; // same puzzle as an earlier level
  return { T, hidden };
}

export function makeLevel(n) {
  const L = plan(n);
  const want = 5; // solvable candidates to compare; we keep the hardest
  let found = [], P = null;
  // try the chosen setup, then the next-closest ones; after 6 setups use a quicker search so a level is never skipped
  for (let k = 0; k < L.order.length && !found.length; k++) {
    P = { ...L.order[k], hf: L.hf, type: L.type };
    const tries = k < 6 ? 150 : 40;
    for (let pass = 0; pass < 2 && !found.length; pass++) {
      for (let attempt = pass * tries; attempt < pass * tries + tries && found.length < want; attempt++) {
        const d = deal(n * 31 + k, attempt, P);
        if (!d) continue;
        const par = solve(d.T, P.cap, pass === 0 ? 60000 : 220000);
        if (par < 0 || par < P.colors) continue;            // unsolvable, or too short to be interesting
        found.push({ ...d, par });
      }
    }
  }
  if (!found.length) throw new Error('No solvable deal for level ' + n);
  found.sort((x, y) => x.par - y.par);
  // Hard by design: normal and boss levels take the candidate with the longest solution, breathers the middle one.
  const pick = L.type === 1 ? found[Math.floor(found.length / 2)] : found[found.length - 1];
  usedShapes.add(shapeKey(pick.T, P.cap, pick.hidden));
  recent.unshift({ colors: P.colors, cap: P.cap, spare: P.spare }); recent.length = Math.min(recent.length, 4);
  const hiddenBalls = pick.hidden ? [...pick.hidden].reduce((s, x) => s + +x, 0) : 0;
  // raw difficulty: solution length, made harder by a single spare tube, hidden balls, more colours and taller tubes
  const raw = pick.par * (P.spare === 1 ? 1.4 : P.spare === 3 ? 0.8 : 1) + hiddenBalls * 0.5 + P.colors * 1.2 + (P.cap - 4) * 2;
  const str = pick.T.map((t) => t.map((x) => x.toString(36)).join('')).join('|');
  return [str, P.cap, pick.par, raw, pick.hidden || 0, L.type];
}

// Difficulty 1-100 for the whole set (relative to the easiest and hardest level).
export function rateDifficulty(levels) {
  const raws = levels.map((l) => l[3]), lo = Math.min(...raws), hi = Math.max(...raws);
  for (const l of levels) l[3] = Math.max(1, Math.min(100, Math.round(1 + 99 * (l[3] - lo) / (hi - lo))));
}

if ((process.argv[1] || '').split('\\').join('/').endsWith('generate-levels.mjs')) {
  const t0 = Date.now();
  const levels = [];
  for (let n = 1; n <= COUNT; n++) {
    levels.push(makeLevel(n));
    if (n % 250 === 0) console.log(`level ${n} / ${COUNT}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
  rateDifficulty(levels);
  const data = {
    version: 3,
    format: ['tubes(bottom->top, |-separated, colour digits base-36)', 'capacity', 'par (pours)', 'difficulty 1-100', 'hidden balls per tube (digit string) or 0', 'type 0 normal/1 breather/2 boss'],
    worlds: WORLDS,
    levels,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'levels.json'), JSON.stringify(data));
  fs.writeFileSync(path.join(OUT, 'levels.js'), 'window.MARBLUME_LEVELS=' + JSON.stringify(data) + ';');
  console.log(`Wrote ${levels.length} levels in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
