'use strict';

// ============================================================
//  训练场（纯关卡数据）：平地 + 六种魔法石 + 木桩 + 岩壁
// ============================================================

World.LEVELS = World.LEVELS || {};

World.LEVELS.training = {
  id: 'training',
  name: '训练场',
  bx0: -60, bx1: 1300,
  by0: -60, by1: 470,
  spawn: { x: 90, y: GY },

  build(self) {
    const S = (x, y, w, h, mat, extra) => {
      const s = { x, y, w, h, mat };
      if (extra) Object.assign(s, extra);
      self.solids.push(s);
      return s;
    };

    // 平地
    S(-60, GY, 1360, 246, 'earth');
    // 右侧岩壁（练投矛扎墙 / 收矛爬墙）
    S(1000, 72, 80, 152, 'rock');
    S(956, 152, 44, 10, 'rock', { ledge: true });
    // 几块练习台阶
    S(300, 176, 40, 10, 'rock');
    S(360, 140, 40, 10, 'rock');
    S(420, 104, 40, 10, 'rock');
    // 木桩（纯装饰/手感反馈）
    self.dummies = [{ x: 640, y: GY, hp: 1, flash: 0 }];

    self.checkpoints = [{ x: 90, y: GY, on: true }];
    // 五种魔法石摆在出生点右边
    const els = ['fire', 'lightning', 'light', 'ice', 'water', 'wind'];
    for (let i = 0; i < els.length; i++) {
      self.pickups.push({ kind: 'stone', el: els[i], x: 150 + i * 44, y: GY - 14, taken: false, t: i * 0.6 });
    }
    // 装饰
    const d = (o) => self.decor.push(o);
    d({ t: 'tree', x: 20, y: GY, h: 66, s: 1.0, v: 0 });
    d({ t: 'tree', x: 700, y: GY, h: 72, s: 1.05, v: 2 });
    d({ t: 'tree', x: 900, y: GY, h: 58, s: 0.9, v: 1 });
    d({ t: 'tree', x: 1180, y: GY, h: 78, s: 1.1, v: 0 });
    for (let x = -40; x < 1290; x += 32) {
      const n = U.hash(x, 3);
      if (n < 0.3) d({ t: 'bush', x, y: GY, s: 0.7 + n });
      else if (n < 0.55) d({ t: 'fern', x, y: GY, s: 0.8 + n * 0.6 });
      else if (n < 0.68) d({ t: 'rockDeco', x, y: GY, s: 0.6 + n * 0.5 });
    }
  }
};
