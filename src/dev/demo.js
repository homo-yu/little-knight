'use strict';

// ============================================================
//  演示脚本（?demo=cast|slash|spear|lightblade|tornado）
//  只用于录屏 / 截图验证，发行版可以整份删掉
// ============================================================

Object.assign(Game, {

  updateDemo(dt) {
    if (!this.demoMode) return;
    this.demoT += dt;
    const mode = this.demoMode;
    let interval = 0.5;
    if (mode === 'slash') interval = 0.42;
    if (mode === 'spear') interval = 0.7;
    if (mode === 'lightblade' || mode === 'tornado') interval = 0;
    if (this.demoT < interval) return;
    this.demoT = 0;

    const p = this.player;
    const el = p.currentEl();

    if (mode === 'lightblade') {
      // 光刃演示：按住左键蓄力(光刃变长) -> 松开劈下 -> 水平冲击 -> 消散
      p.stones = ['light', 'fire'];
      p.elIndex = 0;
      p.cd.light = 0;
      const aimLeft = location.search.indexOf('aimL') >= 0;
      Input.mouse.sx = p.x - this.cam.x + (aimLeft ? -120 : 120);
      Input.mouse.sy = p.y - this.cam.y - 40;
      this.lbT = (this.lbT || 0) + dt;
      if (this.lbT < 13.0) {
        Input.mouse.left = true;
        p.enchant = true;
      } else {
        Input.mouse.left = false;
      }
      if (this.lbT > 16.0) { this.lbT = 0; }
      return;
    }

    if (mode === 'tornado') {
      // 风：蓄力 → 附魔 → 松手打出龙卷风
      p.stones = ['wind', 'fire'];
      p.elIndex = 0;
      p.cd.wind = 0;
      p.weapon = 'sword';
      Input.mouse.sx = p.x - this.cam.x + 150;
      Input.mouse.sy = p.y - this.cam.y - 20;
      this.lbT = (this.lbT || 0) + dt;
      if (this.lbT < 0.85) { Input.mouse.left = true; p.enchant = true; }
      else Input.mouse.left = false;
      if (this.lbT > 3.2) this.lbT = 0;
      return;
    }

    if (mode === 'slash') {
      p.facing = 1;
      p.aimAng = -0.55;
      Magic.slash(p.x + 6, p.y - 12, -0.55, 0.85, el);
      p.attackT = 0; p.attackDur = 0.18;
      p.swingA0 = -1.5; p.swingA1 = 0.2;
    } else if (mode === 'spear') {
      if (p.weapon !== 'spear') p.weapon = 'spear';
      if (p.spear.state === 'held') {
        p.aimAng = -0.35;
        p.spear.throwIt(-0.35, 520, el);
        p.attackT = 0; p.attackDur = 0.18;
      } else {
        p.spear.recall();
      }
    } else {
      const hp = p.handPos();
      p.facing = 1;
      p.aimAng = -0.3;
      Magic.cast(el, hp.x, hp.y, p.x + 90, p.y - 40);
      p.castT = 0;
    }
  },

});
