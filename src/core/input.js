'use strict';

// ============================================================
//  输入：键盘 + 鼠标（屏幕坐标 -> 480x270 基准坐标）
// ============================================================

const Input = {
  down: Object.create(null),
  pressed: Object.create(null),
  released: Object.create(null),
  mouse: {
    sx: GAME_W / 2, sy: GAME_H / 2,   // 基准分辨率下的屏幕坐标
    wx: 0, wy: 0,                     // 世界坐标（每帧由 main 更新）
    left: false, right: false,
    leftPressed: false, rightPressed: false,
    wheel: 0,
    inside: false
  },
  scale: 1,
  canvas: null,

  init(canvas) {
    this.canvas = canvas;

    addEventListener('keydown', (e) => {
      const c = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(c)) e.preventDefault();
      if (!this.down[c]) this.pressed[c] = true;
      this.down[c] = true;
    });
    addEventListener('keyup', (e) => {
      this.down[e.code] = false;
      this.released[e.code] = true;
    });
    addEventListener('blur', () => {
      for (const k in this.down) this.down[k] = false;
      this.mouse.left = false;
      this.mouse.right = false;
    });

    const toBase = (ev) => {
      const r = canvas.getBoundingClientRect();
      const s = this.scale || 1;
      this.mouse.sx = U.clamp((ev.clientX - r.left) / s, 0, GAME_W);
      this.mouse.sy = U.clamp((ev.clientY - r.top) / s, 0, GAME_H);
    };

    canvas.addEventListener('mousemove', (ev) => { toBase(ev); this.mouse.inside = true; });
    canvas.addEventListener('mousedown', (ev) => {
      toBase(ev);
      if (ev.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (ev.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
      ev.preventDefault();
    });
    addEventListener('mouseup', (ev) => {
      if (ev.button === 0) this.mouse.left = false;
      if (ev.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.mouse.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('mouseleave', () => { this.mouse.inside = false; });
  },

  isDown(code) { return !!this.down[code]; },
  wasPressed(code) { return !!this.pressed[code]; },
  wasReleased(code) { return !!this.released[code]; },

  // 每帧末清理一次性状态
  endFrame() {
    for (const k in this.pressed) delete this.pressed[k];
    for (const k in this.released) delete this.released[k];
    this.mouse.leftPressed = false;
    this.mouse.rightPressed = false;
    this.mouse.wheel = 0;
  }
};
