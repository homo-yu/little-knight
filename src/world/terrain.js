'use strict';

// ============================================================
//  地形烘焙 / 自然装饰绘制
//  以 Object.assign 挂到 World 上，调用方式仍是 World.bake()
//  新增材质 -> 在这里加 bakeXxx() 并在 bake() 里分发
// ============================================================

const WorldTerrain = {
  //  静态地形烘焙
  // ---------------------------------------------------------
  bake() {
    const W = this.boundX1 - this.boundX0;
    const H = this.boundY1 - this.boundY0;
    const t = makeCanvas(W, H);
    this._terrain = t.c;
    this.terX0 = this.boundX0;
    this.terY0 = this.boundY0;
    const g = t.g;
    g.imageSmoothingEnabled = false;

    for (const s of this.solids) {
      if (s.mat === 'thorn') continue;
      const r = { x: s.x - this.terX0, y: s.y - this.terY0, w: s.w, h: s.h };
      if (s.mat === 'earth') this.bakeEarth(g, r, s);
      else if (s.mat === 'rock') this.bakeRock(g, r);
      else if (s.mat === 'wood') this.bakeWood(g, r);
      else if (s.mat === 'stone') this.bakeStone(g, r);
    }

    // 悬崖深谷
    this.bakeChasm(g, 660, 865, GY);

    // 装饰（画在地形之后，仍在角色之后）
    for (const dc of this.decor) this.bakeDecor(g, dc);
  },

  // 深谷：暗色纵深感 + 两侧岩壁 + 底部雾
  bakeChasm(g, x0, x1, topY) {
    const ox = -this.terX0, oy = -this.terY0;
    const X0 = Math.round(x0 + ox), X1 = Math.round(x1 + ox);
    const TY = Math.round(topY + oy);
    const H = this.boundY1 + oy - TY;
    const grd = g.createLinearGradient(0, TY, 0, TY + 150);
    grd.addColorStop(0, '#0d1626');
    grd.addColorStop(0.45, '#070c15');
    grd.addColorStop(1, '#03050a');
    g.fillStyle = grd;
    g.fillRect(X0, TY, X1 - X0, H);

    // 两侧岩壁
    for (let side = 0; side < 2; side++) {
      for (let y = 0; y < Math.min(H, 200); y += 3) {
        const n = U.hash(y, side * 7 + 3);
        const w = 5 + Math.round(n * 7);
        const px = side ? X1 - w : X0;
        D.rect(g, px, TY + y, w, 3, n > 0.62 ? PAL.rockD : PAL.rock);
        D.rect(g, side ? X1 - w : X0, TY + y, 1, 3, PAL.rockL);
      }
      // 壁上苔藓
      for (let y = 0; y < 22; y += 2) {
        const px = side ? X1 - 2 - (U.hash(y, 9) * 4) : X0 + (U.hash(y, 8) * 4);
        if (U.hash(y, side + 5) > 0.5) D.rect(g, px, TY + y, 2, 2, PAL.leaf);
      }
      // 垂下的根须
      for (let i = 0; i < 4; i++) {
        const px = side ? X1 - 3 - i * 3 : X0 + 2 + i * 3;
        let cy = TY + 2;
        const len = 8 + U.hash(i, side + 11) * 16;
        for (let s = 0; s < len; s += 2) {
          D.rect(g, px + (U.hash(s, i) > 0.5 ? 0 : 1), cy + s, 1, 2, PAL.trunk);
        }
      }
    }
    // 谷底雾
    for (let i = 0; i < 12; i++) {
      g.globalAlpha = 0.035;
      g.fillStyle = PAL.fog;
      g.fillRect(X0, TY + 110 + i * 5, X1 - X0, 6);
    }
    g.globalAlpha = 1;
    // 谷口裂口阴影
    D.rect(g, X0, TY, X1 - X0, 3, 'rgba(0,0,0,0.45)');
  },

  bakeEarth(g, r) {
    const { x, y, w, h } = r;
    D.rect(g, x, y, w, h, PAL.dirt);
    // 低频土块
    for (let yy = 10; yy < h; yy += 4) {
      for (let xx = 0; xx < w; xx += 4) {
        const n = U.hash(x + xx, y + yy);
        if (n > 0.88) D.rect(g, x + xx, y + yy, 4, 4, PAL.dirtL);
        else if (n < 0.14) D.rect(g, x + xx, y + yy, 4, 4, PAL.dirtD);
      }
    }
    // 越深越暗
    for (let i = 0; i < 4; i++) {
      g.globalAlpha = 0.10;
      D.rect(g, x, y + h * 0.42 + i * 10, w, 10, PAL.dirtEdge);
      g.globalAlpha = 1;
    }
    // 埋石
    for (let i = 0; i < Math.max(2, w / 22); i++) {
      const px = x + U.hash(i, 5) * (w - 4);
      const py = y + 14 + U.hash(i, 9) * (h - 22);
      D.rect(g, px, py, 3, 2, PAL.dirtHi);
      D.rect(g, px, py + 2, 3, 1, PAL.dirtEdge);
      D.rect(g, px + 1, py, 1, 1, '#6b5941');
    }
    // 树根
    for (let i = 0; i < Math.max(1, w / 90); i++) {
      const px = x + U.hash(i, 15) * (w - 30);
      let cx = px, cy = y + 6;
      for (let s = 0; s < 6; s++) {
        D.rect(g, cx, cy, 2, 2, PAL.dirtEdge);
        cx += U.hash(s, i) > 0.5 ? 2 : -2;
        cy += 3;
      }
    }
    // 草皮
    D.rect(g, x, y, w, 4, PAL.grass);
    D.rect(g, x, y, w, 1, PAL.grassL);
    D.rect(g, x, y + 4, w, 1, PAL.grassD);
    D.rect(g, x, y + 5, w, 1, U.hexA('#000000', 0.25));
    // 草叶
    for (let xx = 0; xx < w; xx += 2) {
      const n = U.hash(x + xx, y - 7);
      if (n > 0.5) {
        const bh = n > 0.85 ? 3 : 2;
        D.rect(g, x + xx, y - bh, 1, bh, n > 0.78 ? PAL.grassHi : PAL.grassL);
        if (n > 0.93) D.rect(g, x + xx + 1, y - bh + 1, 1, 1, PAL.grass);
      }
    }
  },

  bakeRock(g, r) {
    const { x, y, w, h } = r;
    for (let yy = 0; yy < h; yy += 4) {
      for (let xx = 0; xx < w; xx += 4) {
        const n = U.hash(x + xx, y + yy);
        let c = PAL.rock;
        if (n > 0.82) c = PAL.rockL;
        else if (n < 0.22) c = PAL.rockD;
        D.rect(g, x + xx, y + yy, 4, 4, c);
      }
    }
    // 水平层理
    for (let yy = 6; yy < h; yy += 9) {
      D.rect(g, x, y + yy, w, 1, PAL.rockD);
      D.rect(g, x, y + yy + 1, w, 1, U.hexA(PAL.rockHi, 0.18));
    }
    // 裂纹
    const seeds = Math.max(1, Math.floor(w / 30));
    for (let i = 0; i < seeds; i++) {
      let cx = x + U.hash(i, 61) * w;
      let cy = y + 4;
      while (cy < y + h - 2) {
        const nx = cx + U.rand(-1.2, 1.2);
        D.line(g, cx, cy, nx, cy + 2, PAL.rockD, 1);
        cx = U.clamp(nx, x + 1, x + w - 2);
        cy += 2;
        if (U.chance(0.15)) D.rect(g, cx + 1, cy, 2, 1, PAL.rockD);
      }
    }
    // 顶面
    D.rect(g, x, y, w, 2, PAL.rockHi);
    D.rect(g, x, y + 2, w, 1, PAL.rockEdge);
    // 侧面亮/暗
    D.rect(g, x, y + 3, 1, h - 3, PAL.rockL);
    D.rect(g, x + w - 1, y + 3, 1, h - 3, PAL.rockD);
    // 苔藓
    for (let xx = 0; xx < w; xx += 3) {
      const n = U.hash(x + xx, y + 99);
      if (n > 0.55) {
        D.rect(g, x + xx, y - 1, 2, 2, n > 0.8 ? PAL.leafHi : PAL.leaf);
        if (n > 0.9) D.rect(g, x + xx, y, 1, 3, PAL.leafL);
      }
    }
  },

  bakeWood(g, r) {
    const { x, y, w, h } = r;
    D.rect(g, x, y, w, h, PAL.wood);
    for (let xx = 0; xx < w; xx += 3) {
      const n = U.hash(x + xx, y + 3);
      D.rect(g, x + xx, y, 1, h, n > 0.55 ? PAL.woodL : PAL.wood);
    }
    D.rect(g, x, y, w, 1, PAL.woodHi);
    D.rect(g, x, y + h - 1, w, 1, PAL.rockD);
    // 年轮
    if (h >= 20) {
      const cx = x + w - 3, cy = y + h / 2;
      D.circle(g, cx, cy, 5, PAL.woodL, 1);
      D.circle(g, cx, cy, 2, PAL.woodHi, 1);
    }
    // 苔
    for (let xx = 0; xx < w; xx += 4) {
      if (U.hash(x + xx, y + 71) > 0.6) D.rect(g, x + xx, y + 1, 2, 2, PAL.leaf);
    }
  },

  bakeStone(g, r) {
    const { x, y, w, h } = r;
    D.rect(g, x, y, w, h, PAL.stone);
    for (let yy = 0; yy < h; yy += 8) {
      D.rect(g, x, y + yy, w, 1, PAL.stoneD);
      for (let xx = (yy % 16 === 0 ? 0 : 8); xx < w; xx += 16) {
        D.rect(g, x + xx, y + yy, 1, 8, PAL.stoneD);
      }
    }
    for (let yy = 0; yy < h; yy += 4) {
      for (let xx = 0; xx < w; xx += 4) {
        if (U.hash(x + xx, y + yy) > 0.82) D.rect(g, x + xx, y + yy, 2, 2, PAL.stoneL);
      }
    }
    D.rect(g, x, y, w, 2, PAL.stoneHi);
  },

  // ---------------- 装饰 ----------------
  bakeDecor(g, d) {
    const ox = -this.terX0, oy = -this.terY0;
    if (d.t === 'tree') this.drawTree(g, d.x + ox, d.y + oy, d.h, d.s, d.v || 0);
    else if (d.t === 'bush') this.drawBush(g, d.x + ox, d.y + oy, d.s);
    else if (d.t === 'fern') this.drawFern(g, d.x + ox, d.y + oy, d.s);
    else if (d.t === 'rockDeco') this.drawRockDeco(g, d.x + ox, d.y + oy, d.s);
    else if (d.t === 'grave') this.drawGrave(g, d.x + ox, d.y + oy, d.v, d.s);
    else if (d.t === 'deadTree') this.drawDeadTree(g, d.x + ox, d.y + oy, d.h, d.s);
    else if (d.t === 'fence') this.drawFence(g, d.x + ox, d.y + oy, d.n);
    else if (d.t === 'vine') this.drawVine(g, d.x + ox, d.y + oy, d.s);
  },

  drawTree(g, x, y, h, s, v) {
    const tint = U.hash(x | 0, 1) * 0.5;
    const leafD = U.mix(PAL.leafD, PAL.treeFar, tint * 0.6);
    const leaf = U.mix(PAL.leaf, PAL.treeMid, tint);
    const leafL = U.mix(PAL.leafL, PAL.leaf, tint * 0.5);
    const tw = Math.max(3, Math.round(4 * s));
    // 树干 + 根
    D.rect(g, x - (tw >> 1), y - h, tw, h, PAL.trunk);
    D.rect(g, x - (tw >> 1), y - h, 1, h, PAL.trunkL);
    D.rect(g, x - (tw >> 1) - 2, y - 4, 3, 4, PAL.trunk);
    D.rect(g, x + (tw >> 1) - 1, y - 3, 3, 3, PAL.trunk);
    D.rect(g, x - (tw >> 1) + 1, y - h + 4, 1, h - 6, PAL.trunkHi);

    const cy = y - h;
    if (v === 1) {
      // 松树
      const layers = 5;
      for (let i = 0; i < layers; i++) {
        const k = i / (layers - 1);
        const w = (h * 0.3) * (1 - k * 0.72);
        const yy = cy + h * 0.12 - k * h * 0.66;
        const col = i === layers - 1 ? leafL : (i % 2 ? leaf : leafD);
        for (let xx = -w; xx <= w; xx++) {
          const edge = Math.abs(xx) / w;
          const hh = Math.round((3 + h * 0.13 * (1 - edge * edge)) * 1);
          D.rect(g, x + xx, yy - hh, 1, hh + 2, col);
        }
      }
      D.rect(g, x - 1, cy - h * 0.78, 2, 6, leafL);
    } else {
      const cr = h * (v === 2 ? 0.26 : 0.38) * s;
      const ccy = cy + h * 0.1;
      const lob = [
        { dx: 0, dy: 4, r: cr, c: leafD },
        { dx: -cr * 0.62, dy: 6, r: cr * 0.72, c: leafD },
        { dx: cr * 0.6, dy: 7, r: cr * 0.68, c: leafD },
        { dx: -cr * 0.2, dy: -cr * 0.1, r: cr * 0.85, c: leaf },
        { dx: cr * 0.45, dy: -cr * 0.15, r: cr * 0.62, c: leaf },
        { dx: -cr * 0.45, dy: -cr * 0.35, r: cr * 0.55, c: leafL },
        { dx: cr * 0.15, dy: -cr * 0.55, r: cr * 0.45, c: leafL }
      ];
      for (const L of lob) D.disc(g, x + L.dx, ccy + L.dy, L.r, L.c);
      // 叶簇碎点
      for (let i = 0; i < cr * 2.4; i++) {
        const a = U.rand(0, Math.PI * 2);
        const rr = U.rand(cr * 0.4, cr * 0.98);
        const px = x + Math.cos(a) * rr * 1.22;
        const py = ccy + Math.sin(a) * rr * 0.86;
        if (py > y - h * 0.16) continue;
        const n = U.hash(px | 0, py | 0);
        D.rect(g, px, py, 2, 2, n > 0.68 ? leafL : (n > 0.36 ? leaf : leafD));
      }
      // 顶部月光
      for (let i = 0; i < 14; i++) {
        const px = x - cr * 0.6 + U.rand(0, cr * 1.0);
        const py = ccy - cr * 0.9 + U.rand(0, cr * 0.32);
        D.rect(g, px, py, 1, 1, PAL.leafHi);
      }
    }
  },

  drawBush(g, x, y, s) {
    const r = 6 * s;
    D.disc(g, x, y - r * 0.7, r, PAL.leafD);
    D.disc(g, x - r * 0.5, y - r * 0.5, r * 0.75, PAL.leaf);
    D.disc(g, x + r * 0.45, y - r * 0.5, r * 0.7, PAL.leaf);
    D.disc(g, x - r * 0.2, y - r * 0.9, r * 0.4, PAL.leafL);
    for (let i = 0; i < 5; i++) {
      D.rect(g, x + U.rand(-r, r), y - U.rand(0, r * 1.3), 2, 2, PAL.leafHi);
    }
  },

  drawFern(g, x, y, s) {
    const h = 7 * s;
    for (let i = -2; i <= 2; i++) {
      const a = -Math.PI / 2 + i * 0.42;
      const len = h * (1 - Math.abs(i) * 0.16);
      D.line(g, x, y, x + Math.cos(a) * len * 1.3, y + Math.sin(a) * len,
        i === 0 ? PAL.grassHi : (Math.abs(i) === 1 ? PAL.grassL : PAL.grass), 1);
    }
  },

  drawRockDeco(g, x, y, s) {
    const w = 9 * s, h = 6 * s;
    D.rect(g, x - w / 2, y - h, w, h, PAL.rockL);
    D.rect(g, x - w / 2 + 1, y - h, w - 2, 1, PAL.rockHi);
    D.rect(g, x - w / 2 + 2, y - h + 2, w * 0.4, 1, PAL.rock);
    D.rect(g, x - w / 2, y - 1, w, 1, PAL.rockD);
  },

  drawGrave(g, x, y, v, s) {
    const w = Math.round(11 * s), h = Math.round(16 * s);
    if (v === 0) {
      D.rect(g, x - w / 2, y - h, w, h, PAL.grave);
      D.disc(g, x, y - h, w / 2, PAL.grave);
      D.rect(g, x - w / 2, y - h, 1, h, PAL.graveL);
      D.rect(g, x - w / 2, y - h - 3, w, 3, PAL.graveL);
      D.rect(g, x - 1, y - h - 1, 2, 7, PAL.graveD);
      D.rect(g, x - 3, y - h + 2, 6, 2, PAL.graveD);
    } else if (v === 1) {
      // 十字墓碑
      D.rect(g, x - 1, y - h, 3, h, PAL.grave);
      D.rect(g, x - 5, y - h + 4, 11, 3, PAL.grave);
      D.rect(g, x - 1, y - h, 1, h, PAL.graveL);
      D.rect(g, x - 5, y - h + 4, 11, 1, PAL.graveHi);
    } else {
      // 歪倒的石碑
      D.rect(g, x - w / 2 - 1, y - h + 4, w, h - 4, PAL.grave);
      D.rect(g, x - w / 2 - 1, y - h + 4, w, 1, PAL.graveL);
      D.rect(g, x - w / 2 + 1, y - h + 7, 3, 1, PAL.graveD);
      D.rect(g, x - w / 2 + 1, y - h + 10, 5, 1, PAL.graveD);
      D.rect(g, x + w / 2 - 3, y - 2, 4, 2, PAL.graveD);
    }
    // 底部泥土
    D.rect(g, x - w / 2 - 1, y - 1, w + 2, 1, PAL.dirtD);
  },

  drawDeadTree(g, x, y, h, s) {
    const tw = Math.max(2, Math.round(3 * s));
    D.rect(g, x - tw / 2, y - h, tw, h, PAL.trunk);
    D.rect(g, x - tw / 2, y - h, 1, h, PAL.trunkL);
    const branch = (bx, by, ang, len, depth) => {
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      D.line(g, bx, by, ex, ey, depth > 1 ? PAL.trunk : PAL.trunkL, depth > 1 ? 2 : 1);
      if (depth > 0) {
        branch(ex, ey, ang - U.rand(0.35, 0.8), len * 0.62, depth - 1);
        branch(ex, ey, ang + U.rand(0.35, 0.8), len * 0.62, depth - 1);
      }
    };
    branch(x, y - h, -Math.PI / 2 + U.rand(-0.25, 0.25), h * 0.34, 2);
    branch(x, y - h * 0.72, -Math.PI / 2 - U.rand(0.6, 1.0), h * 0.3, 1);
    D.rect(g, x - 2, y - 2, 4, 2, PAL.trunk);
  },

  drawFence(g, x, y, n) {
    for (let i = 0; i < n; i++) {
      const px = x + i * 9;
      D.rect(g, px, y - 14, 1, 14, PAL.stone);
      D.rect(g, px, y - 16, 1, 2, PAL.stoneHi);
    }
    D.rect(g, x, y - 12, (n - 1) * 9 + 1, 1, PAL.stoneL);
    D.rect(g, x, y - 5, (n - 1) * 9 + 1, 1, PAL.stoneL);
  },

  drawVine(g, x, y, s) {
    let cx = x, cy = y;
    const len = 14 * s;
    for (let i = 0; i < len; i += 2) {
      D.rect(g, cx, cy, 1, 2, PAL.leaf);
      if (i % 4 === 0) D.rect(g, cx + 1, cy + 1, 1, 1, PAL.leafL);
      cx += U.hash(i, y) > 0.5 ? 1 : -1;
      cy += 2;
    }
  },
};

Object.assign(World, WorldTerrain);
