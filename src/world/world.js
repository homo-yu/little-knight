'use strict';

// ============================================================
//  关卡场景：森林 → 悬崖 → 岩壁 → 高台(雷) → 荆棘隧道 → 墓园(光)
// ============================================================

const GY = 224;                 // 主地面高度

const World = {
  boundX0: -60, boundX1: 2040,
  boundY0: -60, boundY1: 470,

  solids: [],
  dynamic: [],
  decor: [],
  thorns: null,
  pickups: [],
  checkpoints: [],
  spawn: { x: 70, y: GY },
  paths: [],
  twisters: [],
  dummies: [],
  impacts: [],
  enemies: [],                    // ← 怪物都放这里（entity/enemy.js 的 Enemy 子类）
  levelId: 'level1',

  _list: [],
  _terrain: null,
  _bgFar: null, _bgMid: null,
  _fireflies: [],
  _wisps: [],
  _crows: [],
  time: 0,
  hintZone: {},

  // ---------------------------------------------------------
  //  载入关卡
  // ---------------------------------------------------------
  init(levelId) {
    this.levelId = levelId || 'level1';
    const lv = World.LEVELS[this.levelId] || World.LEVELS.level1;
    if (!lv) throw new Error('unknown level: ' + this.levelId);
    this.level = lv;
    this.levelId = lv.id || this.levelId;

    this.solids.length = 0;
    this.dynamic.length = 0;
    this.decor.length = 0;
    this.pickups.length = 0;
    this.checkpoints.length = 0;
    this.enemies.length = 0;
    this.thorns = null;
    this.paths = [];
    this.twisters = [];
    this.dummies = [];
    this.impacts = [];

    this.time = 0;
    this.boundX0 = lv.bx0; this.boundX1 = lv.bx1;
    this.boundY0 = lv.by0; this.boundY1 = lv.by1;
    this.spawn = { x: lv.spawn.x, y: lv.spawn.y };

    lv.build(this);
    // 关卡里声明的怪物（entity/enemies/* 提供工厂）
    if (lv.enemies) {
      for (const e of lv.enemies) {
        const Ctor = (typeof ENEMY_TYPES !== 'undefined') ? ENEMY_TYPES[e.type] : null;
        if (Ctor) this.enemies.push(new Ctor(e.x, e.y, e.opts));
      }
    }

    this.bake();
    this.makeBackgrounds();
    this.makeAmbient();
  },

  // ---------------------------------------------------------
  // ---------------- 背景层 ----------------
  makeBackgrounds() {
    // 远山（底边贴地平线）
    let b = makeCanvas(560, 150);
    let g = b.g;
    const far = [];
    let y = 92;
    for (let x = 0; x <= 560; x += 4) {
      y += U.rand(-4, 4);
      y = U.clamp(y, 44, 118);
      far.push({ x, y });
    }
    g.fillStyle = PAL.mountFar;
    g.beginPath();
    g.moveTo(0, 150);
    for (const p of far) g.lineTo(p.x, p.y);
    g.lineTo(560, 150);
    g.closePath();
    g.fill();
    // 山脊微光（稀疏点，避免整条白线）
    for (let i = 0; i < far.length; i += 3) {
      const p = far[i];
      if (U.hash(p.x, 7) > 0.55) D.rect(g, p.x, p.y, 1, 1, U.hexA(PAL.moonGlow, 0.22));
    }
    // 近一层山
    const near = [];
    y = 116;
    for (let x = 0; x <= 560; x += 4) {
      y += U.rand(-3, 3);
      y = U.clamp(y, 84, 138);
      near.push({ x, y });
    }
    g.fillStyle = PAL.mountNear;
    g.beginPath();
    g.moveTo(0, 150);
    for (const p of near) g.lineTo(p.x, p.y);
    g.lineTo(560, 150);
    g.closePath();
    g.fill();
    // 地平线雾气
    for (let yy = 128; yy < 150; yy++) {
      g.fillStyle = U.hexA(PAL.fog, ((yy - 128) / 22) * 0.12);
      g.fillRect(0, yy, 560, 1);
    }
    this._bgFar = b.c;

    // 中景松林剪影
    b = makeCanvas(620, 170);
    g = b.g;
    for (let i = 0; i < 54; i++) {
      const x = U.rand(0, 620);
      const hh = U.rand(26, 78);
      const base = 170;
      g.fillStyle = U.chance(0.55) ? PAL.treeFar : PAL.treeMid;
      const w0 = hh * 0.42;
      g.beginPath();
      g.moveTo(x, base);
      for (let k = 0; k < 4; k++) {
        const w = w0 * (1 - k * 0.24);
        const yy = base - hh * (0.22 + k * 0.2);
        g.lineTo(x - w, yy + 5);
        g.lineTo(x - w * 0.4, yy);
        g.lineTo(x, yy - hh * 0.13);
        g.lineTo(x + w * 0.4, yy);
        g.lineTo(x + w, yy + 5);
      }
      g.lineTo(x + 1, base);
      g.closePath();
      g.fill();
    }
    for (let yy = 150; yy < 170; yy++) {
      g.fillStyle = U.hexA(PAL.fog, ((yy - 150) / 20) * 0.10);
      g.fillRect(0, yy, 620, 1);
    }
    this._bgMid = b.c;
  },

  makeAmbient() {
    this._fireflies.length = 0;
    const x0 = this.boundX0, x1 = this.boundX1;
    const n1 = Math.round((x1 - x0) / 26);
    for (let i = 0; i < n1; i++) {
      this._fireflies.push({
        x: U.rand(x0, x1 - 40), y: U.rand(150, 226),
        ph: U.rand(0, 6.28), spd: U.rand(0.3, 0.9), r: U.rand(1, 2)
      });
    }
    this._wisps.length = 0;
    for (let i = 0; i < 14; i++) {
      this._wisps.push({
        x: U.rand(x0, x1 - 40), y: U.rand(170, 230),
        w: U.rand(24, 52), spd: U.rand(4, 14), ph: U.rand(0, 6.28), a: U.rand(0.04, 0.1)
      });
    }
    this._crows.length = 0;
    for (let i = 0; i < 2; i++) {
      this._crows.push({ x: U.rand(x0 + 100, x1 - 100), y: U.rand(60, 110), ph: U.rand(0, 6.28), spd: U.rand(6, 14) });
    }
  },

  // ---------------------------------------------------------
  active() {
    const L = this._list;
    L.length = 0;
    for (let i = 0; i < this.solids.length; i++) L.push(this.solids[i]);
    for (let i = 0; i < this.dynamic.length; i++) L.push(this.dynamic[i]);
    return L;
  },

  pointSolid(x, y) {
    const L = this.active();
    for (let i = 0; i < L.length; i++) {
      const s = L[i];
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
    }
    return null;
  },

  boxSolid(x, y, w, h) {
    const L = this.active();
    for (let i = 0; i < L.length; i++) {
      const s = L[i];
      if (U.overlap(x, y, w, h, s.x, s.y, s.w, s.h)) return s;
    }
    return null;
  },

  // AABB 移动 + 碰撞（x 为中心，y 为脚底）
  moveAndCollide(e, dt) {
    const hw = e.w / 2;
    e.hitWall = 0;

    e.x += e.vx * dt;
    let L = this.active();
    for (let i = 0; i < L.length; i++) {
      const s = L[i];
      if (U.overlap(e.x - hw, e.y - e.h, e.w, e.h, s.x, s.y, s.w, s.h)) {
        if (e.vx > 0) { e.x = s.x - hw - 0.01; e.hitWall = 1; }
        else if (e.vx < 0) { e.x = s.x + s.w + hw + 0.01; e.hitWall = -1; }
        e.vx = 0;
      }
    }

    e.y += e.vy * dt;
    e.grounded = false;
    L = this.active();
    for (let i = 0; i < L.length; i++) {
      const s = L[i];
      if (U.overlap(e.x - hw, e.y - e.h, e.w, e.h, s.x, s.y, s.w, s.h)) {
        if (e.vy > 0) {
          e.y = s.y - 0.01;
          e.grounded = true;
          e.vy = 0;
        } else if (e.vy < 0) {
          e.y = s.y + s.h + e.h + 0.01;
          e.vy = 0;
        }
      }
    }

    // 贴地探测（补一次，避免站立时 grounded 抖动）
    if (!e.grounded && e.vy >= 0) {
      L = this.active();
      for (let i = 0; i < L.length; i++) {
        const s = L[i];
        if (U.overlap(e.x - hw, e.y - e.h, e.w, e.h + 1.6, s.x, s.y, s.w, s.h)) {
          e.grounded = true;
          e.y = s.y - 0.01;
          e.vy = 0;
          break;
        }
      }
    }
    return e;
  },


  update(dt) {
    this.time += dt;
    // 怪物
    for (const e of this.enemies) if (e.update) e.update(dt);
    const th = this.thorns;
    if (th && th.alive && th.burn > 0) {
      th.burn += dt;
      const k = th.burn;
      // 火焰粒子
      const n = 3;
      for (let i = 0; i < n; i++) {
        FX.particle({
          x: th.x + U.rand(0, th.w),
          y: th.y + U.rand(0, th.h),
          vx: U.rand(-18, 18), vy: U.rand(-70, -24),
          life: U.rand(0.3, 0.8), size: U.rand(1, 3),
          col: U.chance(0.4) ? '#fff0c0' : (U.chance(0.5) ? '#ff9a3c' : '#c9330d'),
          grav: -50, drag: 1.6
        });
      }
      if (U.chance(0.3)) FX.light(th.x + U.rand(0, th.w), th.y + U.rand(0, th.h), 60, '#ff9a3c', 0.8, 0.15);
      if (U.chance(0.4)) FX.particle({
        x: th.x + U.rand(0, th.w), y: th.y + U.rand(0, th.h * 0.5),
        vx: U.rand(-10, 10), vy: U.rand(-30, -8),
        life: U.rand(0.8, 1.6), size: U.rand(2, 4), col: '#2a2620', grav: -14, drag: 1, add: false
      });
      if (k > 0.5 && U.chance(0.5)) {
        FX.particle({
          x: th.x + U.rand(0, th.w), y: th.y + U.rand(0, th.h),
          vx: U.rand(-40, 40), vy: U.rand(-90, -30),
          life: U.rand(0.4, 0.9), size: U.rand(1, 2), col: '#ffd27a', grav: 60, drag: 1.2
        });
      }
      if (k > 1.6) {
        th.alive = false;
        const idx = this.solids.indexOf(th);
        if (idx >= 0) this.solids.splice(idx, 1);
        FX.burst(th.x + th.w / 2, th.y + th.h / 2, 40, {
          spread: Math.PI, spdMin: 40, spdMax: 200, jitter: 10,
          life: 0.9, sizeMin: 1, sizeMax: 4,
          col: ['#fff0c0', '#ff9a3c', '#c9330d', '#2a2620'], grav: 90, drag: 1.8
        });
        FX.flash('#ff9a3c', 0.3, 4);
        FX.shake(7);
        FX.decal(th.x + th.w / 2, GY - 2, 70, 8, '#120c08', 20);
      }
    }

    // 拾取
    if (typeof Game !== 'undefined' && Game.player) {
      for (const p of this.pickups) {
        if (p.taken) continue;
        p.t += dt;
        if (U.dist(p.x, p.y, Game.player.x, Game.player.y - 8) < 16) {
          p.taken = true;
          Game.onPickup(p);
        }
      }
      // 滞留路径（冰封 / 水）
      for (let i = this.paths.length - 1; i >= 0; i--) {
        const pa = this.paths[i];
        pa.life -= dt;
        if (pa.life <= 0) { this.paths.splice(i, 1); continue; }
        pa.t += dt;
        if (pa.el === 'water' && U.chance(0.25)) {
          FX.particle({
            x: pa.x + U.rand(-pa.w / 2, pa.w / 2), y: pa.y - U.rand(0, 2),
            vx: U.rand(-6, 6), vy: U.rand(-16, -4),
            life: U.rand(0.4, 0.9), size: 1,
            col: U.chance(0.5) ? '#9fd8f5' : '#4a9fd8', grav: -10, drag: 2
          });
        }
        if (pa.el === 'ice' && U.chance(0.12)) {
          FX.particle({
            x: pa.x + U.rand(-pa.w / 2, pa.w / 2), y: pa.y - 1,
            vx: U.rand(-4, 4), vy: U.rand(-10, -2),
            life: 0.5, size: 1, col: '#cfeaff', drag: 2
          });
        }
      }
      // 木桩受击闪白
      for (const dm of this.dummies) {
        if (dm.flash > 0) dm.flash = Math.max(0, dm.flash - dt * 4);
      }
      // 旋风
      for (let i = this.twisters.length - 1; i >= 0; i--) {
        const tw = this.twisters[i];
        tw.t += dt;
        const c = EL[tw.el];
        for (let k = 0; k < 3; k++) {
          const a = tw.t * 9 + U.rand(0, 6.28);
          const r = U.rand(4, 22);
          FX.particle({
            x: tw.x + Math.cos(a) * r, y: tw.y - U.rand(0, 56),
            vx: Math.cos(a + 1.6) * 90, vy: -U.rand(30, 90),
            life: U.rand(0.25, 0.55), size: U.rand(1, 2),
            col: U.chance(0.5) ? c.core : c.mid, grav: -30, drag: 1.4
          });
        }
        if (U.chance(0.4)) FX.light(tw.x, tw.y - 26, 70, c.lightCol, 0.8, 0.12);
        if (tw.t >= tw.life) this.twisters.splice(i, 1);
      }
      // 元素反应缓存
      for (let i = this.impacts.length - 1; i >= 0; i--) {
        this.impacts[i].t -= dt;
        if (this.impacts[i].t <= 0) this.impacts.splice(i, 1);
      }
      // 检查点（只向前推进，避免每帧重复触发）
      let best = -1;
      for (let i = 0; i < this.checkpoints.length; i++) if (this.checkpoints[i].on) best = i;
      for (let i = best + 1; i < this.checkpoints.length; i++) {
        const c = this.checkpoints[i];
        if (Game.player.x > c.x) {
          for (const o of this.checkpoints) o.on = false;
          c.on = true;
          Game.onCheckpoint(c);
          break;
        }
      }
    }
  },

  respawnPoint() {
    let p = this.checkpoints[0];
    for (const c of this.checkpoints) if (c.on) p = c;
    return p;
  },

  // ---------------------------------------------------------
  //  绘制
  // ---------------------------------------------------------
  drawBackground(g, cam, t) {
    // 天空渐变
    const sky = g.createLinearGradient(0, 0, 0, GAME_H);
    const lift = U.clamp(-cam.y / 900, 0, 0.5);
    sky.addColorStop(0, U.mix(PAL.sky1, PAL.sky2, lift));
    sky.addColorStop(0.55, PAL.sky2);
    sky.addColorStop(1, PAL.sky3);
    g.fillStyle = sky;
    g.fillRect(0, 0, GAME_W, GAME_H);

    // 星
    g.fillStyle = PAL.star;
    for (let i = 0; i < 90; i++) {
      const sx = (U.hash(i, 1) * 1400 - cam.x * 0.06) % 1400;
      const sy = U.hash(i, 2) * 150;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i));
      g.globalAlpha = 0.25 + tw * 0.55;
      g.fillRect(Math.round((sx + 1400) % 1400 - 20), Math.round(sy), 1, 1);
    }
    g.globalAlpha = 1;

    // 月亮
    const mx = 360 - cam.x * 0.04;
    const my = 46 - cam.y * 0.05;
    g.globalCompositeOperation = 'lighter';
    D.glow(g, mx, my, 74, PAL.moonGlow, 0.10);
    D.glow(g, mx, my, 34, PAL.moon, 0.10);
    g.globalCompositeOperation = 'source-over';
    D.disc(g, mx, my, 15, PAL.moon);
    D.disc(g, mx - 3, my - 3, 11, '#f7fbff');
    g.globalAlpha = 0.5;
    D.disc(g, mx + 5, my + 4, 3, PAL.moonShade);
    D.disc(g, mx - 6, my + 6, 2, PAL.moonShade);
    g.globalAlpha = 1;

    // 远山
    this.drawParallax(g, this._bgFar, 560, cam, 0.14);
    this.drawParallax(g, this._bgMid, 620, cam, 0.34);

    // 地平线雾
    const fy = 226 - cam.y;
    for (let i = 0; i < 22; i++) {
      g.globalAlpha = 0.045 * (1 - i / 22);
      g.fillStyle = PAL.fog;
      g.fillRect(0, fy - i * 3, GAME_W, 3);
    }
    g.globalAlpha = 1;
  },

  drawParallax(g, img, lw, cam, p) {
    const off = ((cam.x * p) % lw + lw) % lw;
    const y = Math.round(226 - cam.y - img.height);
    for (let i = -1; i <= 1; i++) {
      g.drawImage(img, Math.round(-off + lw * i), y);
    }
  },

  drawTerrain(g) {
    g.drawImage(this._terrain, this.terX0, this.terY0);
  },

  drawDynamic(g, t) {
    // 滞留路径（贴地）
    this.drawPaths(g, t);

    // 怪物（画在地形之上、玩家之前）
    for (const e of this.enemies) if (e.draw) e.draw(g, t);

    // 荆棘
    const th = this.thorns;
    if (th && th.alive) this.drawThorns(g, th, t);

    // 训练木桩
    for (const dm of this.dummies) this.drawDummy(g, dm, t);

    // 魔法石
    for (const p of this.pickups) {
      if (p.taken) continue;
      this.drawStone(g, p, t);
    }

    // 旋风
    for (const tw of this.twisters) this.drawTwister(g, tw, t);

    // 萤火虫
    g.globalCompositeOperation = 'lighter';
    for (const f of this._fireflies) {
      const bob = Math.sin(t * f.spd + f.ph);
      const x = f.x + Math.cos(t * f.spd * 0.7 + f.ph) * 9;
      const y = f.y + bob * 6;
      const a = 0.25 + 0.45 * Math.abs(Math.sin(t * 1.6 + f.ph));
      const col = f.pale ? '#bfe6d8' : '#ffe08a';
      D.glow(g, x, y, 9, col, 0.35 * a);
      D.rect(g, x, y, 1, 1, col);
    }
    // 墓园雾团
    for (const w of this._wisps) {
      const x = w.x + Math.sin(t * 0.3 + w.ph) * 20;
      const y = w.y + Math.sin(t * 0.7 + w.ph) * 3;
      D.glow(g, x, y, w.w, PAL.fog, w.a);
    }
    g.globalCompositeOperation = 'source-over';
  },

  drawPaths(g, t) {
    for (const pa of this.paths) {
      const k = pa.life / pa.max;
      const a = Math.min(1, k * 2.2) * Math.min(1, (1 - k) * 6 + 0.25);
      const x0 = pa.x - pa.w / 2, y = pa.y;
      if (pa.el === 'ice') {
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = Math.min(1, k * 1.6);
        // 冰面
        D.rect(g, x0, y - 4, pa.w, 4, '#7fc4ef');
        D.rect(g, x0, y - 4, pa.w, 1, '#eaf7ff');
        D.rect(g, x0, y - 1, pa.w, 1, '#4a9fd8');
        for (let i = 0; i < 6; i++) {
          const px = x0 + U.hash(i, pa.x | 0) * pa.w;
          D.rect(g, px, y - U.rand(4, 7), 1, 3, '#cfeaff');
        }
        // 冰刺
        for (let i = 0; i < 4; i++) {
          const px = x0 + 4 + i * (pa.w / 4);
          const hh = 3 + (i % 2) * 3;
          D.rect(g, px, y - 4 - hh, 2, hh, '#bfe6ff');
          D.rect(g, px, y - 4 - hh, 1, hh, '#ffffff');
        }
        g.globalCompositeOperation = 'lighter';
        D.glow(g, pa.x, y - 3, pa.w * 0.7, '#8fd8ff', 0.18 * a);
      } else {
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = Math.min(1, k * 1.6) * 0.92;
        D.rect(g, x0, y - 3, pa.w, 3, '#2f7fb8');
        D.rect(g, x0 + 1, y - 3, pa.w - 2, 1, '#9fd8f5');
        D.rect(g, x0, y - 1, pa.w, 1, '#1d5f96');
        // 水面波纹
        for (let i = 0; i < 4; i++) {
          const px = x0 + ((i * 13 + t * 22) % pa.w);
          D.rect(g, px, y - 3, 3, 1, '#eaf8ff');
        }
        g.globalCompositeOperation = 'lighter';
        D.glow(g, pa.x, y - 2, pa.w * 0.8, '#4a9fd8', 0.14 * a);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  },

  drawDummy(g, dm, t) {
    const x = dm.x, y = dm.y;
    // 支架
    D.rect(g, x - 1, y - 40, 2, 40, PAL.wood);
    D.rect(g, x - 8, y - 30, 16, 2, PAL.woodL);
    // 稻草人
    const flash = dm.flash;
    const body = flash > 0 ? U.mix('#c9a24a', '#ffffff', flash) : '#c9a24a';
    D.rect(g, x - 7, y - 32, 14, 16, body);
    D.rect(g, x - 7, y - 32, 14, 2, U.mix(body, '#ffffff', 0.25));
    D.rect(g, x - 7, y - 18, 14, 2, U.mix(body, '#000000', 0.35));
    // 绑绳
    for (let i = 0; i < 3; i++) D.rect(g, x - 7, y - 29 + i * 5, 14, 1, '#7a5a2c');
    // 头
    D.rect(g, x - 5, y - 44, 10, 11, body);
    D.rect(g, x - 5, y - 44, 10, 1, U.mix(body, '#ffffff', 0.3));
    D.rect(g, x - 3, y - 40, 2, 2, '#3a2a16');
    D.rect(g, x + 1, y - 40, 2, 2, '#3a2a16');
    if (flash > 0) {
      g.globalCompositeOperation = 'lighter';
      D.glow(g, x, y - 28, 26, '#ffffff', 0.4 * flash);
      g.globalCompositeOperation = 'source-over';
    }
  },

  drawTwister(g, tw, t) {
    const c = EL[tw.el];
    const k = tw.t / tw.life;
    const h = 60 * Math.min(1, tw.t * 4);
    g.globalCompositeOperation = 'lighter';
    D.glow(g, tw.x, tw.y - h * 0.5, h * 0.9, c.lightCol, 0.3 * (1 - k * 0.5));
    for (let i = 0; i < 16; i++) {
      const u = i / 15;
      const yy = tw.y - u * h;
      const r = 4 + u * 14;
      const a = tw.t * 8 + u * 7;
      const px = tw.x + Math.cos(a) * r;
      D.rect(g, px, yy, 2, 2, U.chance(0.5) ? c.core : c.hot);
    }
    g.globalCompositeOperation = 'source-over';
  },

  drawThorns(g, th, t) {
    const burn = th.burn;
    const col = burn > 0 ? U.mix(PAL.thorn, '#3a1c10', Math.min(1, burn)) : PAL.thorn;
    // 藤蔓主体
    for (let y = th.y; y < th.y + th.h; y += 3) {
      const wob = Math.sin(y * 0.2 + th.x) * 3;
      D.rect(g, th.x + 6 + wob, y, th.w - 12, 3, col);
    }
    // 盘绕的茎
    for (let i = 0; i < 7; i++) {
      const cx = th.x + 4 + (i / 7) * (th.w - 8);
      let px = cx, py = th.y + th.h;
      for (let s = 0; s < th.h; s += 3) {
        const nx = px + Math.sin(s * 0.15 + i) * 3;
        D.rect(g, nx, py - s, 3, 3, col);
        D.rect(g, nx, py - s, 1, 3, burn > 0 ? '#ff7a24' : PAL.thornL);
      }
    }
    // 刺
    for (let i = 0; i < 40; i++) {
      const sx = th.x + 3 + U.hash(i, 81) * (th.w - 6);
      const sy = th.y + 2 + U.hash(i, 82) * (th.h - 4);
      const dir = U.hash(i, 83) > 0.5 ? 1 : -1;
      D.line(g, sx, sy, sx + dir * 4, sy - U.rand(2, 5), burn > 0 ? '#ffae5a' : PAL.thornSpike, 1);
    }
    // 尖端
    for (let i = 0; i < 10; i++) {
      const sx = th.x + 2 + U.hash(i, 91) * (th.w - 4);
      D.line(g, sx, th.y + 2, sx + U.rand(-3, 3), th.y - U.rand(3, 7), burn > 0 ? '#ffd27a' : PAL.thornHi, 1);
    }
    if (burn > 0) {
      g.globalCompositeOperation = 'lighter';
      D.glow(g, th.x + th.w / 2, th.y + th.h / 2, 60, '#ff8c2e', 0.18 + 0.1 * Math.sin(t * 12));
      g.globalCompositeOperation = 'source-over';
    }
  },

  drawStone(g, p, t) {
    const c = EL[p.el];
    const sc = c.stone || c.mid;
    const hi = c.stoneHi || c.hot;
    const lo = c.stoneLo || c.deep;
    const bob = Math.sin(t * 2.2 + p.x) * 2;
    const x = p.x, y = p.y + bob;
    g.globalCompositeOperation = 'lighter';
    D.glow(g, x, y, 34, sc, 0.34 + 0.12 * Math.sin(t * 3));
    D.glow(g, x, y, 14, hi, 0.4);
    g.globalCompositeOperation = 'source-over';
    // 水晶
    D.rect(g, x - 3, y - 5, 6, 9, sc);
    D.rect(g, x - 2, y - 7, 4, 2, hi);
    D.rect(g, x - 1, y + 4, 2, 2, lo);
    D.rect(g, x - 2, y - 6, 1, 10, hi);
    D.rect(g, x + 1, y - 5, 1, 8, lo);
    D.rect(g, x - 1, y - 4, 1, 4, hi);
    // 环绕光点
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = t * 1.8 + (i * Math.PI * 2) / 3;
      D.glow(g, x + Math.cos(a) * 9, y + Math.sin(a) * 4, 6, c.core, 0.5);
      D.rect(g, x + Math.cos(a) * 9, y + Math.sin(a) * 4, 1, 1, c.core);
    }
    g.globalCompositeOperation = 'source-over';
  }
};
