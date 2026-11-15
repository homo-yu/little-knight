'use strict';

// ============================================================
//  元素：火 / 雷 / 光
//  三种魔法石 —— 释放(W) / 元素剑技(蓄力左键+W) / 附魔投矛(蓄力左键+W后扔出)
// ============================================================

const EL = {
  fire: {
    key: 'fire', name: '火', cd: 5,
    core: '#fff4d2', hot: '#ffc061', mid: '#ff7a24', deep: '#c22f0c',
    glow: '#ff8c2e', lightCol: '#ff9a3c',
    stone: '#ff7a24', stoneHi: '#ffd27a', stoneLo: '#8a2408'
  },
  lightning: {
    key: 'lightning', name: '雷', cd: 5,
    core: '#ffffff', hot: '#d9f7ff', mid: '#6fd2ff', deep: '#2f6fe0',
    glow: '#8fe6ff', lightCol: '#7fd0ff',
    stone: '#a273f0', stoneHi: '#e2ccff', stoneLo: '#4a1f86'
  },
  light: {
    key: 'light', name: '光', cd: 5,
    core: '#fffdf0', hot: '#fff0b0', mid: '#ffd75e', deep: '#d99b23',
    glow: '#ffe27a', lightCol: '#ffe08a',
    stone: '#ffe08a', stoneHi: '#fffdf0', stoneLo: '#a87a20'
  },
  ice: {
    key: 'ice', name: '冰', cd: 5,
    core: '#ffffff', hot: '#cfeaff', mid: '#7fc4ef', deep: '#2f6fae',
    glow: '#a8dcff', lightCol: '#bfe6ff',
    stone: '#bfe6ff', stoneHi: '#ffffff', stoneLo: '#3f7ea8'
  },
  water: {
    key: 'water', name: '水', cd: 5,
    core: '#eaf8ff', hot: '#9fd8f5', mid: '#4a9fd8', deep: '#1d5f96',
    glow: '#6fc0f0', lightCol: '#7fd0ff',
    stone: '#0d2338', stoneHi: '#2f7fb8', stoneLo: '#050c14'
  },
  wind: {
    key: 'wind', name: '风', cd: 4,
    core: '#f2fff6', hot: '#c8f0d8', mid: '#7fd8a8', deep: '#2e8a63',
    glow: '#9fe8c0', lightCol: '#bff0d0', noAttach: true,
    stone: '#6fe0a0', stoneHi: '#d8ffe8', stoneLo: '#1d6b45'
  }
};

const Magic = {
  projectiles: [],
  tornadoes: [],

  reset() { this.projectiles.length = 0; this.tornadoes.length = 0; },

  // 剑蓄力 + 风：打出一个向前移动的龙卷风（可被火/水染色）
  spawnTornado(px, py, dir, charge) {
    const gy = py;
    // 前进距离 = 一次冲刺的距离，冲完就停在原地转
    const dashDist = PH.dashSpeed * PH.dashTime;
    this.tornadoes.push({
      x: px,
      y: gy,
      vx: dir * 230,
      dir: dir,
      t: 0,
      life: 6.0,
      el: null,
      h: 46 + charge * 30,
      chg: charge,
      remain: dashDist,
      stopped: false
    });
    const c = EL.wind;
    FX.burst(px, gy - 12, 18, {
      spread: Math.PI, spdMin: 40, spdMax: 160, life: 0.5, sizeMin: 1, sizeMax: 3,
      col: [c.core, c.hot, c.mid], grav: -20, drag: 2
    });
    FX.ring(px, gy - 8, 4, 30, 0.3, c.hot, 2);
    FX.shake(2.5);
  },

  update(dt) {
    const P = this.projectiles;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.grav || 0) * dt;

      // 拖尾
      if (p.kind === 'fireball') {
        for (let k = 0; k < 2; k++) {
          FX.particle({
            x: p.x + U.rand(-2, 2), y: p.y + U.rand(-2, 2),
            vx: -p.vx * 0.06 + U.rand(-16, 16),
            vy: -p.vy * 0.06 + U.rand(-24, 6),
            life: U.rand(0.18, 0.4), size: U.rand(1, 3),
            col: U.chance(0.4) ? '#ffe6a0' : (U.chance(0.5) ? '#ff8c2e' : '#c22f0c'),
            grav: -30, drag: 3
          });
        }
      } else if (p.kind === 'ice' || p.kind === 'water') {
        const c = EL[p.el];
        if (U.chance(0.8)) {
          FX.particle({
            x: p.x + U.rand(-2, 2), y: p.y + U.rand(-2, 2),
            vx: -p.vx * 0.05 + U.rand(-12, 12),
            vy: -p.vy * 0.05 + U.rand(-16, 4),
            life: U.rand(0.15, 0.35), size: U.rand(1, 2),
            col: U.chance(0.5) ? c.hot : c.mid, grav: p.kind === 'ice' ? 40 : 120, drag: 3
          });
        }
      }

      const hitSolid = typeof World !== 'undefined' && World.pointSolid(p.x, p.y);
      if (hitSolid || p.t >= p.life) {
        this.impact(p.x, p.y, p.el);
        P.splice(i, 1);
      }
    }
    this.updateTornadoes(dt);
  },

  updateTornadoes(dt) {
    const L = this.tornadoes;
    for (let i = L.length - 1; i >= 0; i--) {
      const tw = L[i];
      tw.t += dt;
      if (!tw.stopped) {
        tw.x += tw.vx * dt;
        tw.remain -= Math.abs(tw.vx) * dt;
        if (tw.remain <= 0) {
          tw.stopped = true;
          tw.vx = 0;
          tw.x += tw.dir * Math.max(0, tw.remain);   // 补齐最后一点
          tw.remain = 0;
          FX.ring(tw.x, tw.y - tw.h * 0.35, 6, 30, 0.3, EL.wind.hot, 2);
        }
      }

      // 撞墙 → 消散
      if (typeof World !== 'undefined' && World.pointSolid(tw.x + Math.sign(tw.vx) * 12, tw.y - 24)) {
        this.killTornado(tw, i);
        continue;
      }

      const c = tw.el ? EL[tw.el] : EL.wind;

      // 染色：吞掉火/水/冰弹
      for (let k = this.projectiles.length - 1; k >= 0; k--) {
        const p = this.projectiles[k];
        if (Math.abs(p.x - tw.x) < 26 && Math.abs(p.y - (tw.y - tw.h * 0.4)) < tw.h * 0.7) {
          if (!tw.el) {
            tw.el = p.el;
            if (typeof Game !== 'undefined' && Game.onReaction) {
              const nm = { fire: '火焰旋风', water: '水龙卷', ice: '冰旋风' };
              Game.onReaction('风 + ' + EL[p.el].name + ' · ' + nm[p.el], tw.x, tw.y);
            }
            FX.flash(U.hexA(EL[p.el].lightCol, 0.4), 0.2, 6);
            FX.ring(tw.x, tw.y - tw.h * 0.4, 6, 44, 0.4, EL[p.el].hot, 2);
          }
          this.projectiles.splice(k, 1);
        }
      }
      // 染色：路过扎在场上的元素长矛
      if (!tw.el && typeof Game !== 'undefined' && Game.player && Game.player.spear) {
        const sp = Game.player.spear;
        if (sp.state === 'stuck' && sp.el && ['fire', 'water', 'ice'].indexOf(sp.el) >= 0
            && Math.abs(sp.x - tw.x) < 32 && Math.abs(sp.y - (tw.y - tw.h * 0.4)) < tw.h) {
          tw.el = sp.el;
          const nc = EL[sp.el];
          FX.ring(tw.x, tw.y - tw.h * 0.4, 6, 42, 0.4, nc.hot, 2);
          if (typeof Game.onReaction === 'function') {
            Game.onReaction('龙卷风吞下了' + nc.name + '元素', tw.x, tw.y);
          }
        }
      }

      // 染色：路过水路径
      if (!tw.el && typeof World !== 'undefined') {
        for (const pa of World.paths) {
          if (pa.el === 'water' && Math.abs(pa.x - tw.x) < pa.w * 0.5 + 14) {
            tw.el = 'water';
            FX.ring(tw.x, tw.y - tw.h * 0.4, 6, 40, 0.4, EL.water.hot, 2);
            break;
          }
        }
      }

      // 被雷点着：火旋风→大爆炸，水旋风→大范围麻痹；旋风结束
      if (tw.el && typeof World !== 'undefined') {
        let killed = false;
        for (const im of World.impacts) {
          if (im.el !== 'lightning') continue;
          if (Math.abs(im.x - tw.x) < 46 && Math.abs(im.y - (tw.y - tw.h * 0.4)) < tw.h) {
            if (tw.el === 'fire' && World.boom) World.boom(tw.x, tw.y - tw.h * 0.4);
            else if (World.shock) World.shock(tw.x, tw.y - tw.h * 0.4);
            else if (World.boom) World.boom(tw.x, tw.y - tw.h * 0.4);
            FX.flash(U.hexA(c.lightCol, 0.5), 0.4, 5);
            FX.shake(10);
            this.killTornado(tw, i);
            killed = true;
            break;
          }
        }
        if (killed) continue;
      }

      // 粒子
      for (let k = 0; k < 3; k++) {
        const u = Math.random();
        const a = tw.t * 11 + u * 7;
        const r = (11 - u * 5) + Math.sin(tw.t * 9 + u * 5) * 2;
        FX.particle({
          x: tw.x + Math.cos(a) * r,
          y: tw.y - u * tw.h,
          vx: Math.cos(a + 1.5) * 90 + tw.vx * 0.4,
          vy: -U.rand(20, 70),
          life: U.rand(0.25, 0.5), size: U.rand(1, 2),
          col: U.chance(0.5) ? c.core : c.hot, grav: -10, drag: 1.6
        });
      }
      if (U.chance(0.4)) FX.light(tw.x, tw.y - tw.h * 0.45, 70, c.lightCol, 0.7, 0.12);

      if (tw.t >= tw.life) this.killTornado(tw, i);
    }
  },

  killTornado(tw, idx) {
    const c = tw.el ? EL[tw.el] : EL.wind;
    FX.burst(tw.x, tw.y - tw.h * 0.4, 22, {
      spread: Math.PI, spdMin: 30, spdMax: 180, life: 0.6, sizeMin: 1, sizeMax: 3,
      col: [c.core, c.hot, c.mid], grav: -10, drag: 1.8
    });
    FX.ring(tw.x, tw.y - tw.h * 0.4, 6, 46 * (0.6 + tw.chg), 0.4, c.hot, 2);
    this.tornadoes.splice(idx, 1);
  },

  impact(x, y, el) {
    if (el === 'fire') this.explode(x, y, 'fire');
    else if (el === 'ice') this.iceBurst(x, y);
    else if (el === 'water') this.waterSplash(x, y);
  },

  iceBurst(x, y) {
    const c = EL.ice;
    FX.burst(x, y, 18, {
      dir: -Math.PI / 2, spread: 1.5, spdMin: 40, spdMax: 190, jitter: 3,
      life: 0.5, sizeMin: 1, sizeMax: 3,
      col: [c.core, c.hot, c.mid], grav: 220, drag: 2
    });
    FX.blast(x, y, 2, 14, 0.14, '#ffffff', 0.6);
    FX.ring(x, y, 2, 20, 0.26, c.hot, 2);
    FX.light(x, y, 60, c.lightCol, 0.9, 0.3);
    FX.flash('#dff4ff', 0.12, 8);
    FX.shake(2.5);
    if (typeof World !== 'undefined') World.applyElementHit(x, y, 18, 'ice');
  },

  waterSplash(x, y) {
    const c = EL.water;
    for (let i = 0; i < 20; i++) {
      FX.particle({
        x: x + U.rand(-3, 3), y: y + U.rand(-3, 3),
        vx: U.rand(-110, 110), vy: U.rand(-170, -20),
        life: U.rand(0.4, 0.9), size: U.rand(1, 3),
        col: U.chance(0.5) ? c.core : (U.chance(0.5) ? c.hot : c.mid),
        grav: 420, drag: 1.2
      });
    }
    FX.ring(x, y, 2, 24, 0.3, c.hot, 2);
    FX.light(x, y, 60, c.lightCol, 0.8, 0.35);
    FX.shake(1.6);
    if (typeof World !== 'undefined') World.applyElementHit(x, y, 20, 'water');
  },

  drawProjectiles(g) {
    for (const p of this.projectiles) {
      const c = EL[p.el];
      g.globalCompositeOperation = 'lighter';
      D.glow(g, p.x, p.y, 16, c.glow, 0.34);
      D.glow(g, p.x, p.y, 7, c.hot, 0.4);
      g.globalCompositeOperation = 'source-over';
      if (p.kind === 'ice') {
        // 冰锥：菱形
        const ang = Math.atan2(p.vy, p.vx);
        const dx = Math.cos(ang), dy = Math.sin(ang);
        D.line(g, p.x - dx * 7, p.y - dy * 7, p.x + dx * 4, p.y + dy * 4, c.deep, 3);
        D.line(g, p.x - dx * 6, p.y - dy * 6, p.x + dx * 4, p.y + dy * 4, c.mid, 2);
        D.line(g, p.x - dx * 6, p.y - dy * 6, p.x + dx * 3, p.y + dy * 3, c.core, 1);
        D.rect(g, p.x + dx * 4, p.y + dy * 4, 1, 1, '#ffffff');
      } else if (p.kind === 'water') {
        D.disc(g, p.x, p.y, 5, c.deep);
        D.disc(g, p.x, p.y, 4, c.mid);
        D.disc(g, p.x - 1, p.y - 1, 2, c.hot);
        D.disc(g, p.x - 1, p.y - 1, 1, c.core);
      } else {
        D.disc(g, p.x, p.y, 5, c.deep);
        D.disc(g, p.x, p.y, 4, c.mid);
        D.disc(g, p.x - 0.5, p.y - 0.6, 2.6, c.hot);
        D.disc(g, p.x - 0.5, p.y - 0.6, 1.3, c.core);
      }
    }
    for (const tw of this.tornadoes) this.drawTornado(g, tw);
  },

  drawTornado(g, tw) {
    const c = tw.el ? EL[tw.el] : EL.wind;
    const h = tw.h;
    g.globalCompositeOperation = 'lighter';
    D.glow(g, tw.x, tw.y - h * 0.45, h * 0.5, c.lightCol, 0.16);
    g.globalCompositeOperation = 'source-over';

    // 一圈圈的漏斗（加密）：上大下小
    const bands = 20;
    for (let j = 0; j < bands; j++) {
      const u = j / (bands - 1);          // 0 = 底部，1 = 顶部
      const yy = tw.y - u * h;
      const r = 3.5 + u * 11 + Math.sin(tw.t * 10 + u * 7) * 1.2;
      const spin = tw.t * 9 + u * 5;
      // 每层两道环，错开半个周期
      for (let k = 0; k < 2; k++) {
        const so = k * Math.PI;
        const rr = r + k * 1.6;
        D.arc(g, tw.x, yy, rr, spin + so - Math.PI * 0.78, spin + so - Math.PI * 0.22, c.mid, 1);
        D.arc(g, tw.x, yy, rr - 1, spin + so - Math.PI * 0.62, spin + so - Math.PI * 0.3, c.core, 1);
      }
      D.arc(g, tw.x, yy, r + 2.4, spin + Math.PI * 0.2, spin + Math.PI * 0.8, c.deep, 1);
    }
    // 底部尘卷（细底）
    for (let i = 0; i < 8; i++) {
      const a = tw.t * 11 + i * 0.8;
      const r = 4 + (i % 3) * 2.5;
      D.rect(g, tw.x + Math.cos(a) * r, tw.y - 1 + Math.sin(a) * 1.4, 2, 1,
        U.chance(0.5) ? c.hot : c.mid);
    }
    // 立柱核心
    g.globalAlpha = 0.35;
    D.line(g, tw.x, tw.y - 2, tw.x, tw.y - h, c.core, 1);
    g.globalAlpha = 1;
  },

  // ---------------------------------------------------------
  //  W —— 直接释放魔法
  // ---------------------------------------------------------
  cast(elKey, px, py, tx, ty) {
    const c = EL[elKey];
    const a = Math.atan2(ty - py, tx - px);

    if (elKey === 'fire') {
      const hx = px + Math.cos(a) * 9, hy = py + Math.sin(a) * 9;
      this.projectiles.push({
        kind: 'fireball', el: 'fire', x: hx, y: hy,
        vx: Math.cos(a) * 250, vy: Math.sin(a) * 250,
        t: 0, life: 1.15, grav: 40
      });
      FX.light(hx, hy, 40, c.lightCol, 1, 0.12);
      FX.burst(hx, hy, 10, {
        dir: a, spread: 0.8, spdMin: 20, spdMax: 90,
        life: 0.3, sizeMin: 1, sizeMax: 3,
        col: [c.core, c.mid, c.hot], grav: -60, drag: 4
      });
      FX.shake(1.2);
    }

    if (elKey === 'ice') {
      const hx = px + Math.cos(a) * 9, hy = py + Math.sin(a) * 9;
      this.projectiles.push({
        kind: 'ice', el: 'ice', x: hx, y: hy,
        vx: Math.cos(a) * 470, vy: Math.sin(a) * 470,
        t: 0, life: 0.9, grav: 40
      });
      FX.light(hx, hy, 34, c.lightCol, 0.9, 0.14);
      FX.burst(hx, hy, 8, {
        dir: a, spread: 0.6, spdMin: 20, spdMax: 90, life: 0.25, sizeMin: 1, sizeMax: 2,
        col: [c.core, c.hot, c.mid], grav: 60, drag: 3
      });
      FX.shake(1.2);
    }

    if (elKey === 'water') {
      const hx = px + Math.cos(a) * 9, hy = py + Math.sin(a) * 9;
      this.projectiles.push({
        kind: 'water', el: 'water', x: hx, y: hy,
        vx: Math.cos(a) * 300, vy: Math.sin(a) * 300 - 40,
        t: 0, life: 1.4, grav: 260
      });
      FX.light(hx, hy, 34, c.lightCol, 0.9, 0.14);
      FX.burst(hx, hy, 8, {
        dir: a, spread: 0.7, spdMin: 20, spdMax: 80, life: 0.3, sizeMin: 1, sizeMax: 2,
        col: [c.core, c.hot, c.mid], grav: 120, drag: 2.5
      });
    }

    if (elKey === 'wind') {
      for (let i = 0; i < 14; i++) {
        const ang = a + U.rand(-1.4, 1.4);
        const r = U.rand(6, 22);
        FX.particle({
          x: px + Math.cos(ang) * r, y: py + Math.sin(ang) * r,
          vx: Math.cos(a) * U.rand(120, 260), vy: Math.sin(a) * U.rand(120, 260) - 20,
          life: U.rand(0.2, 0.45), size: 1,
          col: U.chance(0.5) ? c.core : c.hot, drag: 3
        });
      }
      FX.ring(px, py, 4, 26, 0.28, c.hot, 1);
      FX.shake(1.4);
    }

    if (elKey === 'lightning') {
      const d = Math.min(165, U.dist(px, py, tx, ty));
      const ex = px + Math.cos(a) * d, ey = py + Math.sin(a) * d;
      const hx = px + Math.cos(a) * 8, hy = py + Math.sin(a) * 8;
      FX.bolt(hx, hy, ex, ey, c.mid, 0.22, { amp: 9, branches: 3, jitter: 2 });
      FX.bolt(hx, hy, ex, ey, c.core, 0.1, { amp: 5, branches: 0, jitter: 1 });
      for (let i = 0; i < 3; i++) {
        const t = U.rand(0.15, 0.95);
        FX.light(U.lerp(hx, ex, t), U.lerp(hy, ey, t), 34, c.lightCol, 0.9, 0.1);
      }
      FX.light(ex, ey, 60, c.lightCol, 1, 0.25);
      FX.burst(ex, ey, 24, {
        dir: a, spread: Math.PI, spdMin: 40, spdMax: 190,
        life: 0.45, sizeMin: 1, sizeMax: 2,
        col: [c.core, c.mid, c.hot], grav: 160, drag: 2.5
      });
      FX.blast(ex, ey, 3, 20, 0.18, '#ffffff', 0.75);
      FX.blast(ex, ey, 5, 30, 0.26, c.hot, 0.45);
      FX.ring(ex, ey, 3, 24, 0.26, c.mid, 2);
      FX.ring(ex, ey, 3, 15, 0.18, c.core, 1);
      FX.flash('#dff4ff', 0.38, 7);
      FX.shake(4.5);
      if (typeof World !== 'undefined') World.applyElementHit(ex, ey, 24, 'lightning');
    }

    if (elKey === 'light') {
      const d = Math.min(150, U.dist(px, py, tx, ty));
      const ex = px + Math.cos(a) * d, ey = py + Math.sin(a) * d;
      const hx = px + Math.cos(a) * 8, hy = py + Math.sin(a) * 8;

      FX.beam(hx, hy, a, d, 4, c.mid, 0.22);
      FX.light(ex, ey, 80, c.lightCol, 1, 0.5);
      FX.light(hx, hy, 44, c.lightCol, 0.9, 0.3);
      // 目标处的圣光柱
      for (let i = 0; i < 7; i++) {
        const ang = -Math.PI / 2 + U.rand(-0.9, 0.9);
        const len = U.rand(20, 54);
        FX.beam(ex, ey, ang, len, U.rand(1, 3), U.chance(0.5) ? c.mid : c.hot, U.rand(0.2, 0.38));
      }
      FX.blast(ex, ey, 4, 28, 0.34, c.hot, 0.5);
      FX.blast(ex, ey, 2, 14, 0.2, '#ffffff', 0.7);
      FX.ring(ex, ey, 2, 30, 0.42, c.hot, 2);
      FX.ring(ex, ey, 2, 46, 0.6, c.mid, 1);
      FX.ring(ex, ey, 1, 18, 0.3, c.core, 2);
      for (let i = 0; i < 22; i++) {
        const ang = U.rand(0, Math.PI * 2);
        const r = U.rand(2, 20);
        FX.particle({
          x: ex + Math.cos(ang) * r, y: ey + Math.sin(ang) * r,
          vx: Math.cos(ang) * U.rand(10, 60), vy: Math.sin(ang) * U.rand(10, 60) - 26,
          life: U.rand(0.4, 1.0), size: U.rand(1, 2),
          col: U.chance(0.4) ? c.core : (U.chance(0.6) ? c.hot : c.mid),
          grav: -18, drag: 1.6
        });
      }
      FX.flash('#fff4cf', 0.22, 5);
      FX.shake(2);
      if (typeof World !== 'undefined') World.applyElementHit(ex, ey, 30, 'light');
    }
  },

  // 火焰弹爆炸
  explode(x, y, el) {
    const c = EL[el] || EL.fire;
    FX.burst(x, y, 30, {
      spread: Math.PI, spdMin: 30, spdMax: 190, jitter: 3,
      life: 0.55, sizeMin: 1, sizeMax: 4,
      col: [c.core, c.hot, c.mid, c.deep], grav: -70, drag: 3
    });
    FX.burst(x, y, 12, {
      spread: Math.PI, spdMin: 60, spdMax: 240, jitter: 2,
      life: 0.35, sizeMin: 1, sizeMax: 2,
      col: [c.core, c.hot], grav: 120, drag: 2.4, add: true
    });
    FX.blast(x, y, 4, 26, 0.22, c.hot, 0.6);
    FX.blast(x, y, 2, 14, 0.16, '#ffffff', 0.7);
    FX.ring(x, y, 3, 30, 0.34, c.mid, 3);
    FX.ring(x, y, 2, 18, 0.22, c.core, 2);
    FX.light(x, y, 110, c.lightCol, 1, 0.55);
    FX.flash('#ff9a3c', 0.16, 6);
    FX.shake(4);
    FX.decal(x, y - 1, 20, 7, '#150d07', 9);
    // 余烬
    for (let i = 0; i < 10; i++) {
      FX.particle({
        x: x + U.rand(-8, 8), y: y + U.rand(-4, 2),
        vx: U.rand(-14, 14), vy: U.rand(-46, -18),
        life: U.rand(0.5, 1.1), size: U.rand(1, 2),
        col: U.chance(0.4) ? c.core : c.mid, grav: -20, drag: 1.2
      });
    }
    if (typeof World !== 'undefined') World.applyElementHit(x, y, 26, el);
  },

  // ---------------------------------------------------------
  //  元素剑技 —— 蓄力越久，刃越长越宽
  // ---------------------------------------------------------
  slash(x, y, ang, charge, elKey) {
    const c = elKey ? EL[elKey] : null;
    const r = 24 + charge * 26;
    const span = 1.5 + charge * 1.0;
    const a0 = ang - span / 2, a1 = ang + span / 2;
    const thick = 5 + charge * 7;

    if (!c) {
      // 物理斩
      FX.crescent(x, y, r, a0, a1, 2, '#dfe8f7', 0.16);
      FX.crescent(x, y, r - 2, a0, a1, 1, '#ffffff', 0.12);
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        const a = U.lerp(a0, a1, t);
        FX.particle({
          x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
          vx: Math.cos(a + 1.4) * U.rand(20, 70), vy: Math.sin(a + 1.4) * U.rand(20, 70),
          life: 0.18, size: 1, col: '#c9d6ea', drag: 3
        });
      }
      FX.shake(0.8 + charge * 1.2);
      return;
    }

    if (elKey === 'fire') {
      FX.crescent(x, y, r, a0, a1, thick, c.mid, 0.32);
      FX.crescent(x, y, r, a0, a1, Math.max(2, thick - 2), c.hot, 0.26);
      for (let i = 0; i < 16 + charge * 16; i++) {
        const t = U.rand(0.05, 0.95);
        const a = U.lerp(a0, a1, t);
        const rr = r + U.rand(-4, 5);
        FX.particle({
          x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr,
          vx: Math.cos(a) * U.rand(20, 90) + U.rand(-20, 20),
          vy: Math.sin(a) * U.rand(20, 90) - U.rand(10, 60),
          life: U.rand(0.25, 0.7), size: U.rand(1, 3),
          col: U.chance(0.35) ? c.core : (U.chance(0.5) ? c.hot : c.mid),
          grav: -60, drag: 2.6
        });
      }

      FX.light(x, y, 60 + charge * 30, c.lightCol, 1, 0.3);
      FX.flash('#ff8a2a', 0.1 + charge * 0.1, 7);
      FX.shake(2 + charge * 2);
      if (typeof World !== 'undefined') World.applyElementHit(x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.6, r * 0.7, 'fire');
    }

    if (elKey === 'lightning') {
      FX.crescent(x, y, r, a0, a1, Math.max(2, thick - 1), c.mid, 0.22);
      FX.crescent(x, y, r, a0, a1, 2, c.hot, 0.18);
      // 沿弧的电流分叉
      for (let i = 0; i < 4 + Math.round(charge * 3); i++) {
        const a = U.lerp(a0, a1, U.rand(0.05, 0.95));
        const r0 = r - U.rand(2, 8);
        const r1 = r + U.rand(6, 26);
        FX.bolt(
          x + Math.cos(a) * r0, y + Math.sin(a) * r0,
          x + Math.cos(a + U.rand(-0.3, 0.3)) * r1, y + Math.sin(a + U.rand(-0.3, 0.3)) * r1,
          c.mid, 0.12, { amp: 4, branches: 1, jitter: 1 }
        );
      }
      for (let i = 0; i < 14 + charge * 12; i++) {
        const a = U.lerp(a0, a1, U.rand(0, 1));
        FX.particle({
          x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
          vx: U.rand(-90, 90), vy: U.rand(-90, 90),
          life: U.rand(0.15, 0.45), size: 1,
          col: U.chance(0.5) ? c.core : c.mid, drag: 3
        });
      }

      FX.light(x, y, 70 + charge * 30, c.lightCol, 1, 0.22);
      FX.flash('#e6f7ff', 0.2 + charge * 0.16, 8);
      FX.shake(2.5 + charge * 2.5);
      if (typeof World !== 'undefined') World.applyElementHit(x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.6, r * 0.7, 'lightning');
    }

    if (elKey === 'ice') {
      // 冰：冻结月牙 + 雪花 + 冰屑
      FX.crescent(x, y, r, a0, a1, thick, c.mid, 0.34);
      FX.crescent(x, y, r, a0, a1, Math.max(2, thick - 2), c.hot, 0.28);
      for (let i = 0; i < 12 + Math.round(charge * 8); i++) {
        const a = U.lerp(a0, a1, U.rand(0, 1));
        const rr = r + U.rand(-5, 5);
        FX.particle({
          x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr,
          vx: Math.cos(a) * U.rand(15, 70), vy: Math.sin(a) * U.rand(10, 60) - 24,
          life: U.rand(0.5, 1.3), size: U.rand(2, 3),
          col: U.chance(0.4) ? '#ffffff' : c.hot, grav: 34, drag: 1.3, shape: 'snow'
        });
      }
      for (let i = 0; i < 16 + Math.round(charge * 12); i++) {
        const a = U.lerp(a0, a1, U.rand(0, 1));
        FX.particle({
          x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
          vx: Math.cos(a) * U.rand(40, 160), vy: Math.sin(a) * U.rand(40, 160),
          life: U.rand(0.25, 0.55), size: U.rand(1, 2),
          col: U.chance(0.5) ? c.core : c.mid, grav: 160, drag: 2.4
        });
      }
      FX.light(x, y, 80, c.lightCol, 1, 0.3);
      FX.flash('#e8f6ff', 0.12 + charge * 0.1, 7);
      FX.shake(2 + charge * 2);
      if (typeof World !== 'undefined') World.applyElementHit(x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.6, r * 0.7, 'ice');
    }

    if (elKey === 'water') {
      // 水：深蓝水刃 + 水珠
      FX.crescent(x, y, r, a0, a1, thick + 1, c.deep, 0.46);
      FX.crescent(x, y, r, a0, a1, Math.max(2, thick - 2), c.mid, 0.34);
      FX.crescent(x, y, r - 1, a0, a1, 1, c.hot, 0.22);
      for (let i = 0; i < 20 + Math.round(charge * 14); i++) {
        const a = U.lerp(a0, a1, U.rand(0, 1));
        const rr = r + U.rand(-6, 6);
        FX.particle({
          x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr,
          vx: Math.cos(a) * U.rand(20, 110), vy: Math.sin(a) * U.rand(20, 90) - 50,
          life: U.rand(0.3, 0.8), size: U.rand(1, 3),
          col: U.chance(0.5) ? c.core : (U.chance(0.5) ? c.hot : c.mid),
          grav: 320, drag: 1.4
        });
      }
      FX.light(x, y, 75, c.lightCol, 0.9, 0.3);
      FX.shake(1.8 + charge * 1.8);
      if (typeof World !== 'undefined') World.applyElementHit(x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.6, r * 0.7, 'water');
    }

    if (elKey === 'light') {
      FX.crescent(x, y, r + 1, a0, a1, thick + 2, c.mid, 0.34);
      FX.crescent(x, y, r, a0, a1, Math.max(2, thick), c.hot, 0.26);
      // 放射光线
      for (let i = 0; i < 6 + Math.round(charge * 5); i++) {
        const a = U.lerp(a0 - 0.3, a1 + 0.3, U.rand(0, 1));
        FX.beam(
          x + Math.cos(a) * (r * 0.5), y + Math.sin(a) * (r * 0.5),
          a, U.rand(14, 34 + charge * 26), 1,
          U.chance(0.5) ? c.hot : c.core, U.rand(0.14, 0.3)
        );
      }
      for (let i = 0; i < 18 + charge * 12; i++) {
        const a = U.lerp(a0, a1, U.rand(0, 1));
        FX.particle({
          x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
          vx: Math.cos(a) * U.rand(20, 80), vy: Math.sin(a) * U.rand(20, 80) - 20,
          life: U.rand(0.3, 0.8), size: U.rand(1, 2),
          col: U.chance(0.5) ? c.core : c.hot, grav: -22, drag: 2
        });
      }

      FX.light(x, y, 90 + charge * 40, c.lightCol, 1, 0.36);
      FX.flash('#fff6d8', 0.16 + charge * 0.14, 6);
      FX.shake(1.6 + charge * 1.8);
      if (typeof World !== 'undefined') World.applyElementHit(x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.6, r * 0.7, 'light');
    }
  },

  // ---------------------------------------------------------
  //  投矛命中 / 附魔投矛命中
  // ---------------------------------------------------------
  spearImpact(x, y, ang, elKey) {
    if (!elKey) {
      FX.burst(x, y, 8, {
        dir: ang, spread: 0.9, spdMin: 20, spdMax: 80,
        life: 0.3, sizeMin: 1, sizeMax: 2, col: ['#c9d6ea', '#8a93a6'], drag: 3
      });
      FX.ring(x, y, 1, 10, 0.2, '#c9d6ea', 1);
      FX.shake(1.5);
      return;
    }
    const c = EL[elKey];

    if (elKey === 'fire') {
      this.explode(x, y, 'fire');
      FX.shake(6);
      FX.ring(x, y, 4, 44, 0.45, c.mid, 3);
    }

    if (elKey === 'lightning') {
      for (let i = 0; i < 5; i++) {
        const a = U.rand(0, Math.PI * 2);
        FX.bolt(x, y, x + Math.cos(a) * U.rand(14, 34), y + Math.sin(a) * U.rand(14, 34),
          c.mid, 0.16, { amp: 4, branches: 1 });
      }
      FX.burst(x, y, 26, {
        spread: Math.PI, spdMin: 40, spdMax: 200, jitter: 3,
        life: 0.5, sizeMin: 1, sizeMax: 2, col: [c.core, c.mid, c.hot], grav: 150, drag: 2.5
      });
      FX.ring(x, y, 3, 34, 0.3, c.core, 2);
      FX.light(x, y, 120, c.lightCol, 1, 0.5);
      FX.flash('#e6f7ff', 0.42, 7);
      FX.shake(6);
      FX.decal(x, y, 16, 5, '#141a12', 8);
      World.applyElementHit(x, y, 30, 'lightning');
    }

    if (elKey === 'light') {
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + U.rand(-1.1, 1.1);
        FX.beam(x, y, a, U.rand(20, 56), U.rand(1, 3), U.chance(0.5) ? c.mid : c.hot, U.rand(0.2, 0.4));
      }
      FX.ring(x, y, 2, 40, 0.5, c.hot, 2);
      FX.ring(x, y, 2, 26, 0.34, c.core, 2);
      FX.burst(x, y, 20, {
        spread: Math.PI, spdMin: 20, spdMax: 110, life: 0.8, sizeMin: 1, sizeMax: 2,
        col: [c.core, c.hot], grav: -16, drag: 1.6
      });
      FX.light(x, y, 130, c.lightCol, 1, 0.6);
      FX.flash('#fff6d8', 0.3, 6);
      FX.shake(4);
      World.applyElementHit(x, y, 36, 'light');
    }
  }
};
