// The Marblume mark: three glass tubes of marbles, with a flower of marbles blooming from the middle one.
// Drawn on a 100x100 grid. logoMark() returns the shapes only; logoSvg() a complete SVG file.
const C = { lake: '#3E7CB1', honey: '#E9B44C', fern: '#6BAA75', iris: '#9B5DE5', peony: '#E56B9F', lagoon: '#2EC4B6', bloom: '#FF5A36', paper: '#F4EEE3', ink: '#16213A' };
const ball = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x - r * 0.32}" cy="${y - r * 0.36}" r="${r * 0.3}" fill="#fff" opacity=".55"/>`;
const tube = (x, top, bottom, w = 20) => `<path d="M${x - w / 2} ${top} V${bottom - w / 2} a${w / 2} ${w / 2} 0 0 0 ${w} 0 V${top}" fill="rgba(244,238,227,.12)" stroke="${C.paper}" stroke-width="3" stroke-linecap="round"/>`;
export function logoMark() {
  const petals = [C.peony, C.honey, C.lake, C.fern, C.iris];
  let flower = '';
  petals.forEach((c, i) => { const a = (-90 + i * 72) * Math.PI / 180; flower += ball(50 + Math.cos(a) * 10.5, 22 + Math.sin(a) * 10.5, 7, c); });
  return [
    tube(22, 46, 92), tube(78, 46, 92), tube(50, 40, 92),
    ball(22, 83, 7, C.lake), ball(22, 67.5, 7, C.honey), ball(22, 52, 7, C.peony),
    ball(78, 83, 7, C.fern), ball(78, 67.5, 7, C.lake), ball(78, 52, 7, C.honey),
    ball(50, 83, 7, C.lagoon), ball(50, 67.5, 7, C.lagoon), ball(50, 52, 7, C.lagoon),
    flower, `<circle cx="50" cy="22" r="6" fill="${C.bloom}"/>`,
  ].join('');
}
// rounded: true for favicons/web (rounded square); false for app-store icons (the OS applies its own mask)
export function logoSvg(size = 512, { rounded = true, pad = 0.1, bg = C.ink } = {}) {
  const inner = 100 * (1 + pad * 2), off = -100 * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${off} ${off} ${inner} ${inner}">` +
    (bg ? `<rect x="${off}" y="${off}" width="${inner}" height="${inner}" rx="${rounded ? inner * 0.22 : 0}" fill="${bg}"/>` : '') + logoMark() + '</svg>';
}
