'use strict';

// ============================================================
//  玩家：移动 / 跳跃 / 冲刺 / 投矛 / 元素剑技 / 光刃状态机
//  精灵图在 knight-sprite.js，投矛在 spear.js
// ============================================================

const PH = {
  gravity: 780,
  maxFall: 430,
  run: 130,
  accel: 1450,
  airAccel: 980,
  fric: 1600,
  airFric: 420,
  jumpV: 312,
  airJumpV: 300,
  coyote: 0.10,
  buffer: 0.12,
  dashSpeed: 330,
  dashTime: 0.16,
  dashCd: 0.40,
  chargeFull: 0.72,
  throwMin: 300,
  throwMax: 560,
  spearLen: 26,
  lbMaxLen: 118,       // 光刃最大长度 ≈ 二段跳极限高度
  lbHold: 0.5,         // 水平滞留时长（冲击后）
  lbAfter: 0.85        // 爆散光粒消散期间仍然定身
};
// ------------------------------------------------------------
//  玩家
// ------------------------------------------------------------
class Player {
  constructor() {
    this.w = 8;
    this.h = 15;
    this.x = 70; this.y = GY;
    this.vx = 0; this.vy = 0;
    this.grounded = false;
    this.facing = 1;
    this.airJumpsUsed = 0;
    this.airBudget = 1;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashDir = 1;
    this.boostT = 0;
    this.weapon = 'sword';
    this.charging = false;
    this.chargeT = 0;
    this.enchant = false;
    this.attackT = 1;
    this.attackDur = 0.16;
    this.swingA0 = 0; this.swingA1 = 0;
    this.aimAng = 0;
    this.walkPhase = 0;
    this.animT = 0;
    this.spear = new Spear(this);
    this.stones = ['fire'];
    this.elIndex = 0;
    this.cd = {};
    this.tapDir = 0;
    this.tapTime = -1;
    this.ghosts = [];
    this.castT = 1;
    this.moveLock = 0;
    this.lb = { phase: 'idle', t: 0, time: 0, charge: 0, ang: -Math.PI / 2, len: 0, dir: 1, wm: 1, tier: 0, ghosts: [] };
    this.state = 'idle';
    this.landT = 0;
    this.respawnT = 0;
    this.dead = false;
    this.recallBoost = false;
    this.boostT = 0;
    this.moveLock = 0;
  }

  currentEl() { return this.stones[this.elIndex]; }
  ready(el) { return (this.cd[el] || 0) <= 0; }
  consume(el) { this.cd[el] = EL[el].cd; }

  handPos() {
    return {
      x: this.x + this.facing * 3,
      y: this.y - 13
    };
  }

  hasStone(el) { return this.stones.indexOf(el) >= 0; }
  addStone(el) {
    if (this.hasStone(el)) return;
    this.stones.push(el);
    this.elIndex = this.stones.length - 1;
  }

  respawn(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.dead = false;
    this.respawnT = 0;
    this.airJumpsUsed = 0;
    this.airBudget = 1;
    this.charging = false;
    this.chargeT = 0;
    this.dashT = 0;
    if (this.spear.state !== 'held') {
      if (this.spear.plat) {
        const i = World.dynamic.indexOf(this.spear.plat);
        if (i >= 0) World.dynamic.splice(i, 1);
        this.spear.plat = null;
      }
      this.spear.state = 'held';
      this.spear.el = null;
    }
  }

  onSpearCaught() {
    // 收矛 → 空中跳跃次数刷新一次（并给下一次空中起跳一个向前借力）
    this.airBudget = Math.min(2, this.airBudget + 1);
    this.recallBoost = true;
    this.airJumpsUsed = Math.max(0, this.airJumpsUsed - 1);
    FX.flash('#bcd4ff', 0.06, 9);
  }

  // ---------------------------------------------------------
  update(dt, t) {
    this.animT += dt;
    if (this.moveLock > 0) this.moveLock = Math.max(0, this.moveLock - dt);
    const locked = this.moveLock > 0;
    const mouse = Input.mouse;
    const hp = this.handPos();
    this.aimAng = Math.atan2(mouse.wy - hp.y, mouse.wx - hp.x);

    // 计时器
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    this.attackT = Math.min(this.attackT + dt, 1);
    this.castT = Math.min(this.castT + dt, 1);
    this.landT = Math.max(0, this.landT - dt);

    const left = Input.isDown('KeyA') || Input.isDown('ArrowLeft');
    const right = Input.isDown('KeyD') || Input.isDown('ArrowRight');
    let dir = (right ? 1 : 0) - (left ? 1 : 0);
    this.moveDir = dir;

    // ---- 双击方向键冲刺 ----
    for (const [code, d] of [['KeyA', -1], ['KeyD', 1], ['ArrowLeft', -1], ['ArrowRight', 1]]) {
      if (Input.wasPressed(code)) {
        if (this.tapTime >= 0 && t - this.tapTime < 0.26 && this.tapDir === d) {
          this.startDash(d);
          this.tapTime = -1;
        } else {
          this.tapDir = d;
          this.tapTime = t;
        }
      }
    }

    // ---- 切换武器 ----
    if (Input.wasPressed('KeyQ')) {
      this.weapon = this.weapon === 'sword' ? 'spear' : 'sword';
      if (this.charging) { this.charging = false; this.chargeT = 0; this.enchant = false; }
      FX.burst(hp.x, hp.y, 6, {
        spread: Math.PI, spdMin: 10, spdMax: 50, life: 0.25,
        sizeMin: 1, sizeMax: 2, col: ['#dfe8f7', '#8fa2c0'], drag: 3
      });
    }

    // ---- 切换魔法石（滚轮 / 右键） ----
    let cycle = 0;
    if (mouse.wheel !== 0) cycle = Math.sign(mouse.wheel);
    if (mouse.rightPressed) cycle = 1;
    if (cycle !== 0 && this.stones.length > 1) {
      this.elIndex = (this.elIndex + (cycle > 0 ? 1 : this.stones.length - 1)) % this.stones.length;
      const c = EL[this.currentEl()];
      FX.burst(hp.x, hp.y, 10, {
        spread: Math.PI, spdMin: 12, spdMax: 60, life: 0.3,
        sizeMin: 1, sizeMax: 2, col: [c.core, c.mid], drag: 3
      });
      FX.light(hp.x, hp.y, 30, c.lightCol, 0.8, 0.2);
    }

    // ---- 投矛收回 ----
    if (Input.wasPressed('KeyS')) {
      if (this.spear.state === 'stuck') {
        this.spear.recall();
        FX.shake(1.2);
      }
    }

    // ---- 左键蓄力 ----
    const lbDown = mouse.left;
    if (lbDown && !this.charging && !locked) {
      // 有矛在手才能蓄力投矛；持剑时也能蓄力剑技
      this.charging = true;
      this.chargeT = 0;
      this.enchant = false;
    }
    if (this.charging) {
      if (lbDown) {
        this.chargeT = Math.min(this.chargeT + dt, 1.2);
        if (this.weapon === 'spear' && this.spear.state !== 'held') {
          // 矛不在手上 → 取消蓄力
          this.charging = false;
          this.chargeT = 0;
        }
        // 光刃：只有站在陆地上、附魔为光时，才在聚能点往上长
        const lbOn = this.weapon === 'sword' && this.enchant
          && this.currentEl() === 'light' && this.grounded;
        if (lbOn) {
          if (this.lb.phase !== 'charge') { this.lb.phase = 'charge'; this.lb.time = 0; this.lb.tier = 0; }
          this.lb.time += dt;
          const gr = this.lightBladeGrowth(this.lb.time);
          this.lb.charge = gr.lenK;
          this.lb.wm = gr.wm;
          this.lb.len = 12 + gr.lenK * (PH.lbMaxLen - 12);
          if (gr.tier > this.lb.tier) {
            this.lb.tier = gr.tier;
            // 升阶：一圈冲击 + 震屏
            const hp2 = this.handPos();
            FX.ring(hp2.x, hp2.y - this.lb.len * 0.5, 6, this.lb.len * 0.6 + 18, 0.36, EL.light.core, 2);
            FX.flash('#fff6d8', 0.16, 9);
            FX.shake(3 + gr.tier * 2);
          }
          this.emitLightGather();
        } else if (this.lb.phase === 'charge') {
          this.lb.phase = 'idle';
          this.lb.time = 0;
        }
        // 蓄力：聚能点（武器尖端）汇聚对应元素的粒子
        const full = U.clamp(this.chargeT / PH.chargeFull, 0, 1);
        if (!lbOn) this.chargeFocusFX(full);
      } else {
        this.release(lbDown);
      }
    }

    // ---- W：释放魔法 / 蓄力中附魔 / 风位移 ----
    if (Input.wasPressed('KeyW') && !locked) {
      const el = this.currentEl();
      if (this.charging) {
        if (el === 'wind') {
          // 风不能附着长矛：持矛蓄力时按 W = 普通风魔法（位移）
          if (this.weapon === 'spear' && this.ready(el)) {
            this.windDash(hp);
          } else if (this.ready(el)) {
            // 持剑：附魔成风，松手打出龙卷风
            this.enchant = true;
            const cw = EL.wind;
            FX.ring(hp.x, hp.y, 3, 22, 0.24, cw.mid, 1);
            FX.light(hp.x, hp.y, 44, cw.lightCol, 1, 0.2);
            for (let i = 0; i < 12; i++) {
              const a = U.rand(0, Math.PI * 2);
              FX.particle({
                x: hp.x + Math.cos(a) * 20, y: hp.y + Math.sin(a) * 20,
                vx: -Math.cos(a) * 80, vy: -Math.sin(a) * 80,
                life: 0.26, size: 1, col: U.chance(0.5) ? cw.core : cw.hot, drag: 2
              });
            }
          }
        } else if (this.ready(el) && !EL[el].noAttach) {
          this.enchant = true;
          const c = EL[el];
          FX.ring(hp.x, hp.y, 3, 20, 0.22, c.mid, 1);
          FX.light(hp.x, hp.y, 40, c.lightCol, 1, 0.2);
          for (let i = 0; i < 10; i++) {
            const a = U.rand(0, Math.PI * 2);
            FX.particle({
              x: hp.x + Math.cos(a) * 18, y: hp.y + Math.sin(a) * 18,
              vx: -Math.cos(a) * 70, vy: -Math.sin(a) * 70,
              life: 0.25, size: 2, col: U.chance(0.5) ? c.core : c.mid, drag: 2
            });
          }
        }
      } else {
        if (this.ready(el)) {
          if (el === 'wind') {
            this.windDash(hp);
          } else {
            this.castT = 0;
            Magic.cast(el, hp.x, hp.y, mouse.wx, mouse.wy);
            this.consume(el);
            this.facing = Math.cos(this.aimAng) >= 0 ? 1 : -1;
            this.vx += Math.cos(this.aimAng) * -22;   // 后坐
          }
        } else {
          // 冷却中：短促提示
          FX.ring(hp.x, hp.y, 8, 3, 0.25, '#5a6272', 1);
        }
      }
    }

    // ---- 跳跃 ----
    if (Input.wasPressed('Space')) this.jumpBuf = PH.buffer;
    if (this.jumpBuf > 0 && !locked) {
      if (this.grounded || this.coyote > 0) {
        this.doJump(PH.jumpV, false);
        this.coyote = 0;
        this.jumpBuf = 0;
      } else if (this.airJumpsUsed < this.airBudget) {
        this.doJump(PH.airJumpV, true);
        this.airJumpsUsed++;
        this.jumpBuf = 0;
      }
    }
    // 可变跳跃高度
    if (!Input.isDown('Space') && this.vy < -90) this.vy += 1500 * dt;

    // ---- 冲刺 ----
    if ((Input.wasPressed('ShiftLeft') || Input.wasPressed('ShiftRight')) && this.dashCd <= 0 && this.dashT <= 0 && !locked) {
      this.startDash(dir !== 0 ? dir : this.facing);
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDir * PH.dashSpeed;
      this.vy = 0;
      if (U.chance(0.9)) {
        this.ghosts.push({ x: this.x, y: this.y, f: this.facing, t: 0, life: 0.2 });
      }
      if (this.dashT <= 0) {
        this.vx *= 0.45;
        this.dashCd = PH.dashCd;
      }
    } else if (this.lb.phase === 'charge' || locked) {
      // 光刃蓄力 / 光刃后摇：定身
      this.vx = 0;
    } else if (this.boostT > 0) {
      // 收矛借力的短暂冲量：保持高速，不吃空气阻力
      this.boostT -= dt;
    } else {
      // 常规移动
      const acc = this.grounded ? PH.accel : PH.airAccel;
      if (dir !== 0) {
        this.vx = U.approach(this.vx, dir * PH.run, acc * dt);
      } else {
        this.vx = U.approach(this.vx, 0, (this.grounded ? PH.fric : PH.airFric) * dt);
      }
    }

    // ---- 重力 ----
    if (this.dashT <= 0) {
      this.vy = Math.min(this.vy + PH.gravity * dt, PH.maxFall);
    }

    // ---- 移动 & 碰撞 ----
    const wasGrounded = this.grounded;
    World.moveAndCollide(this, dt);
    if (this.grounded) {
      this.airJumpsUsed = 0;
      if (!wasGrounded) {
        // 只在落地瞬间重置跳跃额度：收矛加成可保留到下一次落地
        this.airBudget = 1;
        this.onLand();
      }
      this.coyote = PH.coyote;
    }

    // 边界
    if (this.x < World.boundX0 + 8) { this.x = World.boundX0 + 8; this.vx = 0; }
    if (this.x > World.boundX1 - 8) { this.x = World.boundX1 - 8; this.vx = 0; }

    // 朝向
    const aiming = this.charging || this.attackT < this.attackDur || this.castT < 0.18 || (Math.abs(this.vx) < 6);
    if (aiming) {
      const ax = Math.cos(this.aimAng);
      if (Math.abs(ax) > 0.15) this.facing = ax > 0 ? 1 : -1;
    } else if (Math.abs(this.vx) > 10) {
      this.facing = this.vx > 0 ? 1 : -1;
    }

    // 走路相位
    if (this.grounded && Math.abs(this.vx) > 12) {
      this.walkPhase += dt * (4 + Math.abs(this.vx) * 0.055);
    } else {
      this.walkPhase = U.damp(this.walkPhase, Math.round(this.walkPhase / Math.PI) * Math.PI, 12, dt);
    }

    // 状态
    if (this.dashT > 0) this.state = 'dash';
    else if (!this.grounded) this.state = this.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.vx) > 12) this.state = 'run';
    else this.state = 'idle';

    // 残影衰减
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      this.ghosts[i].t += dt;
      if (this.ghosts[i].t >= this.ghosts[i].life) this.ghosts.splice(i, 1);
    }

    // 掉落（坑）
    if (this.y > World.boundY1 + 30) {
      Game.killPlayer('fall');
    }

    this.spear.update(dt);
    this.updateLightBlade(dt);
  }

  doJump(v, air) {
    this.vy = -v;
    if (air && this.recallBoost) {
      this.recallBoost = false;
      const d = this.moveDir || this.facing;
      this.vx = d * 250;
      this.boostT = 0.34;
      FX.ring(this.x, this.y - 6, 2, 16, 0.22, '#cfe0ff', 1);
    }
    this.grounded = false;
    const hp = this.handPos();
    if (air) {
      FX.ring(this.x, this.y - 2, 2, 14, 0.25, '#dfe8f7', 1);
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * 2 * (i / 8);
        FX.particle({
          x: this.x + Math.cos(a) * 5, y: this.y - 2 + Math.sin(a) * 2,
          vx: Math.cos(a) * 40, vy: Math.sin(a) * 20 + 10,
          life: 0.25, size: 1, col: '#c9d6ea', drag: 3
        });
      }
    } else {
      for (let i = 0; i < 6; i++) {
        FX.particle({
          x: this.x + U.rand(-4, 4), y: this.y,
          vx: U.rand(-40, 40), vy: U.rand(-20, 5),
          life: 0.3, size: U.rand(1, 2), col: '#6f7f96', add: false, drag: 3
        });
      }
    }
  }

  onLand() {
    this.landT = 0.12;
    for (let i = 0; i < 7; i++) {
      FX.particle({
        x: this.x + U.rand(-5, 5), y: this.y,
        vx: U.rand(-55, 55), vy: U.rand(-26, -4),
        life: 0.3, size: U.rand(1, 2), col: '#7f8fa8', add: false, drag: 4
      });
    }
  }

  startDash(d) {
    this.dashT = PH.dashTime;
    this.dashDir = d;
    this.dashCd = PH.dashCd;
    this.facing = d;
    FX.burst(this.x, this.y - 6, 10, {
      dir: d > 0 ? Math.PI : 0, spread: 0.8, spdMin: 30, spdMax: 110,
      life: 0.3, sizeMin: 1, sizeMax: 3, col: ['#a8b6cc', '#dfe8f7', '#6d7b90'], drag: 3
    });
    FX.shake(1.6);
  }

  // 松开左键
  release() {
    const full = U.clamp(this.chargeT / PH.chargeFull, 0, 1);
    const el = this.enchant && this.ready(this.currentEl()) ? this.currentEl() : null;
    const hp = this.handPos();

    if (this.weapon === 'spear') {
      if (this.spear.state === 'held') {
        const spd = U.lerp(PH.throwMin, PH.throwMax, full);
        this.spear.throwIt(this.aimAng, spd, el);
        this.attackT = 0; this.attackDur = 0.18;
        this.swingA0 = this.aimAng; this.swingA1 = this.aimAng;
        if (el) this.consume(el);
        this.facing = Math.cos(this.aimAng) >= 0 ? 1 : -1;
      }
    } else {
      // 光刃：竖直向下劈到水平，水平瞬间触发冲击
      if (el === 'light' && this.lb.phase === 'charge' && this.lb.tier >= 1) {
        this.lb.phase = 'swing';
        this.lb.t = 0;
        this.lb.dir = Math.cos(this.aimAng) >= 0 ? 1 : -1;
        this.lb.ang = -Math.PI / 2;
        this.facing = this.lb.dir;
        this.consume('light');
        this.attackT = 0; this.attackDur = 0.2;
        this.swingA0 = -Math.PI / 2; this.swingA1 = this.lb.dir > 0 ? 0 : -Math.PI;
        this.moveLock = 0.14;      // 劈砍起手就动不了
      } else if (el === 'wind') {
        // 风：向前打出可染色的龙卷风
        this.lb.phase = 'idle';
        const dir = Math.cos(this.aimAng) >= 0 ? 1 : -1;
        Magic.spawnTornado(this.x + dir * 12, this.y, dir, full);
        this.attackT = 0; this.attackDur = 0.2;
        this.swingA0 = this.aimAng - 1.2; this.swingA1 = this.aimAng + 0.9;
        this.facing = dir;
        this.consume('wind');
      } else {
        // 普通元素剑技
        this.lb.phase = 'idle';
        const cx = this.x + Math.cos(this.aimAng) * 6;
        const cy = this.y - 12 + Math.sin(this.aimAng) * 3;
        Magic.slash(cx, cy, this.aimAng, full, el);
        this.attackT = 0; this.attackDur = 0.18;
        this.swingA0 = this.aimAng - 1.1 - full * 0.4;
        this.swingA1 = this.aimAng + 0.85 + full * 0.5;
        if (el) this.consume(el);
        this.facing = Math.cos(this.aimAng) >= 0 ? 1 : -1;
      }
    }

    this.charging = false;
    this.chargeT = 0;
    this.enchant = false;
  }

  // ---------------- 风：位移 ----------------
  windDash(hp) {
    const a = this.aimAng;
    const dx = Math.cos(a), dy = Math.sin(a);
    this.vx = dx * 320;
    if (dy < -0.2) this.vy = Math.min(this.vy, dy * 260) - 40;
    this.boostT = 0;
    this.facing = dx >= 0 ? 1 : -1;
    this.consume('wind');
    // 位移之后刷新一次空中跳跃次数
    this.airBudget = Math.min(2, this.airBudget + 1);
    this.airJumpsUsed = Math.max(0, this.airJumpsUsed - 1);
    const c = EL.wind;
    FX.ring(this.x, this.y - 10, 4, 26, 0.28, c.hot, 2);
    for (let i = 0; i < 16; i++) {
      const ang = a + Math.PI + U.rand(-1.0, 1.0);
      FX.particle({
        x: this.x + U.rand(-5, 5), y: this.y - U.rand(2, 18),
        vx: Math.cos(ang) * U.rand(60, 200), vy: Math.sin(ang) * U.rand(60, 200),
        life: U.rand(0.2, 0.45), size: U.rand(1, 2),
        col: U.chance(0.5) ? c.core : c.hot, drag: 2.5
      });
    }
    FX.shake(2);
    void hp;
  }

  // 光刃蓄力曲线：3s=1/3 长，7s=2/3 长 + 1.2 宽，12s=满长 + 1.5 宽
  lightBladeGrowth(t) {
    if (t < 3) return { lenK: (t / 3) / 3, wm: 1.0, tier: 0 };
    if (t < 7) { const k = (t - 3) / 4; return { lenK: 1 / 3 + k / 3, wm: 1.0 + 0.2 * k, tier: 1 }; }
    if (t < 12) { const k = (t - 7) / 5; return { lenK: 2 / 3 + k / 3, wm: 1.2 + 0.3 * k, tier: 2 }; }
    return { lenK: 1, wm: 1.5, tier: 3 };
  }

  // 聚能点：按当前元素喷不同粒子，向武器尖端汇聚
  chargeFocusFX(full) {
    const el = this.enchant ? EL[this.currentEl()] : null;
    const hp = this.handPos();
    const ang = this.aimAng;
    const wl = this.weapon === 'sword' ? 12 : 24;
    const tx = hp.x + Math.cos(ang) * wl;
    const ty = hp.y + Math.sin(ang) * wl;
    const n = full > 0.6 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      if (!U.chance(0.55 + full * 0.35)) continue;
      const a = U.rand(0, Math.PI * 2);
      const r = U.rand(9, 18 + full * 6);
      const px = tx + Math.cos(a) * r, py = ty + Math.sin(a) * r;
      const shape = el && el.key === 'ice' ? 'snow' : undefined;
      FX.particle({
        x: px, y: py,
        vx: (tx - px) * 3.4 + U.rand(-8, 8),
        vy: (ty - py) * 3.4 + U.rand(-20, -4),
        life: 0.15,
        size: shape ? 2 : 1,
        col: el ? (U.chance(0.5) ? el.hot : el.mid) : '#bcd4ff',
        shape: shape,
        drag: 0
      });
    }
    // 聚能点核心闪烁
    if (U.chance(0.35)) {
      FX.particle({
        x: tx + U.rand(-2, 2), y: ty + U.rand(-2, 2),
        vx: U.rand(-12, 12), vy: U.rand(-28, -8),
        life: 0.2, size: 1,
        col: el ? el.core : '#ffffff', drag: 1
      });
    }
    if (full >= 0.99 && U.chance(0.25)) {
      FX.ring(tx, ty, 2, 12, 0.22, el ? el.hot : '#dfe8f7', 1);
    }
  }

  // 光粒子沿【整条剑身】被吸进去
  emitLightGather() {
    const b = this.lb;
    this.lbGt = (this.lbGt || 0) + 1;
    if (this.lbGt % 2 !== 0) return;
    const hp = this.handPos();
    const len = Math.max(12, b.len);
    for (let i = 0; i < 3; i++) {
      const along = U.rand(0.08, 1) * len;
      const tx = hp.x, ty = hp.y - along;
      const a = U.rand(0, Math.PI * 2);
      const r = U.rand(13, 26 + along * 0.25);
      const px = tx + Math.cos(a) * r, py = ty + Math.sin(a) * r;
      FX.particle({
        x: px, y: py,
        vx: (tx - px) * 3.4, vy: (ty - py) * 3.4,
        life: 0.16, size: 1,
        col: U.chance(0.4) ? '#ffffff' : EL.light.hot, drag: 0
      });
    }
    if (b.charge > 0.9 && U.chance(0.5)) {
      const along = U.rand(0.5, 1) * len;
      FX.particle({
        x: hp.x + U.rand(-3, 3), y: hp.y - along,
        vx: U.rand(-20, 20), vy: U.rand(-40, -10),
        life: 0.3, size: 1, col: '#ffffff', drag: 2
      });
    }
  }

  updateLightBlade(dt) {
    const b = this.lb;
    // 曳影老化
    if (b.ghosts && b.ghosts.length) {
      for (let i = b.ghosts.length - 1; i >= 0; i--) {
        b.ghosts[i].t += dt;
        if (b.ghosts[i].t >= b.ghosts[i].life) b.ghosts.splice(i, 1);
      }
    }
    if (b.phase === 'swing') {
      b.t += dt;
      if (this.moveLock < 0.1) this.moveLock = 0.1;
      const k = Math.min(1, b.t / 0.10);
      // 从竖直直接劈到目标侧的水平（-90° -> 0° 或 -180°），不会绕一圈
      const to = b.dir > 0 ? 0 : -Math.PI;
      b.ang = U.lerp(-Math.PI / 2, to, k * Math.sqrt(k));
      // 挥砍曳影：每帧留一道残影
      b.ghosts.push({ ang: b.ang, len: b.len, t: 0, life: 0.26, wm: b.wm });
      if (b.ghosts.length > 9) b.ghosts.shift();
      const hp = this.handPos();
      for (let i = 0; i < 4; i++) {
        FX.particle({
          x: hp.x + Math.cos(b.ang) * U.rand(8, b.len),
          y: hp.y + Math.sin(b.ang) * U.rand(8, b.len),
          vx: U.rand(-50, 50), vy: U.rand(-60, 20),
          life: U.rand(0.2, 0.5), size: U.rand(1, 3),
          col: U.chance(0.5) ? '#ffffff' : EL.light.hot, drag: 2
        });
      }
      if (k >= 1) this.lbImpact();
    } else if (b.phase === 'hold') {
      // 水平滞留：保持水平，持续冒光粒 + 持续抖动
      b.t += dt;
      b.ang = b.dir > 0 ? 0 : -Math.PI;
      FX.shake(1.9);
      const hp = this.handPos();
      for (let i = 0; i < 2; i++) {
        if (!U.chance(0.85)) continue;
        FX.particle({
          x: hp.x + Math.cos(b.ang) * U.rand(4, b.len),
          y: hp.y + Math.sin(b.ang) * U.rand(4, b.len) + U.rand(-5, 5),
          vx: U.rand(-40, 40), vy: U.rand(-70, -10),
          life: U.rand(0.3, 0.7), size: U.rand(1, 2),
          col: U.chance(0.5) ? '#ffffff' : EL.light.hot, drag: 1.6
        });
      }
      if (b.t > PH.lbHold) this.lbBurst();
    } else if (b.phase === 'fade') {
      b.t += dt;
      const hp = this.handPos();
      if (b.t < 0.4 && U.chance(0.9)) {
        const ang = b.ang + U.rand(-0.55, 0.55);
        const rr = U.rand(0, b.len);
        FX.particle({
          x: hp.x + Math.cos(ang) * rr, y: hp.y + Math.sin(ang) * rr,
          vx: U.rand(-80, 80), vy: U.rand(-110, 30),
          life: U.rand(0.3, 0.8), size: U.rand(1, 2),
          col: U.chance(0.5) ? '#ffffff' : EL.light.core, drag: 1.6
        });
      }
      if (b.t > 0.45) { b.phase = 'idle'; b.len = 0; }
    }
  }

  // 光刃结束：整体爆散成光粒子
  lbBurst() {
    const b = this.lb;
    const hp = this.handPos();
    const c = EL.light;
    const dx = Math.cos(b.ang), dy = Math.sin(b.ang);
    const L = b.len;
    // 沿整条刃喷出光粒
    for (let i = 0; i < 26; i++) {
      const along = U.rand(0.1, 1) * L;
      const px = hp.x + dx * along, py = hp.y + dy * along;
      for (let k = 0; k < 3; k++) {
        const a = U.rand(0, Math.PI * 2);
        const sp = U.rand(40, 260);
        FX.particle({
          x: px + U.rand(-2, 2), y: py + U.rand(-2, 2),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
          life: U.rand(0.4, 0.95), size: U.rand(1, 3),
          col: U.chance(0.4) ? '#ffffff' : (U.chance(0.6) ? c.core : c.hot),
          grav: 90, drag: 1.5
        });
      }
    }
    FX.blast(hp.x + dx * L * 0.5, hp.y + dy * L * 0.5, 6, 46, 0.3, '#ffffff', 0.9);
    FX.blast(hp.x + dx * L * 0.5, hp.y + dy * L * 0.5, 4, 30, 0.22, c.hot, 0.8);
    FX.ring(hp.x + dx * L * 0.5, hp.y + dy * L * 0.5, 6, 76, 0.5, c.core, 3);
    FX.ring(hp.x + dx * L * 0.5, hp.y + dy * L * 0.5, 4, 50, 0.36, '#ffffff', 2);
    FX.light(hp.x + dx * L * 0.5, hp.y + dy * L * 0.5, 240, c.lightCol, 1, 0.8);
    FX.flash('#ffffff', 0.42, 4.5);
    FX.shake(16);          // 最强烈
    b.ghosts.length = 0;
    b.phase = 'idle';
    b.len = 0;
    b.t = 0;
  }

  // 光刃劈到水平的瞬间
  lbImpact() {
    const b = this.lb;
    const hp = this.handPos();
    const ang = b.ang;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const ix = hp.x + dx * b.len * 0.86;
    const iy = hp.y + dy * b.len * 0.86;
    const power = 0.7 + (b.wm || 1) * 0.4;
    const c = EL.light;

    FX.flash('#04060c', 0.97, 11);
    if (typeof Game !== 'undefined') {
      if (Game.hitStop) Game.hitStop(0.13);
      if (Game.setImpactFrame) Game.setImpactFrame(hp.x, hp.y, ang, b.len);
    }
    FX.shake(13);

    FX.blast(ix, iy, 4, 34, 0.22, '#ffffff', 0.95);
    FX.blast(ix, iy, 3, 18, 0.14, c.hot, 0.85);
    FX.ring(ix, iy, 4, 46, 0.4, c.core, 3);
    FX.ring(ix, iy, 2, 28, 0.26, '#ffffff', 2);
    FX.beam(hp.x, hp.y, ang, b.len + 60 * power, 8, c.core, 0.22);
    FX.beam(hp.x, hp.y, ang, b.len + 90 * power, 3, '#ffffff', 0.16);
    // 只有水平一段的弧，不要画成大半个圆
    FX.crescent(hp.x, hp.y, b.len, ang - 0.34, ang + 0.34, 6 * power, c.hot, 0.32);
    FX.light(ix, iy, 200, c.lightCol, 1, 0.6);
    FX.light(hp.x, hp.y, 90, c.lightCol, 0.9, 0.3);
    for (let i = 0; i < 26; i++) {
      const a2 = ang + U.rand(-1.2, 1.2);
      FX.particle({
        x: ix, y: iy,
        vx: Math.cos(a2) * U.rand(60, 320), vy: Math.sin(a2) * U.rand(60, 320) - 40,
        life: U.rand(0.25, 0.7), size: U.rand(1, 3),
        col: U.chance(0.4) ? '#ffffff' : (U.chance(0.6) ? c.core : c.hot),
        grav: 120, drag: 2.2
      });
    }
    if (typeof World !== 'undefined') World.applyElementHit(ix, iy, b.len * 0.95, 'light');
    b.phase = 'hold';
    b.t = 0;
    b.time = 0;
    this.moveLock = PH.lbHold + PH.lbAfter;   // 滞留 + 粒子消散期间不能动
  }

  // ---------------------------------------------------------
  //  绘制
  // ---------------------------------------------------------
  poseName() {
    if (this.state === 'dash') return 'dash';
    if (this.state === 'jump') return 'jump';
    if (this.state === 'fall') return 'fall';
    if (this.state === 'run') return (Math.floor(this.walkPhase / Math.PI) % 2) ? 'runB' : 'runA';
    return 'idle';
  }

  draw(g, t) {
    // 冲刺残影
    if (this.ghosts.length) {
      for (const gh of this.ghosts) {
        const k = 1 - gh.t / gh.life;
        g.globalAlpha = k * 0.22;
        g.save();
        g.translate(Math.round(gh.x), Math.round(gh.y));
        g.scale(gh.f, 1);
        g.drawImage(KNIGHT.poses.idle, -9, -24);
        g.restore();
      }
      g.globalAlpha = 1;
    }

    this.drawBody(g, this.x, this.y, this.facing, t, false);
    this.drawWeapon(g, t);
    this.drawStoneRune(g, t);
  }

  drawBody(g, px, py, f, t, ghost) {
    const st = this.state;
    const bob = st === 'idle' ? Math.round(Math.sin(t * 3.1) * 0.6)
      : (st === 'run' ? Math.round(Math.abs(Math.sin(this.walkPhase)) * 1) : 0);
    const sq = this.landT > 0 ? 1 : 0;

    g.save();
    g.translate(Math.round(px), Math.round(py - bob + sq));
    g.scale(f, 1);

    // ---- 披风（身后，带褶皱与下摆） ----
    const speed = Math.min(1, Math.abs(this.vx) / 130);
    const sway = Math.sin(t * 2.3) * 0.6;
    const back = speed * 3.2 + (st === 'jump' ? 2.5 : 0) + (st === 'dash' ? 4 : 0);
    const C = KNIGHT.COL;
    const rows = 17;
    for (let i = 0; i < rows; i++) {
      const k = i / (rows - 1);
      const yy = -19 + k * 21;
      const outer = -2.6 - (2.2 + k * 3.6) - back * (0.15 + k * 1.1) + sway * (0.25 + k);
      const xo = Math.round(outer);
      for (let x = xo; x <= -1; x++) {
        let col = C.W;
        if (x === xo) col = C.w;
        else if ((x - xo) % 3 === 2) col = C.v;
        if (k > 0.9 && (x % 4 === 0)) continue;
        D.rect(g, x, yy, 1, 2, col);
      }
      D.rect(g, xo - 1, yy, 1, 2, '#12151f');
      // 下摆阴影
      if (i === rows - 1) {
        for (let x = xo; x <= -1; x++) if (U.hash(x, 3) > 0.4) D.rect(g, x, yy + 1, 1, 1, '#12151f');
      }
    }

    // ---- 本体 ----
    if (ghost) {
      g.globalAlpha = 0.35;
    }
    g.drawImage(KNIGHT.poses[this.poseName()], -9, -24);
    g.globalAlpha = 1;

    g.restore();
  }

  drawWeapon(g, t) {
    const hp = this.handPos();
    let ang = this.aimAng;

    // 光刃：整把剑被光元素取代
    if (this.lb.phase !== 'idle') {
      this.drawLightBlade(g, t);
      return;
    }

    // 挥砍/投掷动画
    if (this.attackT < this.attackDur) {
      const k = this.attackT / this.attackDur;
      ang = U.lerp(this.swingA0, this.swingA1, U.easeOutCubic(k));
    }

    const held = this.weapon === 'sword' || this.spear.state === 'held';
    if (!held) {
      // 空手（矛已扔出）
      return;
    }

    const el = (this.enchant || this.castT < 0.15) && this.ready(this.currentEl()) ? EL[this.currentEl()] : null;
    const c = el;
    let len, wdt;
    if (this.weapon === 'sword') { len = 12; wdt = 2; }
    else { len = 24; wdt = 2; }

    // 蓄力后拉
    let pull = 0;
    if (this.charging) pull = U.clamp(this.chargeT / PH.chargeFull, 0, 1) * 3;

    const bx = hp.x - Math.cos(ang) * pull;
    const by = hp.y - Math.sin(ang) * pull;
    const dx = Math.cos(ang), dy = Math.sin(ang);

    if (c) {
      g.globalCompositeOperation = 'lighter';
      D.glow(g, bx + dx * len * 0.6, by + dy * len * 0.6, 20, c.lightCol, 0.5);
      g.globalCompositeOperation = 'source-over';
    }

    if (this.weapon === 'sword') {
      // 剑柄 + 剑首
      D.line(g, bx - dx * 4, by - dy * 4, bx, by, '#12151f', 3);
      D.line(g, bx - dx * 4, by - dy * 4, bx, by, PAL.leather, 2);
      D.rect(g, bx - dx * 5 - 1, by - dy * 5 - 1, 2, 2, PAL.armorWarm);
      // 护手（垂直于剑身）
      const nx = -dy, ny = dx;
      D.line(g, bx - nx * 3, by - ny * 3, bx + nx * 3, by + ny * 3, '#12151f', 3);
      D.line(g, bx - nx * 2, by - ny * 2, bx + nx * 2, by + ny * 2, PAL.armorWarm, 2);
      // 剑身：暗底 + 钢面 + 白芯
      D.line(g, bx + dx * 2, by + dy * 2, bx + dx * len, by + dy * len, '#12151f', 3);
      D.line(g, bx + dx * 2 + nx, by + dy * 2 + ny, bx + dx * (len - 1) + nx, by + dy * (len - 1) + ny, c ? c.hot : PAL.armorHi, 2);
      D.line(g, bx + dx * 2 + nx, by + dy * 2 + ny, bx + dx * (len - 2) + nx, by + dy * (len - 2) + ny, c ? c.core : '#ffffff', 1);
    } else {
      // 矛杆
      D.line(g, bx - dx * 7, by - dy * 7, bx + dx * (len - 6), by + dy * (len - 6), '#241a12', 3);
      D.line(g, bx - dx * 7, by - dy * 7, bx + dx * (len - 6), by + dy * (len - 6), PAL.woodL, 2);
      D.line(g, bx - dx * 7, by - dy * 7, bx + dx * (len - 6), by + dy * (len - 6), PAL.woodHi, 1);
      // 握把
      D.line(g, bx, by, bx + dx * 4, by + dy * 4, PAL.leather, 3);
      // 矛头
      D.line(g, bx + dx * (len - 7), by + dy * (len - 7), bx + dx * len, by + dy * len, '#181d29', 3);
      D.line(g, bx + dx * (len - 6), by + dy * (len - 6), bx + dx * len, by + dy * len, c ? c.hot : PAL.armorHi, 2);
      D.line(g, bx + dx * (len - 6), by + dy * (len - 6), bx + dx * len, by + dy * len, c ? c.core : '#ffffff', 1);
    }

    // 手（护手）
    D.rect(g, hp.x - 1, hp.y - 1, 3, 3, PAL.armorD);
    D.rect(g, hp.x - 1, hp.y - 1, 2, 1, PAL.armorL);

    // 蓄力光球
    if (this.charging) {
      const full = U.clamp(this.chargeT / PH.chargeFull, 0, 1);
      const tipx = bx + dx * len, tipy = by + dy * len;
      g.globalCompositeOperation = 'lighter';
      D.glow(g, tipx, tipy, 6 + full * 10, c ? c.lightCol : '#bcd4ff', 0.5 + full * 0.4);
      D.disc(g, tipx, tipy, 1 + full * 1.6, c ? c.core : '#eaf2ff');
      g.globalCompositeOperation = 'source-over';
      if (full >= 1) {
        // 满蓄力：外圈脉冲
        g.globalCompositeOperation = 'lighter';
        D.circle(g, tipx, tipy, 5 + Math.sin(t * 12) * 1.2, c ? c.hot : '#dfe8f7', 1);
        g.globalCompositeOperation = 'source-over';
      }
    }
  }

  // 光刃绘制：矩形剑身 + 三角剑尖（上尖下宽的一条刀，不是锥形）
  drawLightBlade(g, t) {
    const b = this.lb;
    const hp = this.handPos();
    const L = EL.light;
    let len = b.len;
    let ang = b.ang;
    let alpha = 1;
    const wm = b.wm || 1;
    const holding = b.phase === 'hold';

    if (b.phase === 'charge') {
      len = b.len;
      ang = -Math.PI / 2 + Math.sin(t * 5) * 0.01;
    } else if (b.phase === 'hold') {
      len = b.len;
      ang = b.dir > 0 ? 0 : -Math.PI;
    } else if (b.phase === 'fade') {
      const k = Math.min(1, b.t / 0.4);
      alpha = 1 - k;
      len = b.len * (1 - k * 0.2);
    }

    // 挥砍曳影（跟着刀路留下的一道道残影）
    if (b.ghosts && b.ghosts.length) {
      for (const gh of b.ghosts) {
        const ga = gh.t / gh.life;
        const al = (1 - ga) * 0.38;
        if (al <= 0.02) continue;
        const gdx = Math.cos(gh.ang), gdy = Math.sin(gh.ang);
        const gw = Math.max(2, Math.round((3 + (gh.wm || 1) * 1.6) * (1 - ga * 0.5)));
        g.globalAlpha = al;
        D.line(g, hp.x + gdx * 5, hp.y + gdy * 5,
          hp.x + gdx * gh.len * 0.96, hp.y + gdy * gh.len * 0.96, L.mid, gw);
        D.line(g, hp.x + gdx * 5, hp.y + gdy * 5,
          hp.x + gdx * gh.len * 0.96, hp.y + gdy * gh.len * 0.96, L.core, 1);
        g.globalAlpha = 1;
      }
    }

    const dx = Math.cos(ang), dy = Math.sin(ang);
    const nx = -dy, ny = dx;
    // 剑身宽度（恒定矩形），剑尖占最后 20%
    const baseW = (3.2 + Math.min(1, len / 60) * 4.4) * wm;
    const tipLen = Math.max(7, len * 0.2);
    const bodyLen = Math.max(2, len - tipLen);

    // 蓄力时绕着刀身转的光环（画在刀身下方，不挡光刃）
    if (b.phase === 'charge' && len > 16) {
      const rings = 5;
      const ell = (cx, cy, rx, ry, a0, a1, col, aa) => {
        const n = Math.max(6, Math.round(Math.abs(a1 - a0) * rx * 0.55));
        g.fillStyle = col;
        g.globalAlpha = aa;
        for (let i = 0; i <= n; i++) {
          const a = a0 + (a1 - a0) * i / n;
          g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
        }
        g.globalAlpha = 1;
      };
      for (let i = 0; i < rings; i++) {
        const u = i / (rings - 1);
        const cy = hp.y - (0.12 + u * 0.8) * len;
        const rx = 9 + u * 6 + b.charge * 6;
        const ry = rx * 0.30;
        const spin = t * 2.6 + i * 1.7;
        // 后半圈（暗、细）
        ell(hp.x, cy, rx, ry, spin + Math.PI * 0.15, spin + Math.PI * 0.85, L.deep, 0.28);
        // 前半圈（亮）
        ell(hp.x, cy, rx, ry, spin - Math.PI * 0.9, spin - Math.PI * 0.1, L.hot, 0.5);
        // 环上一颗游走的亮点
        const ha = spin - Math.PI * 0.5;
        const hx2 = hp.x + Math.cos(ha) * rx, hy2 = cy + Math.sin(ha) * ry;
        g.globalCompositeOperation = 'lighter';
        D.glow(g, hx2, hy2, 6, L.core, 0.35);
        D.rect(g, hx2, hy2, 1, 1, '#ffffff');
        g.globalCompositeOperation = 'source-over';
      }
    }

    // 光晕
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = alpha * 0.55;
    D.glow(g, hp.x + dx * len * 0.5, hp.y + dy * len * 0.5, len * 0.30, L.hot, holding ? 0.18 : 0.14);
    D.glow(g, hp.x + dx * len, hp.y + dy * len, 11, L.core, 0.42);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    g.globalAlpha = alpha;
    for (let i = 1; i <= len; i++) {
      let w;
      if (i <= bodyLen) {
        w = baseW;                                  // 剑身：矩形
      } else {
        w = Math.max(0.8, baseW * (len - i) / tipLen);  // 剑尖：三角形
      }
      const ox = hp.x + dx * i, oy = hp.y + dy * i;
      const e = w + 1.4;
      D.line(g, ox - nx * e * 0.5, oy - ny * e * 0.5, ox + nx * e * 0.5, oy + ny * e * 0.5, L.deep, 1);
      D.line(g, ox - nx * w * 0.5, oy - ny * w * 0.5, ox + nx * w * 0.5, oy + ny * w * 0.5, L.mid, 1);
      if (w > 2.6) {
        D.line(g, ox - nx * w * 0.24, oy - ny * w * 0.24, ox + nx * w * 0.24, oy + ny * w * 0.24, L.hot, 1);
      }
    }
    // 白芯（剑身中轴）
    D.line(g, hp.x + dx * 2, hp.y + dy * 2,
      hp.x + dx * (len - tipLen * 0.5), hp.y + dy * (len - tipLen * 0.5), '#ffffff', 1);
    // 护手 + 手
    D.line(g, hp.x - nx * (baseW * 0.9), hp.y - ny * (baseW * 0.9),
      hp.x + nx * (baseW * 0.9), hp.y + ny * (baseW * 0.9), L.core, 2);
    D.line(g, hp.x - dx * 3, hp.y - dy * 3, hp.x, hp.y, PAL.leather, 2);
    D.rect(g, hp.x - 1, hp.y - 1, 3, 3, PAL.armorD);
    D.rect(g, hp.x - 1, hp.y - 1, 2, 1, PAL.armorL);

    g.globalCompositeOperation = 'lighter';
    D.rect(g, hp.x + dx * len - 1, hp.y + dy * len - 1, 2, 2, '#ffffff');
    if (b.phase === 'charge' || holding) {
      const pulse = 2 + Math.sin(t * 14) * 1.2;
      D.glow(g, hp.x + dx * len, hp.y + dy * len, 9 + pulse, L.core, 0.45);
      if (holding) {
        // 水平滞留：整条刃再亮一档
        D.glow(g, hp.x + dx * len * 0.5, hp.y + dy * len * 0.5, len * 0.45, L.core, 0.09);
      }
      if (b.tier >= 3) {
        D.circle(g, hp.x + dx * len, hp.y + dy * len, 6 + Math.sin(t * 12) * 2, L.core, 1);
      }
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }

  drawStoneRune(g, t) {
    const el = this.currentEl();
    const c = EL[el];
    const cd = this.cd[el] || 0;
    const ready = cd <= 0;
    const sc = c.stone || c.mid;
    const shi = c.stoneHi || c.core;
    const x = this.x;
    const y = this.y - 30 + Math.sin(t * 2.4) * 1.2;
    const col = ready ? shi : '#4b5464';
    const glowCol = ready ? sc : '#3a4252';

    g.globalCompositeOperation = 'lighter';
    D.glow(g, x, y, 9, glowCol, ready ? 0.35 : 0.12);
    g.globalCompositeOperation = 'source-over';

    // 菱形符文
    const mid = ready ? sc : '#39414f';
    D.rect(g, x, y - 3, 2, 1, mid);
    D.rect(g, x - 1, y - 2, 4, 3, mid);
    D.rect(g, x, y + 1, 2, 1, mid);
    D.rect(g, x, y - 2, 2, 2, col);
    D.rect(g, x + 1, y - 1, 1, 1, U.shade(col, 0.4));

    // 冷却环
    if (!ready) {
      const k = 1 - cd / EL[el].cd;
      D.arc(g, x, y, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, '#7d8aa6', 1);
    }
    // 多石时的小点
    if (this.stones.length > 1) {
      for (let i = 0; i < this.stones.length; i++) {
        const sx = x - (this.stones.length - 1) * 2.5 + i * 5;
        const on = i === this.elIndex;
        D.rect(g, sx - 0.5, y + 7, 2, on ? 2 : 1, on ? EL[this.stones[i]].core : '#4b5464');
      }
    }
  }
}
