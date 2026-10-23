// Renders each in-app avatar to site-src/avatars/<name>.svg so the website shows the real artwork.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const p = await b.newPage(); await p.goto(pathToFileURL(path.resolve('www/index.html')).href); await p.waitForFunction(() => typeof AV !== 'undefined');
const av = await p.evaluate(() => AV.map((a) => ({ n: a.n, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${a.bg}"/>${a.s}</svg>` })));
fs.mkdirSync('site-src/avatars', { recursive: true });
for (const a of av) fs.writeFileSync(`site-src/avatars/${a.n.toLowerCase()}.svg`, a.svg);
await b.close(); console.log(av.map((a) => a.n).join(', '));
