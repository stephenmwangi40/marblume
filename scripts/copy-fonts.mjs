// Copies the two UI fonts into www/fonts so the app works fully offline.
import fs from 'node:fs';
const want = [
  ['fraunces', 'Fraunces', 600], ['fraunces', 'Fraunces', 800],
  ['dm-sans', 'DM Sans', 400], ['dm-sans', 'DM Sans', 500], ['dm-sans', 'DM Sans', 700],
];
fs.mkdirSync('www/fonts', { recursive: true });
let css = '';
for (const [pkg, family, w] of want) {
  const file = `${pkg}-latin-${w}-normal.woff2`;
  fs.copyFileSync(`node_modules/@fontsource/${pkg}/files/${file}`, `www/fonts/${file}`);
  css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${file}) format('woff2')}\n`;
}
fs.writeFileSync('www/fonts.css', css);
console.log('fonts copied');
