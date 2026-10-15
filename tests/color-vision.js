// 色觉模拟与色差计算，供 colors.test.js 使用。
// 色盲模拟：Machado, Oliveira & Fernandes (2009)，严重度 1.0，在线性 RGB 上计算。
// 色差：CIEDE2000。经验上 ≥15 清楚，10–15 可辨，<10 容易混淆。
const M = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
};
const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = v => { v = Math.min(1, Math.max(0, v)); return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055); };
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
function over(fg, alpha, bg) { const a = hex2rgb(fg), b = hex2rgb(bg); return rgb2hex(a.map((v, i) => v * alpha + b[i] * (1 - alpha))); }
function simulate(hex, kind) {
  if (kind === 'normal') return hex;
  const lin = hex2rgb(hex).map(toLin), m = M[kind];
  if (kind === 'gray') { const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]; return rgb2hex([y, y, y].map(toSrgb)); }
  return rgb2hex(m.map(row => toSrgb(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])));
}
function lab(hex) {
  const [r, g, b] = hex2rgb(hex).map(toLin);
  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b,
      z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  [x, y, z] = [x, y, z].map(f);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function de2000(h1, h2) {
  const [L1, a1, b1] = lab(h1), [L2, a2, b2] = lab(h2), rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) / rad + 360) % 360, h2p = (Math.atan2(b2, a2p) / rad + 360) % 360;
  const dL = L2 - L1, dC = C2p - C1p;
  let dh = h2p - h1p; if (C1p * C2p === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh / 2 * rad);
  const Lm = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1p + h2p; if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hm += (hm < 360 ? 360 : -360); hm /= 2; }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.20 * Math.cos((4 * hm - 63) * rad);
  const SL = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cmp, SH = 1 + 0.015 * Cmp * T;
  const RT = -2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
const KINDS = ['normal', 'protan', 'deutan', 'tritan', 'gray'];
const KIND_NAMES = { normal: '正常', protan: '红色盲', deutan: '绿色盲', tritan: '蓝色盲', gray: '全色盲' };
function worst(a, b) { let w = { de: Infinity }; for (const k of KINDS) { const de = de2000(simulate(a, k), simulate(b, k)); if (de < w.de) w = { de, k }; } return w; }
const chroma = h => { const [, a, b] = lab(h); return Math.hypot(a, b); };
module.exports = { simulate, de2000, lab, chroma, over, worst, KINDS, KIND_NAMES, hex2rgb, rgb2hex };
