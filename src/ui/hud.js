'use strict';

// ============================================================
//  HUD（屏幕空间 UI）：血条 / 元素轮盘 / 冷却 / 连击
//  目前只画一个血条占位，等有怪物/受伤系统后再接
//  调用：HUD.draw(g)  —— 在 main.render() 里、光照之后
// ============================================================

const HUD = {
  enabled: false,          // 打开后才会绘制

  draw(g) {
    if (!this.enabled) return;
    const p = Game.player;
    if (!p) return;
    // 生命条
    const x = 8, y = 8, w = 64, h = 6;
    D.rect(g, x - 1, y - 1, w + 2, h + 2, '#0b0f18');
    D.rect(g, x, y, w, h, '#2a1b1b');
    const k = U.clamp((p.hp || 3) / (p.maxHp || 3), 0, 1);
    D.rect(g, x, y, w * k, h, '#c8433f');
    D.rect(g, x, y, w * k, 2, '#e8706b');
  }
};
