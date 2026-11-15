'use strict';

// ============================================================
//  小小骑士 · 基础层
//  基准分辨率 480x270，整数倍最近邻放大
// ============================================================

const GAME_W = 480;
const GAME_H = 270;
const TS = 16;              // 瓦片尺寸
const FIXED_DT = 1 / 60;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
}

const U = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },
  invLerp(a, b, v) { return b === a ? 0 : U.clamp((v - a) / (b - a), 0, 1); },
  damp(a, b, rate, dt) { return U.lerp(a, b, 1 - Math.exp(-rate * dt)); },
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return (a + Math.random() * (b - a + 1)) | 0; },
  pick(a) { return a[(Math.random() * a.length) | 0]; },
  chance(p) { return Math.random() < p; },
  sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },
  ang(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },
  dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
  approach(cur, tgt, delta) {
    return cur < tgt ? Math.min(cur + delta, tgt) : Math.max(cur - delta, tgt);
  },
  overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  },
  smooth(t) { return t * t * (3 - 2 * t); },
  easeOut(t) { return 1 - (1 - t) * (1 - t); },
  easeIn(t) { return t * t; },
  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  // 稳定哈希：同一坐标永远同一结果（用于地形细节）
  hash(x, y) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h >>> 0) / 4294967296;
  },
  hexA(hex, a) {
    let s = hex[0] === '#' ? hex.slice(1) : hex;
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  },
  // 调色板混合（返回 #rrggbb）
  mix(h1, h2, t) {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
    const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
    const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  },
  shade(hex, amt) {
    return amt >= 0 ? U.mix(hex, '#ffffff', amt) : U.mix(hex, '#000000', -amt);
  }
};

// ---------------- 调色板（夜森林 / 冷月 / 暖火） ----------------
const PAL = {
  void: '#070a12',
  sky0: '#0c1424', sky1: '#132036', sky2: '#1c2c46', sky3: '#273a5a',
  star: '#dce8ff', starDim: '#8ea6d4',
  moon: '#f0f5ff', moonShade: '#cdd9f2', moonGlow: '#a6bee8',

  mountFar: '#2d3f5e', mountNear: '#384c6e',
  fog: '#9ab2da',

  treeFar: '#1e3346', treeMid: '#263d52', treeNear: '#2e4a60',
  leafD: '#1d3830', leaf: '#2a4c3a', leafL: '#386148', leafHi: '#4a7c5a',
  trunk: '#2c2219', trunkL: '#3d2f22', trunkHi: '#4f3e2c',

  grassD: '#2a4632', grass: '#355a3c', grassL: '#436c48', grassHi: '#558355',
  dirtD: '#2a2014', dirt: '#342719', dirtL: '#3b2d1e', dirtHi: '#463523',
  dirtEdge: '#1e160c',

  rockD: '#1c2438', rock: '#2b364e', rockL: '#3c4b66', rockHi: '#52658a',
  rockEdge: '#4a5c7e',

  stoneD: '#262d3a', stone: '#38424f', stoneL: '#4c5665', stoneHi: '#66717f',

  wood: '#43301f', woodL: '#5b422c', woodHi: '#73553a',

  graveD: '#262e3c', grave: '#3b4657', graveL: '#515d70', graveHi: '#6c7a8e',

  thorn: '#33261a', thornL: '#4e3a26', thornSpike: '#86633d', thornHi: '#aa8551',

  // 主角（参考图：银灰板甲 / 米白披风 / 金发 / 棕皮带 / 长剑）
  armorD: '#3c4250', armor: '#7c8496', armorL: '#a9b2c4', armorHi: '#d7dfee',
  armorWarm: '#c9a866', armorWarmD: '#8a6f3a',
  cloakD: '#9c9483', cloak: '#cbc4b0', cloakL: '#e4dfd0',
  hairD: '#8a6a34', hair: '#c39f57', hairL: '#e6cd8d',
  skin: '#e6c3a1', skinD: '#bd9672',
  leather: '#57392a', leatherL: '#7a5340',
  boot: '#2e2833',
  blood: '#7d2a24',
  eye: '#8fc9e8',

  ink: '#0e1118',
  white: '#f4f7ff'
};

// ---------------- 像素绘制原语 ----------------
const D = {
  rect(g, x, y, w, h, col) {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  },
  box(g, x, y, w, h, fill, outline) {
    D.rect(g, x, y, w, h, fill);
    if (outline) {
      D.rect(g, x, y, w, 1, outline);
      D.rect(g, x, y + h - 1, w, 1, outline);
      D.rect(g, x, y, 1, h, outline);
      D.rect(g, x + w - 1, y, 1, h, outline);
    }
  },
  line(g, x0, y0, x1, y1, col, t) {
    t = t || 1;
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    g.fillStyle = col;
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    const o = (t / 2) | 0;
    let guard = 4096;
    while (guard-- > 0) {
      g.fillRect(x0 - o, y0 - o, t, t);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  },
  disc(g, cx, cy, r, col) {
    if (r <= 0) return;
    g.fillStyle = col;
    const r2 = r * r;
    const y0 = Math.round(cy - r), y1 = Math.round(cy + r);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      const dx = Math.sqrt(Math.max(0, r2 - dy * dy));
      const xa = Math.round(cx - dx), xb = Math.round(cx + dx);
      if (xb > xa) g.fillRect(xa, y, xb - xa, 1);
    }
  },
  circle(g, cx, cy, r, col, t) {
    D.arc(g, cx, cy, r, 0, Math.PI * 2, col, t || 1);
  },
  arc(g, cx, cy, r, a0, a1, col, t) {
    t = t || 1;
    if (r <= 0) return;
    g.fillStyle = col;
    const span = Math.abs(a1 - a0);
    const step = Math.min(0.09, 0.7 / Math.max(1, r));
    const n = Math.max(1, Math.ceil(span / step));
    const o = (t / 2) | 0;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      g.fillRect(x - o, y - o, t, t);
    }
  },
  // 加厚的像素新月（斩击感）
  crescent(g, cx, cy, r, a0, a1, thick, col, taper) {
    g.fillStyle = col;
    const span = Math.abs(a1 - a0);
    const step = Math.min(0.08, 0.6 / Math.max(1, r));
    const n = Math.max(2, Math.ceil(span / step));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const a = a0 + (a1 - a0) * k;
      let th = thick;
      if (taper) {
        // 两端收窄，中间最厚
        th = thick * (0.35 + 0.65 * Math.sin(Math.PI * k));
      }
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      const o = Math.floor(th / 2);
      g.fillRect(x - o, y - o, Math.max(1, Math.round(th)), Math.max(1, Math.round(th)));
    }
  },
  glow(g, x, y, r, col, a) {
    if (r <= 0 || a <= 0) return;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, U.hexA(col, a));
    grd.addColorStop(0.35, U.hexA(col, a * 0.5));
    grd.addColorStop(0.7, U.hexA(col, a * 0.15));
    grd.addColorStop(1, U.hexA(col, 0));
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  },
  // 雪花（十字 + 四角）
  snow(g, cx, cy, r, col) {
    const x = Math.round(cx), y = Math.round(cy);
    g.fillStyle = col;
    g.fillRect(x, y - 1, 1, 3);
    g.fillRect(x - 1, y, 3, 1);
    if (r >= 2) {
      g.fillRect(x - 1, y - 1, 1, 1);
      g.fillRect(x + 1, y - 1, 1, 1);
      g.fillRect(x - 1, y + 1, 1, 1);
      g.fillRect(x + 1, y + 1, 1, 1);
    }
  },

  text(g, str, x, y, size, col, alpha, align, weight) {
    g.save();
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.fillStyle = col;
    g.font = (weight || '') + ' ' + size + 'px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
    g.textAlign = align || 'left';
    g.textBaseline = 'middle';
    g.fillText(str, Math.round(x), Math.round(y));
    g.restore();
  }
};

// 固定种子噪声（地形纹理用）
function noise2(x, y) { return U.hash(x, y); }
