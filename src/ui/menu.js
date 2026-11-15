'use strict';

// ============================================================
//  菜单：主菜单 / 暂停菜单 / 存档面板
//  全部画在 480x270 的画布上，键鼠都能操作
// ============================================================

const Saves = {
  key: 'xxqs_saves_v1',
  slots: [null, null, null],
  memOnly: false,

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const a = JSON.parse(raw);
        if (Array.isArray(a) && a.length === 3) this.slots = a;
      }
    } catch (e) {
      this.memOnly = true;
    }
  },
  flush() {
    if (this.memOnly) return;
    try {
      localStorage.setItem(this.key, JSON.stringify(this.slots));
    } catch (e) {
      this.memOnly = true;
    }
  },
  write(i, data) { this.slots[i] = data; this.flush(); },
  clear(i) { this.slots[i] = null; this.flush(); },
  latest() {
    let best = null;
    for (const s of this.slots) {
      if (s && (!best || s.time > best.time)) best = s;
    }
    return best;
  }
};

const Menu = {
  visible: false,
  view: 'list',        // list | save
  title: '',
  sub: '',
  items: [],
  sel: 0,
  dim: false,
  saveMode: 'load',
  onPick: null,
  onCancel: null,
  t: 0,
  flashItem: -1,
  flashT: 0,

  open(o) {
    this.visible = true;
    this.view = o.view || 'list';
    this.title = o.title || '';
    this.sub = o.sub || '';
    this.items = o.items || [];
    this.sel = 0;
    this.dim = !!o.dim;
    this.saveMode = o.saveMode || 'load';
    this.onPick = o.onPick || null;
    this.onCancel = o.onCancel || null;
    this.t = 0;
  },

  close() { this.visible = false; },

  update(dt) {
    this.t += dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (!this.visible) return;

    const m = Input.mouse;
    if (this.view === 'list') {
      if (Input.wasPressed('ArrowUp') || Input.wasPressed('KeyW')) this.move(-1);
      if (Input.wasPressed('ArrowDown') || Input.wasPressed('KeyS')) this.move(1);
      if (Input.wasPressed('Enter') || Input.wasPressed('Space') || Input.wasPressed('NumpadEnter')) {
        this.pick(this.sel);
      }
      if (Input.wasPressed('Escape') && this.onCancel) this.onCancel();
      // 鼠标
      const hit = this.itemAt(m.sx, m.sy);
      if (hit >= 0) {
        this.sel = hit;
        if (m.leftPressed) this.pick(hit);
      }
    } else if (this.view === 'save') {
      const hit = this.slotAt(m.sx, m.sy);
      if (hit >= 0) {
        this.sel = hit;
        if (m.leftPressed) this.slotPick(hit);
      }
      if (Input.wasPressed('Enter') || Input.wasPressed('Space')) this.slotPick(this.sel);
      if (Input.wasPressed('Escape') && this.onCancel) this.onCancel();
    }
    if (m.rightPressed && this.onCancel) this.onCancel();
  },

  move(d) {
    this.sel = (this.sel + d + this.items.length) % this.items.length;
  },

  pick(i) {
    const it = this.items[i];
    if (!it) return;
    this.flashItem = i;
    this.flashT = 0.16;
    if (it.action) it.action();
  },

  // ---------- 布局 ----------
  itemY(i) { return 168 + i * 20; },
  itemAt(x, y) {
    const cx = this.dim ? GAME_W / 2 : 330;
    for (let i = 0; i < this.items.length; i++) {
      const cy = this.itemY(i);
      if (x > cx - 70 && x < cx + 70 && Math.abs(y - cy) < 10) return i;
    }
    return -1;
  },
  slotY(i) { return 96 + i * 44; },
  slotAt(x, y) {
    for (let i = 0; i < 3; i++) {
      const cy = this.slotY(i);
      if (x > 64 && x < 416 && Math.abs(y - cy) < 20) return i;
    }
    return -1;
  },

  // ---------- 绘制 ----------
  draw(g) {
    if (!this.visible) return;
    if (!this.dim) this.drawScene(g);
    else this.drawDim(g);

    if (this.view === 'list') this.drawList(g);
    else this.drawSave(g);
  },

  drawDim(g) {
    g.fillStyle = 'rgba(4,6,12,0.72)';
    g.fillRect(0, 0, GAME_W, GAME_H);
  },

  drawScene(g) {
    const t = this.t;
    // 天空
    const sky = g.createLinearGradient(0, 0, 0, GAME_H);
    sky.addColorStop(0, '#0a1020');
    sky.addColorStop(0.55, '#132036');
    sky.addColorStop(1, '#1b2b44');
    g.fillStyle = sky;
    g.fillRect(0, 0, GAME_W, GAME_H);

    // 星
    for (let i = 0; i < 70; i++) {
      const x = U.hash(i, 11) * GAME_W;
      const y = U.hash(i, 12) * 150;
      const a = 0.25 + 0.55 * Math.abs(Math.sin(t * 0.9 + i));
      g.globalAlpha = a;
      g.fillStyle = '#cfe0ff';
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    g.globalAlpha = 1;

    // 月亮
    const mx = 372, my = 52;
    g.globalCompositeOperation = 'lighter';
    D.glow(g, mx, my, 90, PAL.moonGlow, 0.12);
    D.glow(g, mx, my, 40, PAL.moon, 0.12);
    g.globalCompositeOperation = 'source-over';
    D.disc(g, mx, my, 19, PAL.moon);
    D.disc(g, mx - 4, my - 4, 14, '#f7fbff');
    g.globalAlpha = 0.45;
    D.disc(g, mx + 6, my + 5, 4, PAL.moonShade);
    D.disc(g, mx - 7, my + 7, 2, PAL.moonShade);
    g.globalAlpha = 1;

    // 远山
    g.fillStyle = '#1b2740';
    g.beginPath();
    g.moveTo(0, 210);
    let y = 150;
    for (let x = 0; x <= GAME_W; x += 8) {
      y += U.rand(-6, 6);
      y = U.clamp(y, 120, 180);
      g.lineTo(x, y);
    }
    g.lineTo(GAME_W, 210);
    g.closePath();
    g.fill();

    // 近处树剪影
    for (let i = 0; i < 16; i++) {
      const x = i * 34 + U.hash(i, 3) * 20 - 10;
      const hh = 34 + U.hash(i, 4) * 30;
      g.fillStyle = i % 2 ? '#101c28' : '#132231';
      g.beginPath();
      g.moveTo(x, 214);
      for (let k = 0; k < 4; k++) {
        const w = hh * 0.22 * (1 - k * 0.24);
        const yy = 214 - hh * (0.22 + k * 0.2);
        g.lineTo(x - w, yy + 5);
        g.lineTo(x - w * 0.4, yy);
        g.lineTo(x, yy - hh * 0.13);
        g.lineTo(x + w * 0.4, yy);
        g.lineTo(x + w, yy + 5);
      }
      g.lineTo(x + 1, 214);
      g.closePath();
      g.fill();
    }

    // 地面
    g.fillStyle = '#0c1520';
    g.fillRect(0, 214, GAME_W, GAME_H - 214);
    g.fillStyle = '#132231';
    g.fillRect(0, 214, GAME_W, 2);
    // 草
    for (let x = 0; x < GAME_W; x += 3) {
      if (U.hash(x, 9) > 0.55) D.rect(g, x, 212 - (U.hash(x, 8) > 0.8 ? 2 : 1), 1, 2, '#254a30');
    }

    // 骑士（放大 3 倍站在右侧）
    const pose = KNIGHT.poses.idle;
    g.save();
    g.imageSmoothingEnabled = false;
    g.globalAlpha = 0.35;
    D.glow(g, 112, 196, 60, '#8fb4e8', 0.25);
    g.restore();
    g.save();
    g.translate(112, 216);
    g.scale(-3, 3);
    // 披风（与游戏内同一套画法，简化为静态）
    const sway = Math.sin(t * 1.6) * 0.5;
    for (let i = 0; i < 14; i++) {
      const k = i / 13;
      const yy = -19 + k * 21;
      const w = 5 + k * 6;
      const cx = -2.6 - (2.2 + k * 3.6) + sway * (0.25 + k);
      const x0 = cx - w / 2;
      D.rect(g, x0 - 1, yy, w + 1, 2, '#12151f');
      D.rect(g, x0, yy, w, 2, k > 0.82 ? '#b0a790' : (k > 0.22 ? '#d5cdb8' : '#f1ebdc'));
      D.rect(g, x0, yy, 1, 2, '#f1ebdc');
    }
    g.drawImage(pose, -9, -24);
    g.restore();

    // 雾
    for (let i = 0; i < 14; i++) {
      g.globalAlpha = 0.03;
      g.fillStyle = PAL.fog;
      g.fillRect(0, 206 + i, GAME_W, 2);
    }
    g.globalAlpha = 1;
  },

  drawList(g) {
    const t = this.t;
    if (!this.dim) {
      // 标题
      const tx = 120;
      D.text(g, this.title || '小小骑士', tx, 86, 30, '#0a0d14', 0.85, 'center', 'bold');
      D.text(g, this.title || '小小骑士', tx, 84, 30, '#eaf1ff', 1, 'center', 'bold');
      D.text(g, this.title || '小小骑士', tx, 84, 30, '#ffe9b0', 0.22, 'center', 'bold');
      if (this.sub) D.text(g, this.sub, tx, 112, 10, '#8fa6c8', 0.9, 'center');
      // 装饰线
      D.rect(g, tx - 62, 96, 124, 1, 'rgba(200,220,255,0.25)');
    } else {
      D.text(g, this.title, GAME_W / 2, 74, 20, '#eaf1ff', 1, 'center', 'bold');
      if (this.sub) D.text(g, this.sub, GAME_W / 2, 96, 10, '#8fa6c8', 0.9, 'center');
    }

    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const cy = this.itemY(i);
      const cx = this.dim ? GAME_W / 2 : 330;
      const on = i === this.sel;
      const dimmed = it.disabled;
      let col = dimmed ? '#54607a' : (on ? '#ffffff' : '#a9b8d0');
      if (on && !dimmed) col = '#fff4cf';
      const size = on ? 13 : 11;
      D.text(g, it.label, cx, cy + 1, size, '#080b12', 0.9, 'center', 'bold');
      D.text(g, it.label, cx, cy, size, col, dimmed ? 0.5 : 1, 'center', 'bold');
      if (it.note) {
        D.text(g, it.note, cx + 58, cy, 8, '#6f8199', 0.9, 'left');
      }
      if (on) {
        // 剑形光标
        const sx = cx - 46 - Math.sin(t * 3) * 1;
        D.rect(g, sx, cy - 1, 9, 2, '#dfe8f7');
        D.rect(g, sx + 9, cy - 2, 2, 4, '#d9a441');
        D.rect(g, sx - 2, cy, 3, 2, '#6b4a33');
        D.rect(g, cx + 42, cy - 1, 9, 2, '#dfe8f7');
        D.rect(g, cx + 51, cy - 2, 2, 4, '#d9a441');
        D.rect(g, cx + 52, cy, 3, 2, '#6b4a33');
      }
    }

    if (!this.dim) {
      D.text(g, '↑↓ / W S  选择      Enter  确认      鼠标可直接点击',
        GAME_W / 2, 250, 8, '#6f8199', 0.85, 'center');
      D.text(g, 'v0.2 · 程序原型', 6, 262, 7, '#3f4b60', 0.9, 'left');
    }
  },

  drawSave(g) {
    D.text(g, this.title, 240, 58, 18, '#eaf1ff', 1, 'center', 'bold');
    D.text(g, this.sub, 240, 78, 9, '#8fa6c8', 0.95, 'center');
    for (let i = 0; i < 3; i++) {
      const cy = this.slotY(i);
      const on = i === this.sel;
      const s = Saves.slots[i];
      D.rect(g, 64, cy - 18, 352, 36, on ? 'rgba(60,86,132,0.55)' : 'rgba(20,28,42,0.8)');
      D.rect(g, 64, cy - 18, 352, 1, on ? '#9fc0f0' : '#2c3a52');
      D.rect(g, 64, cy + 17, 352, 1, on ? '#9fc0f0' : '#2c3a52');
      D.rect(g, 64, cy - 18, 1, 36, on ? '#9fc0f0' : '#2c3a52');
      D.rect(g, 415, cy - 18, 1, 36, on ? '#9fc0f0' : '#2c3a52');
      D.text(g, '第 ' + (i + 1) + ' 位', 80, cy - 7, 9, on ? '#cfe0ff' : '#7e8ea8', 1, 'left');
      if (s) {
        const lv = s.level === 'training' ? '训练场' : '第一关 · 夜森林';
        D.text(g, lv, 80, cy + 7, 10, '#e8eefb', 1, 'left', 'bold');
        D.text(g, '魔法石 ' + (s.stones || 0) + ' 颗   ' + (s.date || ''), 200, cy + 7, 8, '#8fa6c8', 0.95, 'left');
      } else {
        D.text(g, '空存档', 80, cy + 7, 10, '#5d6b84', 1, 'left');
      }
      if (on) {
        D.text(g, this.saveMode === 'save' ? '▸ 写入此位' : '▸ 读取', 404, cy + 7, 8, '#ffe9b0', 1, 'right');
      }
    }
    D.text(g, 'Esc / 右键  返回', 240, 250, 8, '#6f8199', 0.85, 'center');
  },

  slotPick(i) {
    if (this.onPick) this.onPick(i);
  }
};
