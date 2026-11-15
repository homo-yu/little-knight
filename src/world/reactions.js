'use strict';

// ============================================================
//  元素命中 / 滞留路径 / 元素反应
//  以 Object.assign 挂到 World 上
//  新增反应 -> 在 REACTIONS 表里加一行 + 写一个表现函数
// ============================================================

const WorldReactions = {
  // 元素命中：荆棘 / 木桩 / 滞留路径 / 元素反应
  applyElementHit(x, y, r, el) {
    const th = this.thorns;
    if (th && th.alive) {
      const cx = th.x + th.w / 2, cy = th.y + th.h / 2;
      if (U.dist(x, y, cx, cy) < r + Math.max(th.w, th.h) * 0.5) this.igniteThorns();
    }
    for (const dm of this.dummies) {
      if (Math.abs(x - dm.x) < r + 12 && Math.abs(y - (dm.y - 18)) < r + 24) dm.flash = 1;
    }
    // 冰 / 水 留下滞留路径
    if (el === 'ice') this.addPath('ice', x, y);
    else if (el === 'water') this.addPath('water', x, y);
    // 雷打到水路上 → 导电
    if (el === 'lightning') {
      for (const pa of this.paths) {
        if (pa.el !== 'water') continue;
        if (Math.abs(pa.x - x) < pa.w * 0.5 + 52) { this.conduct(pa); break; }
      }
    }
    this.react(el, x, y);
  },

  addPath(el, x, y) {
    const src = EL[el];
    const gy = this.groundYAt(x, y);
    const p = {
      el,
      x: U.clamp(x, this.boundX0 + 20, this.boundX1 - 20),
      y: gy,
      w: el === 'ice' ? 30 : 52,
      life: el === 'ice' ? 1.0 : 4.0,
      max: el === 'ice' ? 1.0 : 4.0,
      t: 0
    };
    // 合并同一位置的同类路径
    for (let i = this.paths.length - 1; i >= 0; i--) {
      const o = this.paths[i];
      if (o.el === el && Math.abs(o.x - p.x) < 18) {
        o.life = Math.max(o.life, p.life);
        o.t = 0;
        o.w = Math.max(o.w, p.w);
        return;
      }
    }
    if (this.paths.length > 14) this.paths.shift();
    this.paths.push(p);
    if (el === 'ice') {
      FX.burst(p.x, p.y - 2, 12, {
        spread: Math.PI, spdMin: 20, spdMax: 90, life: 0.5, sizeMin: 1, sizeMax: 2,
        col: ['#ffffff', '#cfeaff', '#7fc4ef'], grav: 60, drag: 3
      });
    } else {
      FX.burst(p.x, p.y - 2, 14, {
        spread: Math.PI, spdMin: 20, spdMax: 110, life: 0.6, sizeMin: 1, sizeMax: 3,
        col: ['#eaf8ff', '#9fd8f5', '#4a9fd8'], grav: 120, drag: 2.5
      });
    }
    void src;
  },

  groundYAt(x, fromY) {
    let best = null;
    for (let i = 0; i < this.solids.length; i++) {
      const s = this.solids[i];
      if (x >= s.x && x <= s.x + s.w && s.y >= fromY - 8 && s.y < this.boundY1) {
        if (best === null || s.y < best) best = s.y;
      }
    }
    return best === null ? fromY : best;
  },

  // ---------- 元素反应 ----------
  react(el, x, y) {
    const others = [];
    for (const i of this.impacts) {
      if (i.el !== el && Math.abs(i.x - x) < 48 && Math.abs(i.y - y) < 44) others.push(i.el);
    }
    // 扎在场上的元素长矛也是持续的元素源
    if (typeof Game !== 'undefined' && Game.player && Game.player.spear) {
      const sp = Game.player.spear;
      if (sp.state === 'stuck' && sp.el && sp.el !== el &&
          Math.abs(sp.x - x) < 58 && Math.abs(sp.y - y) < 62) {
        others.push(sp.el);
      }
    }
    if (this.impacts.length > 10) this.impacts.shift();
    this.impacts.push({ el, x, y, t: 0.55 });
    if (!others.length) return;
    const has = (e) => others.indexOf(e) >= 0;
    if ((el === 'lightning' && has('fire')) || (el === 'fire' && has('lightning'))) {
      this.boom(x, y);
    } else if ((el === 'fire' && has('wind')) || (el === 'wind' && has('fire'))) {
      this.twister(x, y, 'fire');
    } else if ((el === 'water' && has('wind')) || (el === 'wind' && has('water'))) {
      this.twister(x, y, 'water');
    } else if ((el === 'water' && has('ice')) || (el === 'ice' && has('water'))) {
      this.mist(x, y);
    } else if ((el === 'water' && has('lightning')) || (el === 'lightning' && has('water'))) {
      this.shock(x, y);
    }
  },

  boom(x, y) {
    FX.blast(x, y, 6, 46, 0.3, '#ffd27a', 0.85);
    FX.blast(x, y, 3, 24, 0.2, '#ffffff', 0.9);
    FX.ring(x, y, 4, 62, 0.5, '#ff9a3c', 4);
    FX.ring(x, y, 2, 34, 0.3, '#ffe6a0', 2);
    FX.burst(x, y, 46, {
      spread: Math.PI, spdMin: 60, spdMax: 300, jitter: 6,
      life: 0.7, sizeMin: 1, sizeMax: 4,
      col: ['#fff0c0', '#ffb347', '#ff7a24', '#c22f0c'], grav: 80, drag: 2.2
    });
    for (let i = 0; i < 6; i++) {
      const a = U.rand(0, Math.PI * 2);
      FX.bolt(x, y, x + Math.cos(a) * U.rand(20, 60), y + Math.sin(a) * U.rand(20, 60),
        '#8fe6ff', 0.2, { amp: 6, branches: 1 });
    }
    FX.light(x, y, 170, '#ffb347', 1, 0.7);
    FX.flash('#ffe0a0', 0.55, 6);
    FX.shake(9);
    FX.decal(x, y, 40, 10, '#140d08', 10);
    Game.onReaction && Game.onReaction('雷 + 火 · 范围爆炸', x, y);
  },

  twister(x, y, el) {
    this.twisters.push({ x, y: this.groundYAt(x, y), el, t: 0, life: 1.6 });
    FX.shake(4);
    FX.light(x, y - 30, 90, el === 'fire' ? '#ffb347' : '#9fd8f5', 1, 0.8);
    Game.onReaction && Game.onReaction(el === 'fire' ? '火 + 风 · 火焰旋风' : '水 + 风 · 水龙卷', x, y);
  },

  mist(x, y) {
    for (let i = 0; i < 30; i++) {
      FX.particle({
        x: x + U.rand(-24, 24), y: y + U.rand(-10, 6),
        vx: U.rand(-40, 40), vy: U.rand(-50, -10),
        life: U.rand(0.5, 1.3), size: U.rand(2, 5),
        col: U.chance(0.5) ? '#dff2ff' : '#bcd8ee', grav: -12, drag: 1.2, add: false
      });
    }
    FX.ring(x, y, 4, 34, 0.5, '#cfeaff', 2);
    Game.onReaction && Game.onReaction('水 + 冰 · 冻结减速', x, y);
  },

  shock(x, y) {
    this.conductAt(x, y, 120);
    FX.flash('#dff4ff', 0.3, 8);
    FX.shake(5);
    Game.onReaction && Game.onReaction('水 + 雷 · 导电麻痹', x, y);
  },

  conduct(pa) {
    this.conductAt(pa.x, pa.y - 4, pa.w);
  },

  conductAt(x, y, w) {
    const n = Math.max(3, Math.round(w / 12));
    for (let i = 0; i < n; i++) {
      const x0 = x - w / 2 + (i / n) * w;
      const x1 = x - w / 2 + ((i + 1) / n) * w;
      FX.bolt(x0, y - U.rand(0, 6), x1, y - U.rand(0, 6), '#8fe6ff', 0.16, { amp: 4, branches: 1 });
    }
    FX.burst(x, y - 4, 18, {
      spread: Math.PI, spdMin: 30, spdMax: 140, life: 0.4, sizeMin: 1, sizeMax: 2,
      col: ['#ffffff', '#8fe6ff', '#6fd2ff'], grav: 60, drag: 3
    });
    FX.light(x, y - 6, 90, '#8fe6ff', 1, 0.35);
  },

  igniteThorns() {
    const th = this.thorns;
    if (!th || !th.alive || th.burn > 0) return;
    th.burn = 0.001;
    if (typeof Game !== 'undefined') Game.onThornsIgnite();
  },
};

Object.assign(World, WorldReactions);
