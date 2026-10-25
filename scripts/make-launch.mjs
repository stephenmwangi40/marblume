// Launch screens, drawn sharp from the logo (scripts/logo.mjs) in the Home screen's own colours,
// light and dark, so opening the app looks like the first frame of Home:
//   Android 12+ system splash icon: 288 dp at 4x, mark inside the 192 dp circle (drawable[-night]-nodpi)
//   iOS LaunchScreen image (Splash.imageset): any + dark appearance
import sharp from 'sharp';
import fs from 'node:fs';
import { logoSvg } from './logo.mjs';
const BG = { light: '#F4EEE3', dark: '#0B1222' };
const png = (svg, file) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
const RES = 'android/app/src/main/res';
for (const [dir, light] of [['drawable-nodpi', true], ['drawable-night-nodpi', false]]) {
  fs.mkdirSync(`${RES}/${dir}`, { recursive: true });
  await png(logoSvg(1152, { rounded: false, pad: 0.6, bg: null, light }), `${RES}/${dir}/splash_icon.png`);
}
const IOS = 'ios/App/App/Assets.xcassets/Splash.imageset';
for (const s of [1, 2, 3]) {
  await png(logoSvg(2732, { rounded: false, pad: 1.6, bg: BG.light, light: true }), `${IOS}/Default@${s}x~universal~anyany.png`);
  await png(logoSvg(2732, { rounded: false, pad: 1.6, bg: BG.dark }), `${IOS}/Default@${s}x~universal~anyany-dark.png`);
}
console.log('launch screens ok');
