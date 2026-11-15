'use strict';

// ============================================================
//  第一关 · 夜森林（纯关卡数据：地形 / 装饰 / 拾取 / 检查点）
//  加新关：复制本文件改数值，再在 index.html 里加一行 <script>
//  坐标系：x 向右，y 向下，地面 GY = 224
// ============================================================

World.LEVELS = World.LEVELS || {};

World.LEVELS.level1 = {
  id: 'level1',
  name: '第一关 · 夜森林',
  bx0: -60, bx1: 2040,
  by0: -60, by1: 470,
  spawn: { x: 70, y: GY },
  // enemies: [ { type: 'skeleton', x: 900, y: GY } ],   // <- 以后在这里摆怪

  build(self) {
    const S = (x, y, w, h, mat, extra) => {
      const s = { x, y, w, h, mat };
      if (extra) Object.assign(s, extra);
      self.solids.push(s);
      return s;
    };

    // --- 森林平地 (教学) ---
    S(-80, GY, 740, 246, 'earth');                    // -80 .. 660
    S(285, 200, 26, 24, 'wood');                      // 树桩
    S(392, 190, 46, 12, 'wood');                      // 倒木
    S(512, 186, 34, 10, 'rock');                      // 岩石台阶
    S(608, 166, 28, 10, 'rock');                      // 高一点的小岩台

    // --- 悬崖对岸（下方伸出一块承接岩檐，三段跳落点更宽容） ---
    S(865, 262, 61, 208, 'earth');                    // 865 .. 926（比近岸低 38px）

    // --- 垂直岩壁 ---
    S(884, 208, 42, 10, 'rock', { ledge: true });     // 凸出岩檐
    S(926, 16, 86, 470 - 16, 'rock');                 // 岩柱（顶面 y=16）
    S(966, 16, 46, 6, 'stone');                       // 台顶石座

    // --- 右侧下坡台阶 ---
    S(1016, 56, 34, 10, 'rock');
    S(1062, 100, 34, 10, 'rock');
    S(1108, 144, 34, 10, 'rock');
    S(1154, 188, 34, 10, 'rock');

    // --- 墓园地面 ---
    S(1012, GY, 1020, 246, 'earth');

    // --- 荆棘峡谷（唯一通路被荆棘堵死） ---
    S(1270, -60, 40, 200, 'rock');                    // 隧道左壁（-60 .. 140）
    S(1270, -60, 210, 200, 'rock');                   // 顶部岩层封死
    S(1430, -60, 40, 200, 'rock');                    // 右侧岩壁

    self.thorns = S(1322, 140, 56, 84, 'thorn', { id: 'thorns', burn: 0, alive: true });

    // --- 祭坛 ---
    S(1884, 200, 40, 24, 'stone');
    S(1876, 210, 8, 14, 'stone');
    S(1924, 210, 8, 14, 'stone');

    // --- 检查点 ---
    self.checkpoints = [
      { x: 70, y: GY, on: true },
      { x: 600, y: GY, on: false },
      { x: 872, y: 262, on: false },
      { x: 1030, y: GY, on: false },
      { x: 1300, y: GY, on: false },
      { x: 1470, y: GY, on: false }
    ];

    // --- 魔法石 ---
    self.pickups = [
      { kind: 'stone', el: 'lightning', x: 972, y: 12, taken: false, t: 0 },
      { kind: 'stone', el: 'light', x: 1904, y: 195, taken: false, t: 0 }
    ];

    self._spawnList = self.solids.slice();

    // ---------------- 装饰 ----------------
    self.decor = [];
    const d = (o) => self.decor.push(o);

    // 森林
    const treeXs = [-40, 30, 120, 205, 262, 330, 356, 470, 540, 580, 646, 700, 760];
    const treeV = [2, 0, 1, 2, 0, 1, 0, 2, 1, 0, 2, 1, 0];
    const treeH = [72, 58, 86, 64, 92, 74, 60, 80, 66, 90, 70, 62, 84];
    const treeS = [0.92, 1.0, 0.8, 1.05, 0.88, 1.1, 0.95, 0.85, 1.0, 0.9, 1.05, 0.88, 0.96];
    for (let i = 0; i < treeXs.length; i++) {
      d({ t: 'tree', x: treeXs[i], y: GY, h: treeH[i], s: treeS[i], v: treeV[i] });
    }
    d({ t: 'tree', x: 862, y: GY, h: 66, s: 1.05, v: 0 });
    d({ t: 'tree', x: 898, y: GY, h: 46, s: 0.75, v: 1 });
    // 灌木/蕨/蘑菇
    for (let x = -50; x < 660; x += U.randInt(18, 46)) {
      const r = U.hash(x, 7);
      if (r < 0.42) d({ t: 'bush', x, y: GY, s: 0.7 + r });
      else if (r < 0.72) d({ t: 'fern', x, y: GY, s: 0.8 + r * 0.5 });
      else d({ t: 'rockDeco', x, y: GY, s: 0.6 + r * 0.6 });
    }
    for (let x = 840; x < 920; x += U.randInt(14, 30)) {
      if (U.hash(x, 11) < 0.6) d({ t: 'fern', x, y: GY, s: 0.7 + U.hash(x, 12) * 0.6 });
    }
    // 台顶草
    for (let x = 930; x < 1010; x += 9) d({ t: 'fern', x, y: 16, s: 0.5 + U.hash(x, 21) * 0.4 });

    // 墓园：枯树 + 墓碑 + 铁栅
    for (let x = 1200; x < 2000; x += U.randInt(48, 92)) {
      d({ t: 'deadTree', x, y: GY, h: 50 + U.hash(x, 31) * 46, s: 0.9 + U.hash(x, 32) * 0.4 });
    }
    const graves = [1188, 1226, 1258, 1450, 1478, 1500, 1536, 1570, 1602, 1640, 1672, 1704, 1740, 1772, 1806, 1840, 1862, 1936, 1952, 1978];
    for (let i = 0; i < graves.length; i++) {
      d({ t: 'grave', x: graves[i], y: GY, v: i % 3, s: 0.85 + U.hash(i, 41) * 0.4 });
    }
    d({ t: 'fence', x: 1120, y: GY, n: 5 });
    d({ t: 'fence', x: 1812, y: GY, n: 4 });
    d({ t: 'fence', x: 1930, y: GY, n: 3 });

    // 岩壁上的苔藓与藤
    for (let y = 30; y < 220; y += U.randInt(16, 34)) {
      d({ t: 'vine', x: 926, y, s: 0.7 + U.hash(y, 51) * 0.6 });
    }
    d({ t: 'vine', x: 1012, y: 60, s: 1.1 });
    d({ t: 'vine', x: 1012, y: 150, s: 0.8 });
    // 岩檐
    d({ t: 'rockDeco', x: 908, y: 184, s: 1.1 });
    d({ t: 'rockDeco', x: 880, y: GY, s: 0.9 });
  }
};
