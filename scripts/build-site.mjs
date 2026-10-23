// Builds the Cloudflare Pages site into ./site
//   site-src/*            hand-written pages (landing, privacy)
//   www/ -> site/play/    the playable web version of the game
//   release/*.apk         -> site/download/
//   site-src/shots/*.png  -> resized screenshots
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = 'site';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const copyDir = (from, to, skip = () => false) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    if (skip(f)) continue;
    const s = path.join(from, f), d = path.join(to, f);
    fs.statSync(s).isDirectory() ? copyDir(s, d, skip) : fs.copyFileSync(s, d);
  }
};

// pages (shared header/menu and footer come from site-src/partials)
const PARTIAL = (n) => fs.readFileSync(`site-src/partials/${n}.html`, 'utf8');
for (const f of fs.readdirSync('site-src')) {
  const s = path.join('site-src', f);
  if (fs.statSync(s).isDirectory()) continue;
  let txt = fs.readFileSync(s);
  if (/\.html$/.test(f)) txt = txt.toString().replace('<!--SITE-HEADER-->', PARTIAL('header')).replace('<!--SITE-FOOTER-->', PARTIAL('footer'));
  if (/\.(html|txt)$/.test(f)) txt = txt.toString().replaceAll('{{VERSION}}', pkg.version);
  fs.writeFileSync(path.join(OUT, f), txt);
}
copyDir('www/fonts', path.join(OUT, 'fonts'));
if (fs.existsSync('site-src/avatars')) copyDir('site-src/avatars', path.join(OUT, 'avatars'));
fs.copyFileSync('www/fonts.css', path.join(OUT, 'fonts.css'));
fs.copyFileSync('www/icon.svg', path.join(OUT, 'icon.svg'));
fs.copyFileSync('www/icon-512.png', path.join(OUT, 'icon-512.png'));

// playable web version (levels.json is a duplicate of levels.js)
copyDir('www', path.join(OUT, 'play'), (f) => f === 'levels.json');

// screenshots
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
if (fs.existsSync('site-src/shots')) {
  for (const f of fs.readdirSync('site-src/shots').filter((f) => f.endsWith('.png'))) {
    await sharp(path.join('site-src/shots', f)).resize({ width: 540 }).webp({ quality: 82 }).toFile(path.join(OUT, 'img', f.replace('.png', '.webp')));
  }
}

// Android installer
const apk = `release/Marblume-${pkg.version}.apk`;
if (fs.existsSync(apk)) {
  fs.mkdirSync(path.join(OUT, 'download'), { recursive: true });
  fs.copyFileSync(apk, path.join(OUT, 'download', path.basename(apk)));
} else console.warn('No APK at ' + apk + ' - the download button will 404 until you build it.');

fs.writeFileSync(path.join(OUT, 'version.txt'), pkg.version); // read by the admin health check
console.log('Site built in ./' + OUT);
