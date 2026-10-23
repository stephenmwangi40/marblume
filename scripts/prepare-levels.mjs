// Uses ./marblume-levels.json (your original level file) if it is in the project root;
// otherwise generates the 10,000 solver-checked levels.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const src = 'marblume-levels.json';
fs.mkdirSync('www', { recursive: true });
if (fs.existsSync(src)) {
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));
  if (!Array.isArray(data.levels) || !data.levels.length) throw new Error(src + ' has no levels');
  fs.writeFileSync('www/levels.json', JSON.stringify(data));
  fs.writeFileSync('www/levels.js', 'window.MARBLUME_LEVELS=' + JSON.stringify(data) + ';');
  console.log(`Using ${src}: ${data.levels.length} levels`);
} else if (!fs.existsSync('www/levels.js')) {
  execFileSync(process.execPath, ['scripts/generate-levels.mjs', '10000', 'www'], { stdio: 'inherit' });
} else {
  console.log('www/levels.js already present');
}
