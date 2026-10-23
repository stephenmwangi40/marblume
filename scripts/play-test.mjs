// Gameplay test: solves sample levels and plays the solution inside the real game (index.html) by
// tapping tubes, then checks the win screen, the move count and the stars.
// Usage: node scripts/play-test.mjs [count=40]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const data = JSON.parse(fs.readFileSync('www/levels.json', 'utf8'));
const COUNT = +process.argv[2] || 40;
const key = (T) => T.map((t) => t.join('')).sort().join(',');
const h = (T) => { let s = 0; for (const t of T) for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1]) s++; return s; };
const solved = (T, cap) => T.every((t) => !t.length || (t.length === cap && t.every((x) => x === t[0])));
// same weighted A* as the generator, but it remembers the moves
// F = frozen tube {i, k}: tube i can't be used until a tube of colour k is finished
function solvePath(start, cap, limit = 400000, F = null) {
  const kd = (T) => T.some((t) => t.length === cap && t[0] === F.k && t.every((x) => x === F.k));
  const open = [{ T: start, g: 0, f: 2 * h(start), path: [], l: !!F }], seen = new Set([key(start) + (F ? '#' : '')]);
  let n = 0;
  while (open.length && n++ < limit) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const { T, g, path: P, l } = open.splice(bi, 1)[0];
    if (solved(T, cap)) return P;
    for (let a = 0; a < T.length; a++) {
      if (l && a === F.i) continue; const A = T[a]; if (!A.length) continue; const c = A[A.length - 1];
      let run = 0; for (let k = A.length - 1; k >= 0 && A[k] === c; k--) run++;
      if (run === A.length && A.length === cap) continue;
      let emptyUsed = false;
      for (let b = 0; b < T.length; b++) {
        if (a === b || (l && b === F.i)) continue; const B = T[b]; if (B.length >= cap) continue;
        if (B.length) { if (B[B.length - 1] !== c) continue; } else { if (run === A.length || emptyUsed) continue; emptyUsed = true; }
        const N = T.map((t) => t.slice()), m = Math.min(run, cap - B.length);
        for (let k = 0; k < m; k++) N[b].push(N[a].pop());
        const nl = l && !kd(N), kk = key(N) + (nl ? '#' : ''); if (seen.has(kk)) continue; seen.add(kk);
        open.push({ T: N, g: g + 1, f: g + 1 + 2 * h(N), path: [...P, [a, b]], l: nl });
      }
    }
  }
  return null;
}
// sample: spread over all worlds, plus every special kind of board
const L = data.levels, pick = new Set([1, 2, 3, 10, 25]);
const kinds = [(l) => l[6], (l) => l[6] && l[4], (l) => l[1] === 3, (l) => l[1] === 7, (l) => l[4], (l) => l[0].split('|').filter((t) => !t).length === 1, (l) => l[5] === 2];
kinds.forEach((f) => { const i = L.findIndex((l, i) => i > 3000 && f(l)); if (i >= 0) pick.add(i + 1); });
const firstFrozen = L.findIndex((l) => l[6]); if (firstFrozen >= 0) pick.add(firstFrozen + 1);
for (let w = 0; pick.size < COUNT; w = (w + 1) % 20) pick.add(w * 500 + 1 + Math.floor(Math.random() * 500));

const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.evaluateOnNewDocument((anim) => localStorage.setItem('marblume.v1', JSON.stringify({ onboarded: true, unlocked: 10000, settings: { smart: true, symbols: true, lefty: false, sound: false, haptics: false, saver: !anim, stats: false }, frozenSeen: true })), !!process.env.ANIM);
await p.goto(pathToFileURL(path.resolve('www/index.html')).href); await p.waitForFunction(() => typeof go === 'function');
let ok = 0; const fails = [];
for (const n of [...pick].sort((a, b) => a - b)) {
  const l = L[n - 1], T = l[0].split('|').map((t) => (t ? [...t].map((c) => parseInt(c, 36)) : []));
  const fm = /^f(\d+)\.(\d+)$/.exec(l[6] || ''); const moves = solvePath(T, l[1], 400000, fm ? { i: +fm[1], k: +fm[2] } : null);
  if (!moves) { fails.push(`L${n}: test solver gave up`); continue; }
  const r = await p.evaluate(async (n, sol) => {
    zenMode = false; dailyMode = false; loadLevel(n); go('game');
    for (const [a, b2] of sol) { tap(a); tap(b2); }
    await new Promise((res) => setTimeout(res, 1400));
    return { screen: current, moves, par, stars: S.stars[n] || 0 };
  }, n, moves);
  const desc = `${T.filter((t) => t.length).length}c×${l[1]}+${T.filter((t) => !t.length).length}${l[4] ? ' hidden' : ''}${l[6] ? ' frozen' : ''}`;
  if (r.screen === 'win' && r.stars >= 1) { ok++; console.log(`L${String(n).padStart(5)} ${desc.padEnd(16)} won in ${String(r.moves).padStart(2)} moves (par ${r.par}) ${'★'.repeat(r.stars)}`); }
  else fails.push(`L${n} ${desc}: screen=${r.screen} moves=${r.moves}`);
}
await b.close();
console.log(`\n${ok}/${pick.size} levels played to a win in the real game.` + (fails.length ? '\nFAILED: ' + fails.join(' | ') : '') + (errors.length ? '\nJS errors: ' + errors.join(' | ') : ''));
