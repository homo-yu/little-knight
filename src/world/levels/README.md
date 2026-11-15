# 关卡数据

一个文件 = 一关，只放数据，不写逻辑。

```js
World.LEVELS.level2 = {
  id: 'level2',
  name: '第二关 · xxx',
  bx0: -60, bx1: 2600,        // 镜头边界
  by0: -60, by1: 470,
  spawn: { x: 70, y: GY },    // 出生点
  enemies: [                   // 摆怪（entity/enemies/ 里注册过 type）
    { type: 'skeleton', x: 900, y: GY },
  ],
  build(self) {
    const S = (x, y, w, h, mat, extra) => { ... self.solids.push(s); return s; };
    const d = (o) => self.decor.push(o);
    self.pickups.push({ kind: 'stone', el: 'fire', x: 300, y: 195, taken: false, t: 0 });
    self.checkpoints.push({ x: 70, y: GY });
  }
};
```

材质 `mat`：`earth` / `rock` / `wood` / `stone` / `thorn`
