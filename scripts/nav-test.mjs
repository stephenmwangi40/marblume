// Navigation test: Settings' Back must return to where Settings was opened from, even after visiting
// Privacy policy and Help & support. Also checks the phone Back button path (handleBack).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((b) => fs.existsSync(b));
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true });
await p.evaluateOnNewDocument(() => localStorage.setItem('marblume.v1', JSON.stringify({ onboarded: true, unlocked: 30 })));
await p.goto(pathToFileURL(path.resolve('www/index.html')).href); await p.waitForFunction(() => typeof go === 'function');
const click = (sel) => p.evaluate((sel) => document.querySelector(`.screen.active ${sel}`).click(), sel);
const at = () => p.evaluate(() => current);
const settingsBack = '.head [data-i="back"]';
let fails = 0; const expect = async (want, what) => { const got = await at(); console.log(got === want ? 'PASS' : 'FAIL', what, '→', got); if (got !== want) fails++; };
for (const from of ['game', 'home', 'profile', 'shop']) {
  await p.evaluate((from) => { if (from === 'game') { loadLevel(5); } go(from); }, from);
  await p.evaluate(() => go('settings'));
  await click('button[onclick="go(\'privacy\')"]'); await expect('privacy', `${from}: Settings → Privacy`);
  await click(settingsBack); await expect('settings', `${from}: Privacy back`);
  await click('button[onclick="go(\'help\')"]'); await expect('help', `${from}: Settings → Help`);
  await click(settingsBack); await expect('settings', `${from}: Help back`);
  await click(settingsBack); await expect(from, `${from}: Settings back`);
  // same journey with the phone's Back button
  await p.evaluate(() => { go('settings'); go('help'); handleBack(); go('privacy'); handleBack(); handleBack(); });
  await expect(from === 'game' ? 'game' : from, `${from}: phone Back button`);
}
await b.close();
console.log(fails ? `${fails} FAILED` : 'All navigation checks passed.');
process.exit(fails ? 1 : 0);
