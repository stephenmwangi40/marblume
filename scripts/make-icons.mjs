// Renders every icon/splash source from the Marblume logo (scripts/logo.mjs).
// Then run: npx @capacitor/assets generate --iconBackgroundColor "#16213A" --splashBackgroundColor "#16213A" ...
import sharp from 'sharp';
import fs from 'node:fs';
import { logoSvg } from './logo.mjs';
const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(file);
// store icons: full-bleed square (iOS/Android apply their own corner mask)
await png(logoSvg(1024, { rounded: false, pad: 0.08 }), 'assets/icon-only.png');
// Android adaptive icon: mark inside the 66% safe zone on a transparent layer + solid background layer
await png(logoSvg(1024, { rounded: false, pad: 0.34, bg: null }), 'assets/icon-foreground.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#16213A' } }).png().toFile('assets/icon-background.png');
// launch screens: scripts/make-launch.mjs
// web
await png(logoSvg(512), 'www/icon-512.png');
fs.writeFileSync('www/icon.svg', logoSvg(512));
console.log('icons ok');
