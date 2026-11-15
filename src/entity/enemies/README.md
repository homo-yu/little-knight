# 怪物

一怪一个文件，继承 `Enemy`（见 `entity/enemy.js`），基类已经处理好：
重力与地形碰撞、血量、受击闪白与击退、元素附着（火/冰/水）、死亡粒子与掉落。

```js
'use strict';
class Skeleton extends Enemy {
  constructor(x, y, opts) {
    super(x, y, Object.assign({ w: 12, h: 20, hp: 4, dropEl: 'lightning' }, opts));
    this.speed = 46;
  }
  think(dt) {
    const P = Game.player;
    if (!P) return;
    this.face = P.x < this.x ? -1 : 1;
    this.vx = this.paralyze > 0 ? 0 : this.face * this.speed;
  }
  draw(g, t) { /* 画自己 */ }
}
ENEMY_TYPES.skeleton = Skeleton;
```

然后在关卡里 `enemies: [{ type: 'skeleton', x: 900, y: 224 }]`。
