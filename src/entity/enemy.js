'use strict';

// ============================================================
//  怪物基类
//  ------------------------------------------------------------
//  加一个新怪：
//    1) 在 entity/enemies/ 下新建 xxx.js
//    2) class Xxx extends Enemy { ... }，实现 think(dt) 的 AI
//    3) ENEMY_TYPES.xxx = Xxx;
//    4) 在关卡文件里写 enemies: [ { type:'xxx', x: 900, y: GY } ]
//  基类已经处理好：重力/地形碰撞、血量、受击闪白、元素附着、死亡粒子、朝向
// ============================================================

const ENEMY_TYPES = {};       // type -> class

class Enemy {
  constructor(x, y, opts) {
    opts = opts || {};
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.w = opts.w || 12;
    this.h = opts.h || 20;
    this.hp = opts.hp || 3;
    this.maxHp = this.hp;
    this.face = -1;
    this.grounded = false;
    this.dead = false;
    this.t = 0;
    this.hurtT = 0;           // 受击闪白计时
    this.slow = 0;            // 减速（冰/水）
    this.paralyze = 0;        // 麻痹（水+雷）
    this.burn = 0;            // 燃烧（火）
    this.el = null;           // 身上附着的元素
    this.elT = 0;
    this.grav = 780;
    this.dropEl = opts.dropEl || null;   // 死亡掉落魔法石
  }

  // 子类覆盖：每帧 AI
  think(dt) {}

  update(dt) {
    if (this.dead) return;
    this.t += dt;
    if (this.hurtT > 0) this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.paralyze > 0) this.paralyze -= dt;
    if (this.slow > 0) this.slow -= dt;
    if (this.elT > 0) { this.elT -= dt; if (this.elT <= 0) this.el = null; }

    this.think(dt);

    // 重力 + 地形
    this.vy += this.grav * dt;
    const sp = this.paralyze > 0 ? 0 : this.vx * (this.slow > 0 ? 0.45 : 1);
    this.x += sp * dt;
    World.moveAndCollide(this, dt);
    this.lifeTick(dt);
  }

  // 附着的元素持续伤害（火/水）
  lifeTick(dt) {
    if (this.burn > 0) {
      this.burn -= dt;
      if (U.chance(0.4)) {
        FX.particle({
          x: this.x + U.rand(-5, 5), y: this.y - U.rand(2, this.h),
          vx: U.rand(-10, 10), vy: U.rand(-40, -12),
          life: 0.3, size: 1, col: '#ffae3d', drag: 1.5
        });
      }
      this.damage(1.2 * dt, 'fire', true);
    }
  }

  // 受击：元素附着 + 闪白 + 击退
  hit(dmg, el, kx) {
    if (this.dead) return;
    this.damage(dmg, el);
    this.hurtT = 0.16;
    if (kx) this.vx += kx;
    if (el) {
      this.el = el;
      this.elT = 2.5;
      if (el === 'fire') this.burn = Math.max(this.burn, 1.6);
      if (el === 'ice' || el === 'water') this.slow = Math.max(this.slow, 1.2);
    }
  }

  damage(dmg, el, silent) {
    if (this.dead) return;
    this.hp -= dmg;
    if (!silent && U.chance(0.6)) {
      FX.burst(this.x, this.y - this.h * 0.5, 4, {
        spread: Math.PI * 2, spdMin: 20, spdMax: 90, life: 0.25,
        sizeMin: 1, sizeMax: 2, col: ['#ffffff', '#c8d4e8'], grav: 120, drag: 2
      });
    }
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    FX.burst(this.x, this.y - this.h * 0.5, 18, {
      spread: Math.PI * 2, spdMin: 30, spdMax: 160, life: 0.6,
      sizeMin: 1, sizeMax: 3, col: ['#e8eef8', '#8fa0be', '#5a6a86'], grav: 200, drag: 1.6
    });
    FX.ring(this.x, this.y - this.h * 0.5, 3, 26, 0.3, '#c8d4e8', 2);
    if (this.dropEl) {
      World.pickups.push({
        kind: 'stone', el: this.dropEl, x: this.x, y: this.y - 6, taken: false, t: 0
      });
    }
  }

  draw(g, t) {
    if (this.dead) return;
    // 子类可以整个覆盖；这里给个占位方块，方便还没画贴图时调试
    const px = Math.round(this.x), py = Math.round(this.y);
    D.rect(g, px - this.w / 2, py - this.h, this.w, this.h, '#3d4a63');
    D.rect(g, px - this.w / 2 + 1, py - this.h + 1, this.w - 2, 2, '#55648a');
    // 血条
    const bw = Math.max(8, this.w);
    D.rect(g, px - bw / 2, py - this.h - 5, bw, 2, '#1a1f2c');
    D.rect(g, px - bw / 2, py - this.h - 5, bw * Math.max(0, this.hp) / this.maxHp, 2, '#d24a4a');
    if (this.hurtT > 0) {
      g.globalCompositeOperation = 'lighter';
      D.rect(g, px - this.w / 2, py - this.h, this.w, this.h, 'rgba(255,255,255,0.8)');
      g.globalCompositeOperation = 'source-over';
    }
  }
}
