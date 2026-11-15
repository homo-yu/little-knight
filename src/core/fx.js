'use strict';

// ============================================================
//  特效系统：粒子 / 环 / 斩击弧 / 闪电 / 光柱 / 焦痕 / 灯源
// ============================================================

const FX = {
  parts: [],
  rings: [],
  blasts: [],
  crescents: [],
  bolts: [],
  beams: [],
  decals: [],
  lights: [],
  shakeAmt: 0,
  shakeX: 0, shakeY: 0,
  flashCol: '#ffffff',
  flashA: 0,
  flashDecay: 3,
  time: 0,
  MAXP: 1100,

  reset() {
    this.parts.length = 0;
    this.rings.length = 0;
    this.blasts.length = 0;
    this.crescents.length = 0;
    this.bolts.length = 0;
    this.beams.length = 0;
    this.decals.length = 0;
    this.lights.length = 0;
    this.shakeAmt = 0;
    this.flashA = 0;
  },

  // ---------- 生成 ----------
  particle(o) {
    if (this.parts.length >= this.MAXP) this.parts.shift();
    this.parts.push({
      x: o.x, y: o.y,
      vx: o.vx || 0, vy: o.vy || 0,
      life: o.life || 0.6, max: o.life || 0.6,
      size: o.size || 2,
      col: o.col || '#ffffff',
      col2: o.col2 || null,
      grav: o.grav == null ? 0 : o.grav,
      drag: o.drag == null ? 2 : o.drag,
      add: o.add !== false,
      shrink: o.shrink !== false,
      shape: o.shape || 'box',
      spin: o.spin || 0,
      ang: o.ang || 0
    });
  },

  // 爆发
  burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = o.dir != null
        ? o.dir + U.rand(-(o.spread || Math.PI), (o.spread || Math.PI))
        : U.rand(0, Math.PI * 2);
      const sp = U.rand(o.spdMin == null ? 30 : o.spdMin, o.spdMax == null ? 120 : o.spdMax);
      this.particle({
        x: x + U.rand(-(o.jitter || 0), (o.jitter || 0)),
        y: y + U.rand(-(o.jitter || 0), (o.jitter || 0)),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: U.rand((o.life || 0.5) * 0.6, (o.life || 0.5) * 1.4),
        size: U.rand(o.sizeMin == null ? 1 : o.sizeMin, o.sizeMax == null ? 3 : o.sizeMax),
        col: Array.isArray(o.col) ? U.pick(o.col) : (o.col || '#ffffff'),
        grav: o.grav == null ? 0 : o.grav,
        drag: o.drag == null ? 2.5 : o.drag,
        add: o.add !== false
      });
    }
  },

  ring(x, y, r0, r1, life, col, thick, add) {
    this.rings.push({ x, y, r0, r1, t: 0, life, col, thick: thick || 2, add: add !== false });
  },

  // 光爆：实心圆快速扩散淡出
  blast(x, y, r0, r1, life, col, a) {
    this.blasts.push({ x, y, r0, r1, t: 0, life, col, a: a == null ? 0.8 : a });
  },

  crescent(x, y, r, a0, a1, thick, col, life, sweep) {
    this.crescents.push({ x, y, r, a0, a1, thick, col, t: 0, life, sweep: sweep !== false });
  },

  bolt(x0, y0, x1, y1, col, life, o) {    o = o || {};
    const pts = [];
    const len = Math.max(1, U.dist(x0, y0, x1, y1));
    const n = Math.max(3, Math.round(len / 7));
    const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    const amp = o.amp == null ? 7 : o.amp;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const off = (i === 0 || i === n) ? 0 : U.rand(-amp, amp) * (0.35 + 0.65 * Math.sin(Math.PI * t));
      pts.push({ x: U.lerp(x0, x1, t) + nx * off, y: U.lerp(y0, y1, t) + ny * off });
    }
    const branches = [];
    const bn = o.branches == null ? 2 : o.branches;
    for (let b = 0; b < bn; b++) {
      const i = U.randInt(1, n - 1);
      const p = pts[i];
      const dir = U.rand(0, Math.PI * 2);
      const bl = U.rand(8, 26);
      const sub = [];
      const m = 4;
      let sx = p.x, sy = p.y;
      for (let k = 0; k < m; k++) {
        const a = dir + U.rand(-0.6, 0.6);
        sx += Math.cos(a) * (bl / m);
        sy += Math.sin(a) * (bl / m);
        sub.push({ x: sx, y: sy });
      }
      branches.push(sub);
    }
    this.bolts.push({ pts, branches, col, t: 0, life: life || 0.14, jitter: o.jitter == null ? 1.6 : o.jitter });
  },

  beam(x, y, ang, len, w, col, life) {
    this.beams.push({ x, y, ang, len, w: w || 2, col, t: 0, life: life || 0.25 });
  },

  decal(x, y, w, h, col, life) {
    this.decals.push({ x, y, w, h, col, t: 0, life: life || 6 });
  },

  light(x, y, r, col, a, life) {
    if (this.lights.length > 60) this.lights.shift();
    this.lights.push({ x, y, r, col, a: a == null ? 1 : a, t: 0, life: life || 0.2, src: null });
  },
  lightOn(src, dx, dy, r, col, a, life) {
    if (this.lights.length > 60) this.lights.shift();
    this.lights.push({ x: 0, y: 0, dx, dy, r, col, a: a == null ? 1 : a, t: 0, life: life || 0.4, src });
  },

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); },
  flash(col, a, decay) {
    this.flashCol = col;
    this.flashA = Math.max(this.flashA, a);
    this.flashDecay = decay || 6;
  },

  // ---------- 更新 ----------
  update(dt) {
    this.time += dt;

    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t >= r.life) this.rings.splice(i, 1);
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.t += dt;
      if (b.t >= b.life) this.blasts.splice(i, 1);
    }
    for (let i = this.crescents.length - 1; i >= 0; i--) {
      const c = this.crescents[i];
      c.t += dt;
      if (c.t >= c.life) this.crescents.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt;
      if (b.t >= b.life) this.bolts.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t += dt;
      if (b.t >= b.life) this.beams.splice(i, 1);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.t += dt;
      if (d.t >= d.life) this.decals.splice(i, 1);
    }
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      l.t += dt;
      if (l.t >= l.life) this.lights.splice(i, 1);
    }

    this.updateShake(dt);

    this.flashA = Math.max(0, this.flashA - this.flashDecay * dt);
  },

  // 只更新抖动（顿帧期间世界冻结，但抖动要继续跑）
  updateShake(dt) {
    this.shakeAmt = U.damp(this.shakeAmt, 0, 6.5, dt);
    if (this.shakeAmt < 0.12) this.shakeAmt = 0;
    const s = this.shakeAmt;
    this.shakeX = s > 0 ? U.rand(-s, s) : 0;
    this.shakeY = s > 0 ? U.rand(-s, s) : 0;
  },

  // ---------- 绘制（世界坐标） ----------
  drawDecals(g) {
    for (const d of this.decals) {
      const k = 1 - d.t / d.life;
      g.globalAlpha = Math.min(1, k * 1.6) * 0.75;
      g.fillStyle = d.col;
      g.fillRect(Math.round(d.x - d.w / 2), Math.round(d.y - d.h / 2), Math.round(d.w), Math.round(d.h));
      g.globalAlpha = 1;
    }
  },

  draw(g) {
    // 普通混合（烟尘）先画
    let hasNorm = false;
    for (const p of this.parts) if (!p.add) { hasNorm = true; break; }
    if (hasNorm) {
      for (const p of this.parts) {
        if (p.add) continue;
        const k = U.clamp(p.life / p.max, 0, 1);
        const sz = p.shrink ? Math.max(1, p.size * (0.35 + 0.65 * k)) : p.size;
        g.globalAlpha = Math.min(1, k * 1.4) * 0.55;
        D.rect(g, p.x - sz / 2, p.y - sz / 2, sz, sz, p.col);
      }
      g.globalAlpha = 1;
    }

    g.globalCompositeOperation = 'lighter';

    // 发光粒子
    for (const p of this.parts) {
      if (!p.add) continue;
      const k = U.clamp(p.life / p.max, 0, 1);
      const sz = p.shrink ? Math.max(1, p.size * (0.25 + 0.75 * k)) : p.size;
      if (p.shape === 'snow') {
        D.snow(g, p.x, p.y, sz, p.col);
        continue;
      }
      if (p.size >= 2) D.glow(g, p.x, p.y, sz * 3.2 + 3, p.col, 0.34 * k);
      D.rect(g, p.x - sz / 2, p.y - sz / 2, sz, sz, p.col);
      if (p.col2 && k > 0.5) D.rect(g, p.x - sz / 4, p.y - sz / 4, Math.max(1, sz / 2), Math.max(1, sz / 2), p.col2);
    }

    // 光爆
    for (const b of this.blasts) {
      const k = b.t / b.life;
      const rad = U.lerp(b.r0, b.r1, U.easeOutCubic(k));
      g.globalAlpha = (1 - k) * b.a;
      D.disc(g, b.x, b.y, rad, b.col);
      g.globalAlpha = 1;
    }

    // 环
    for (const r of this.rings) {
      const k = r.t / r.life;
      const rad = U.lerp(r.r0, r.r1, U.easeOutCubic(k));
      const a = (1 - k);
      g.globalAlpha = a;
      D.glow(g, r.x, r.y, rad * 1.25 + 6, r.col, 0.16 * a);
      D.circle(g, r.x, r.y, rad, r.col, Math.max(1, Math.round(r.thick * (1 - k * 0.6))));
      g.globalAlpha = 1;
    }

    // 斩击弧（普通混合，避免叠加过曝成白色）
    g.globalCompositeOperation = 'source-over';
    for (const c of this.crescents) {
      const k = Math.min(1, c.t / c.life);
      const fade = 1 - k;
      const span = c.a1 - c.a0;
      // 前 45% 生命扫完，之后逐渐变淡
      const sw = U.easeOutCubic(Math.min(1, c.t / (c.life * 0.45)));
      const a0 = c.a0;
      const a1 = c.a0 + span * sw;
      const r = c.r * (1 + k * 0.05);
      g.globalAlpha = fade;
      D.crescent(g, c.x, c.y, r, a0, a1, Math.max(2, c.thick * (1 - k * 0.3)), c.col, true);
      D.crescent(g, c.x, c.y, r - 1, a0, a1, 1, '#ffffff', true);
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'lighter';
    // 弧的光晕
    for (const c of this.crescents) {
      const k = Math.min(1, c.t / c.life);
      const fade = 1 - k;
      g.globalAlpha = fade * 0.5;
      D.glow(g, c.x, c.y, c.r * 0.9, c.col, 0.3 * fade);
      g.globalAlpha = 1;
    }

    // 闪电
    for (const b of this.bolts) {
      const k = 1 - b.t / b.life;
      const jx = () => U.rand(-b.jitter, b.jitter);
      const jy = () => U.rand(-b.jitter, b.jitter);
      g.globalAlpha = Math.min(1, k * 1.6);
      const pts = b.pts;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i], p1 = pts[i + 1];
        D.glow(g, p0.x, p0.y, 22, b.col, 0.30 * k);
        D.line(g, p0.x + jx(), p0.y + jy(), p1.x + jx(), p1.y + jy(), b.col, 4);
        D.line(g, p0.x + jx(), p0.y + jy(), p1.x + jx(), p1.y + jy(), '#ffffff', 2);
      }
      for (const br of b.branches) {
        for (let i = 0; i < br.length - 1; i++) {
          D.line(g, br[i].x + jx(), br[i].y + jy(), br[i + 1].x + jx(), br[i + 1].y + jy(), b.col, 2);
        }
      }
      g.globalAlpha = 1;
    }

    // 光柱
    for (const b of this.beams) {
      const k = 1 - b.t / b.life;
      const ex = b.x + Math.cos(b.ang) * b.len;
      const ey = b.y + Math.sin(b.ang) * b.len;
      g.globalAlpha = k * 0.85;
      D.glow(g, (b.x + ex) / 2, (b.y + ey) / 2, b.len * 0.55, b.col, 0.18 * k);
      D.line(g, b.x, b.y, ex, ey, b.col, Math.max(1, b.w * (0.4 + 0.6 * k)));
      D.line(g, b.x, b.y, ex, ey, '#ffffff', 1);
      g.globalAlpha = 1;
    }

    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
};
