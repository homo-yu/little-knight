# 源码分层

```
src/
  core/        引擎层（与具体游戏无关，可整包复用）
    util.js        常量 / 调色板 PAL / 绘制原语 D / 数学 U
    input.js       键鼠输入
    fx.js          特效系统 FX（粒子 / 环 / 爆闪 / 光 / 震屏 / 闪白）
  fx/
    elements.js    元素定义 EL + 弹道与招式 Magic（火球/水球/冰锥/雷/龙卷风）
  world/
    world.js       World 主体：载入关卡、碰撞、镜头边界、检查点、烘焙调度、绘制
    terrain.js     地形烘焙 + 自然装饰绘制（Object.assign 挂到 World）
    reactions.js   元素命中 / 滞留路径 / 元素反应（Object.assign 挂到 World）
    levels/        关卡数据（纯数据，一关一个文件）
  entity/
    knight-sprite.js  骑士像素图与姿态烘焙
    player.js         玩家逻辑
    spear.js          投矛
    enemy.js          怪物基类 + ENEMY_TYPES 注册表（等怪物）
    enemies/          具体怪物，一怪一个文件
  ui/
    menu.js        主菜单 / 暂停 / 存档面板
    hints.js       世界内教学文字
    hud.js         HUD（预留）
  dev/
    selftest.js    自检（?test）
    demo.js        演示脚本（?demo=xxx）
  main.js          引擎启动 / 主循环 / 相机 / 光照 / 渲染管线
```

## 加载顺序（index.html）
`core → fx → entity → world(world → terrain → reactions → levels) → ui → main → dev`

## 加东西的正确姿势
- **加关**：`world/levels/level2.js` 复制改数值 → index.html 加一行 → `Game.startGame('level2')`
- **加怪**：`entity/enemies/xxx.js` 继承 `Enemy` → `ENEMY_TYPES.xxx = Xxx` → 关卡里 `enemies:[{type:'xxx',x,y}]`
- **加材质**：`world/terrain.js` 里加 `bakeXxx()`，在 `bake()` 分发
- **加元素**：`fx/elements.js` 的 `EL` 加一项 + `Magic` 加分支；反应写进 `world/reactions.js`
