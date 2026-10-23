// Records store preview videos of the real game (no mock-ups):
//   store/video/app-preview-886x1920.mp4   App Store app preview (portrait, 15–30 s, 30 fps, H.264 + silent AAC stereo)
//   store/video/promo-1920x1080.mp4        landscape version for a YouTube link on Google Play / the website
// Usage: node scripts/store-video.mjs
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const OUT = 'store/video';
fs.mkdirSync(OUT, { recursive: true });
const data = JSON.parse(fs.readFileSync('www/levels.json', 'utf8'));
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));

// ---- solver that remembers moves (single-ball pours are fine here; smart pour is on in the game) ----
const key = (T) => T.map((t) => t.join('')).sort().join(',');
const h = (T) => { let s = 0; for (const t of T) for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1]) s++; return s; };
function solvePath(start, cap, F = null) {
  const kd = (T) => T.some((t) => t.length === cap && t[0] === F.k && t.every((x) => x === F.k));
  const done = (T) => T.every((t) => !t.length || (t.length === cap && t.every((x) => x === t[0])));
  const open = [{ T: start, g: 0, f: 2 * h(start), path: [], l: !!F }], seen = new Set([key(start) + (F ? '#' : '')]);
  for (let n = 0; open.length && n < 300000; n++) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const { T, g, path: P, l } = open.splice(bi, 1)[0]; if (done(T)) return P;
    for (let a = 0; a < T.length; a++) {
      if (l && a === F.i) continue; const A = T[a]; if (!A.length) continue; const c = A[A.length - 1];
      let run = 0; for (let k = A.length - 1; k >= 0 && A[k] === c; k--) run++; if (run === A.length && A.length === cap) continue;
      let eu = false;
      for (let b = 0; b < T.length; b++) {
        if (a === b || (l && b === F.i)) continue; const B = T[b]; if (B.length >= cap) continue;
        if (B.length) { if (B[B.length - 1] !== c) continue; } else { if (run === A.length || eu) continue; eu = true; }
        const N = T.map((t) => t.slice()), m = Math.min(run, cap - B.length); for (let k = 0; k < m; k++) N[b].push(N[a].pop());
        const nl = l && !kd(N), kk = key(N) + (nl ? '#' : ''); if (seen.has(kk)) continue; seen.add(kk);
        open.push({ T: N, g: g + 1, f: g + 1 + 2 * h(N), path: [...P, [a, b]], l: nl });
      }
    }
  }
  return null;
}
const parse = (L) => L[0].split('|').map((t) => (t ? [...t].map((c) => parseInt(c, 36)) : []));
// level 1 for the opening, and the first small frozen level for the thaw
const L1 = data.levels[0], sol1 = solvePath(parse(L1), L1[1]);
const fzN = data.levels.findIndex((l, i) => i > 500 && l[6] && l[1] === 3) + 1, FL = data.levels[fzN - 1], fm = /^f(\d+)\.(\d+)$/.exec(FL[6]);
const solF = solvePath(parse(FL), FL[1], { i: +fm[1], k: +fm[2] });
console.log('level 1:', sol1.length, 'moves · frozen level', fzN, ':', solF.length, 'moves');

const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daily = {}; for (let n = 1; n <= 7; n++) daily[day(n)] = 27 + (n % 4);
const stars = {}; for (let i = 2; i <= 186; i++) stars[i] = 1 + ((i * 7) % 3);
const STATE = { onboarded: true, unlocked: 187, stars, seeds: 1240, streak: 7, bestStreak: 9, lastDaily: day(1), daily, profile: { name: 'Amani', avatar: 3, ring: 0 }, frozenSeen: true,
  settings: { stats: false, sound: false, haptics: false, smart: true, symbols: true, saver: false }, prefs: { theme: 'light', text: '1', lang: 'en' }, fx: 'confetti',
  badges: { ten: 1, fifty: 1, century: 1, perf10: 1, stars100: 1, first: 1 } };

async function record(file, W, H, dpr) {
  const b = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--hide-scrollbars'] });
  const p = await b.newPage(); await p.setViewport({ width: W, height: H, deviceScaleFactor: dpr, isMobile: W < 900, hasTouch: W < 900 });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }, { name: 'prefers-color-scheme', value: 'light' }]);
  await p.evaluateOnNewDocument((st) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('marblume.v1', JSON.stringify(st)); } }, STATE);
  await p.goto(pathToFileURL(path.resolve('www/index.html')).href); await p.waitForFunction(() => typeof go === 'function');
  await p.addStyleTag({ content: '#toast{display:none!important}' });
  await p.evaluate(() => { go('home'); }); await new Promise((r) => setTimeout(r, 600));
  const rec = await p.screencast({ path: file, ffmpegPath, fps: 30 });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const play = (moves, gap, stopAfterThaw) => p.evaluate(async (moves, gap, stopAfterThaw) => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const [a, c] of moves) { tap(a); await w(gap * 0.4); tap(c); await w(gap); if (stopAfterThaw && fz && !fz.locked) { await w(1300); return; } }
  }, moves, gap, stopAfterThaw);
  await wait(1300);                                                      // home
  await p.evaluate(() => { coachStep = 0; loadLevel(1); coachStep = 0; go('game'); positionCoach(); });
  await wait(700); await play(sol1, 430); await wait(2600);                // a full level, then the win screen
  await p.evaluate((n) => { loadLevel(n); go('game'); }, fzN); await wait(700);
  await play(solF, 300, true);                                           // frozen level until the ice melts
  await p.evaluate(() => go('daily')); await wait(1900);
  await p.evaluate(() => { shopTab = 'ball'; go('shop'); }); await wait(700);
  await p.evaluate(async () => { const el = document.querySelector('.screen.active .body'); for (let y = 0; y <= 520; y += 13) { el.scrollTop = y; await new Promise((r) => setTimeout(r, 16)); } }); await wait(700);
  await p.evaluate(() => go('profile')); await wait(1700);
  await p.evaluate(() => { S.prefs.theme = 'dark'; applyTheme(); go('home'); }); await wait(1900);
  await rec.stop(); await b.close();
}
const run = (args) => execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', ...args]);
const secs = (f) => { try { execFileSync(ffmpegPath, ['-i', f]); } catch (e) { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(String(e.stderr)); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; } return 0; };

// portrait app preview (443x960 css @2 = 886x1920)
const raw1 = path.join(OUT, '_raw-portrait.webm'); await record(raw1, 443, 960, 2);
let d = secs(raw1); const speed = d > 29.5 ? d / 29.5 : 1; console.log('portrait raw', d.toFixed(1), 's', speed > 1 ? `→ sped up ×${speed.toFixed(2)}` : '');
run(['-i', raw1, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-vf', `setpts=PTS/${speed},scale=886:1920:flags=lanczos,fps=30,format=yuv420p`,
  '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', path.join(OUT, 'app-preview-886x1920.mp4')]);
// landscape promo (the game at laptop size, 1280x720 css @1.5 = 1920x1080)
const raw2 = path.join(OUT, '_raw-landscape.webm'); await record(raw2, 1280, 720, 1.5);
d = secs(raw2); const sp2 = d > 29.5 ? d / 29.5 : 1; console.log('landscape raw', d.toFixed(1), 's');
run(['-i', raw2, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-vf', `setpts=PTS/${sp2},scale=1920:1080:flags=lanczos,fps=30,format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(OUT, 'promo-1920x1080.mp4')]);
fs.unlinkSync(raw1); fs.unlinkSync(raw2);
// the raw recordings have no duration header, so check the finished App Store file and re-time it if it runs over 30 s
const pv = path.join(OUT, 'app-preview-886x1920.mp4'), len = secs(pv);
if (len > 29.6) { const tmp = path.join(OUT, '_tmp.mp4'); fs.renameSync(pv, tmp);
  run(['-i', tmp, '-filter_complex', `[0:v]setpts=PTS/${(len / 29.5).toFixed(4)},fps=30,format=yuv420p[v]`, '-map', '[v]', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-map', '1:a',
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', pv]); fs.unlinkSync(tmp); }
for (const f of ['app-preview-886x1920.mp4', 'promo-1920x1080.mp4']) console.log(f, secs(path.join(OUT, f)).toFixed(1), 's', (fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(1), 'MB');
