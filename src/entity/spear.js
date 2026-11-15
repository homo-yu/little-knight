'use strict';

// ============================================================
//  投矛实体：蓄力掷出 / 扎进地形变成可踩平台 / 收回刷新跳跃
//  附着元素的长矛会持续滞留元素（见 world.reactions）
// ============================================================

class Spear {
  constructor(owner) {
    this.owner = owner;
    this.state = 'held';
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.ang = 0;
    this.el = null;
    this.plat = null;
    this.spin = 0;
    this.t = 0;
  }

  throwIt(ang, speed, el) {
    const hp = this.owner.handPos();
    this.x = hp.x + Math.cos(ang) * 8;
    this.y = hp.y + Math.sin(ang) * 8;
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;
    this.ang = ang;
    this.el = el || null;
    this.state = 'flying';
    this.t = 0;

    // 出手特效
    const c = this.el ? EL[this.el] : null;
    FX.burst(this.x, this.y, 6, {
      dir: ang, spread: 0.5, spdMin: 20, spdMax: 80,
      life: 0.25, sizeMin: 1, sizeMax: 2,
      col: c ? [c.core, c.hot] : ['#c9d6ea', '#8a93a6'], drag: 3
    });
    if (c) {
      FX.light(this.x, this.y, 40, c.lightCol, 0.9, 0.2);
      FX.flash(U.hexA(c.lightCol, 0.35), 0.1, 8);
    }
    FX.shake(c ? 2.4 : 1.2);
  }

  stick(px, py) {
    this.state = 'stuck';
    this.x = px; this.y = py;
    this.t = 0;
    const dx = Math.cos(this.ang), dy = Math.sin(this.ang);
    // 杆身中点作为可踩平台
    const cx = px - dx * 11;
    const cy = py - dy * 11;
    this.plat = { x: cx - 9, y: cy - 2, w: 18, h: 4, mat: 'spear', spearPlat: true };
    World.dynamic.push(this.plat);
    Magic.spearImpact(px - dx * 3, py - dy * 3, this.ang, this.el);
    // 冰/水是可滞留元素：长矛扎住后在地上留下对应路径
    if (this.el === 'water' || this.el === 'ice') {
      if (typeof World !== 'undefined') World.addPath(this.el, px, py);
    }
    if (this.el) {
      const c = EL[this.el];
      for (let i = 0; i < 14; i++) {
        FX.particle({
          x: px - dx * U.rand(2, 16), y: py - dy * U.rand(2, 16),
          vx: U.rand(-50, 50), vy: U.rand(-70, 10),
          life: U.rand(0.3, 0.8), size: U.rand(1, 2),
          col: U.chance(0.5) ? c.core : c.mid, grav: -30, drag: 2
        });
      }
    }
  }

  recall() {
    if (this.state !== 'stuck') return;
    this.state = 'returning';
    if (this.plat) {
      const i = World.dynamic.indexOf(this.plat);
      if (i >= 0) World.dynamic.splice(i, 1);
      this.plat = null;
    }
    this.spin = 0;
    FX.ring(this.x, this.y, 2, 16, 0.22, '#dfe8f7', 1);
  }

  catchSpear() {
    this.state = 'held';
    this.el = null;
    const hp = this.owner.handPos();
    FX.burst(hp.x, hp.y, 8, {
      spread: Math.PI, spdMin: 15, spdMax: 70,
      life: 0.3, sizeMin: 1, sizeMax: 2,
      col: ['#ffffff', '#dfe8f7', '#9fb4d8'], drag: 3
    });
    FX.ring(hp.x, hp.y, 2, 15, 0.25, '#dfe8f7', 1);
    this.owner.onSpearCaught();
  }

  update(dt) {
    if (this.state === 'flying') {
      this.t += dt;
      this.vy += 210 * dt;
      const N = 4;
      let hit = null;
      for (let i = 0; i < N; i++) {
        this.x += (this.vx * dt) / N;
        this.y += (this.vy * dt) / N;
        const s = World.pointSolid(this.x, this.y);
        if (s) { hit = s; break; }
      }
      this.ang = Math.atan2(this.vy, this.vx);
      const c = this.el ? EL[this.el] : null;
      if (c) {
        FX.particle({
          x: this.x + U.rand(-2, 2), y: this.y + U.rand(-2, 2),
          vx: -this.vx * 0.04 + U.rand(-10, 10), vy: -this.vy * 0.04 + U.rand(-10, 10),
          life: U.rand(0.2, 0.45), size: U.rand(1, 2),
          col: U.chance(0.5) ? c.core : c.mid, grav: -20, drag: 3
        });
        FX.light(this.x, this.y, 26, c.lightCol, 0.7, 0.1);
      } else if (U.chance(0.5)) {
        FX.particle({
          x: this.x, y: this.y, vx: U.rand(-8, 8), vy: U.rand(-8, 8),
          life: 0.16, size: 1, col: '#8fa2c0', drag: 4
        });
      }
      if (hit) this.stick(this.x, this.y);
      else if (this.t > 3) {
        // 超时掉落
        this.state = 'returning';
      }
    } else if (this.state === 'stuck') {
      this.t += dt;
      if (this.el) {
        const c = EL[this.el];
        const dx = Math.cos(this.ang), dy = Math.sin(this.ang);
        // 滞留元素：持续冒元素粒子
        if (U.chance(0.7)) {
          FX.particle({
            x: this.x - dx * U.rand(2, 20), y: this.y - dy * U.rand(2, 20),
            vx: U.rand(-16, 16), vy: U.rand(-38, -8),
            life: U.rand(0.35, 0.8), size: U.rand(1, 2),
            col: U.chance(0.5) ? c.core : c.mid, grav: -24, drag: 1.6,
            shape: this.el === 'ice' ? 'snow' : undefined
          });
        }
        // 元素氛围光 + 周期性脉冲环
        if (U.chance(0.12)) FX.light(this.x, this.y, 52, c.lightCol, 0.7, 0.2);
        if (this.t % 0.9 < dt) {
          FX.ring(this.x, this.y, 3, 22, 0.5, c.hot, 1);
        }
      }
    } else if (this.state === 'returning') {
      const hp = this.owner.handPos();
      const d = U.dist(this.x, this.y, hp.x, hp.y);
      const a = Math.atan2(hp.y - this.y, hp.x - this.x);
      const sp = 300 + Math.min(600, d * 6);
      this.x += Math.cos(a) * sp * dt;
      this.y += Math.sin(a) * sp * dt;
      this.ang = a;
      this.spin += dt * 22;
      FX.particle({
        x: this.x, y: this.y, vx: U.rand(-10, 10), vy: U.rand(-10, 10),
        life: 0.2, size: 1, col: '#c9d6ea', drag: 3
      });
      if (d < 14) this.catchSpear();
    }
  }

  draw(g, t) {
    if (this.state === 'held') return;
    const dx = Math.cos(this.ang), dy = Math.sin(this.ang);
    const L = PH.spearLen;
    const tx = this.x, ty = this.y;
    const bx = tx - dx * L, by = ty - dy * L;
    const c = this.el ? EL[this.el] : null;

    if (c) {
      g.globalCompositeOperation = 'lighter';
      D.glow(g, tx - dx * L * 0.5, ty - dy * L * 0.5, 18, c.lightCol, 0.45);
      D.glow(g, tx, ty, 14, c.core, 0.6);
      g.globalCompositeOperation = 'source-over';
    }

    // 杆
    D.line(g, bx, by, tx - dx * 5, ty - dy * 5, PAL.woodL, 2);
    D.line(g, bx, by, tx - dx * 5, ty - dy * 5, PAL.woodHi, 1);
    // 把握处
    D.line(g, bx + dx * 4, by + dy * 4, bx + dx * 9, by + dy * 9, PAL.leather, 3);
    // 矛头
    D.line(g, tx - dx * 6, ty - dy * 6, tx, ty, c ? c.hot : PAL.armorHi, 2);
    D.line(g, tx - dx * 6, ty - dy * 6, tx, ty, c ? c.core : '#ffffff', 1);
    // 尾羽
    D.rect(g, bx - 1, by - 1, 2, 2, PAL.leatherL);
    if (c) {
      g.globalCompositeOperation = 'lighter';
      D.rect(g, tx, ty, 1, 1, '#ffffff');
      g.globalCompositeOperation = 'source-over';
    }
  }
}
