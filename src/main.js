'use strict';

// ============================================================
//  主循环 / 相机 / 光照 / 教学文字（无 UI）
// ============================================================

const Game = {
  canvas: null, g: null,
  lightC: null, lightG: null,
  vignette: null,
  player: null,
  cam: { x: 0, y: 0 },
  t: 0,
  err: null,
  hints: [],
  dead: false,
  demo: null,
  demoT: 0,
  demoMode: null,
  fadeIn: 1,
  frames: 0,
  dbg: false,
  noFade: false,

  init() {
    this.canvas = document.getElementById('game');
    this.g = this.canvas.getContext('2d');
    this.g.imageSmoothingEnabled = false;

    const l = makeCanvas(GAME_W, GAME_H);
    this.lightC = l.c; this.lightG = l.g;
    this.lightG.imageSmoothingEnabled = false;

    this.makeVignette();

    Input.init(this.canvas);
    KNIGHT.init();
    Saves.load();

    const q = new URLSearchParams(location.search);
    this.dbg = q.has('dbg');
    this.noFade = q.has('nofade') || this.dbg;
    if (this.noFade) this.fadeIn = 0;
    this.hide = (q.get('h') || '').split(',');
    this.demoMode = q.get('demo');

    const direct = q.has('x') || q.has('test') || this.demoMode || q.has('play');
    if (direct) {
      this.startGame(q.has('level') ? q.get('level') : 'level1', null, true);
      if (q.has('x')) {
        this.player.x = parseFloat(q.get('x'));
        this.player.y = q.has('y') ? parseFloat(q.get('y')) : 100;
        for (let i = 0; i < 300; i++) {
          if (!World.pointSolid(this.player.x, this.player.y) &&
              World.pointSolid(this.player.x, this.player.y + 2)) break;
          this.player.y += 2;
        }
        this.cam.x = this.player.x - GAME_W / 2;
        this.cam.y = this.player.y - GAME_H * 0.68;
      }
      if (q.has('el') || this.demoMode) {
        if (this.player.stones.length < 6) this.player.stones = ['fire', 'lightning', 'light', 'ice', 'water', 'wind'];
        if (q.has('el')) {
          const i = this.player.stones.indexOf(q.get('el'));
          this.player.elIndex = i < 0 ? 0 : i;
        }
      }
      if (q.has('all')) {
        this.player.stones = ['fire', 'lightning', 'light', 'ice', 'water', 'wind'];
        for (const p of World.pickups) p.taken = true;
      }
    } else {
      this.showMainMenu();
    }

    this.cam.x = this.player ? this.player.x - GAME_W / 2 : 0;
    this.cam.y = this.player ? this.player.y - GAME_H * 0.68 : 0;

    // 离屏预演（截图 / 调试用）
    const sim = parseInt(q.get('sim') || '0', 10);
    for (let i = 0; i < sim; i++) {
      this.update(FIXED_DT);
      this.frames++;
    }
    this.freeze = q.has('freeze') || this.dbg;

    this.resize();
    addEventListener('resize', () => this.resize());

    if (q.has('test')) this.runTests();

    window.onerror = (msg, src, line) => {
      this.err = msg + ' @' + (src || '').split('/').pop() + ':' + line;
      return false;
    };
    addEventListener('unhandledrejection', (e) => {
      this.err = 'Promise: ' + (e.reason && e.reason.message ? e.reason.message : e.reason);
    });

    let last = performance.now();
    let acc = 0;
    const loop = (now) => {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;
      acc += dt;
      let steps = 0;
      if (!this.freeze) {
        while (acc >= FIXED_DT && steps < 6) {
          this.update(FIXED_DT);
          acc -= FIXED_DT;
          steps++;
        }
        if (steps === 6) acc = 0;
      } else {
        acc = 0;
      }
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  // ---------- 流程 ----------
  showMainMenu() {
    this.mode = 'menu';
    Menu.open({
      title: '小小骑士',
      sub: '第 一 章 · 夜 森 林',
      items: [
        { label: '开始', action: () => this.startFromSave() },
        { label: '存档', action: () => this.openSave('load') },
        { label: '训练', action: () => this.startGame('training') },
        { label: '放弃', action: () => this.quitGame() }
      ]
    });
  },

  startFromSave() {
    const s = Saves.latest();
    if (s) this.startGame(s.level || 'level1', s);
    else this.startGame('level1');
  },

  startGame(levelId, save, silent) {
    this.mode = 'play';
    Menu.close();
    FX.reset();
    Magic.reset();
    this.hitstop = 0;
    World.init(levelId);
    this.player = new Player();
    if (save && save.stones) this.player.stones = save.stones.slice();
    if (this.player.stones.indexOf('fire') < 0) this.player.stones.unshift('fire');
    this.player.elIndex = 0;
    const sp = World.spawn;
    this.player.respawn(sp.x, sp.y);
    this.cam.x = this.player.x - GAME_W / 2;
    this.cam.y = this.player.y - GAME_H * 0.68;
    this.startT = this.t;
    if (!silent) this.fadeIn = 1;
  },

  openPause() {
    this.mode = 'play';
    Menu.open({
      title: '暂 停',
      sub: World.levelId === 'training' ? '训练场' : '第一关 · 夜森林',
      dim: true,
      items: [
        { label: '继续', action: () => Menu.close() },
        { label: '保存进度', action: () => this.openSave('save') },
        { label: '返回主菜单', action: () => this.showMainMenu() },
        { label: '放弃', action: () => this.quitGame() }
      ],
      onCancel: () => Menu.close()
    });
  },

  openSave(mode) {
    this.saveReturn = mode === 'save' ? 'pause' : 'menu';
    Menu.open({
      view: 'save',
      title: mode === 'save' ? '保 存 进 度' : '读 取 存 档',
      sub: mode === 'save' ? '选择一个存档位写入当前进度' : '选择一个存档位读取',
      saveMode: mode,
      onPick: (i) => {
        if (mode === 'save') {
          Saves.write(i, {
            level: World.levelId,
            x: this.player.x,
            stones: this.player.stones.slice(),
            stoneCount: this.player.stones.length,
            time: Date.now(),
            date: new Date().toLocaleDateString('zh-CN')
          });
          Menu.close();
          this.openPause();
        } else {
          const s = Saves.slots[i];
          if (s) this.startGame(s.level || 'level1', s);
        }
      },
      onCancel: () => {
        if (this.saveReturn === 'pause') this.openPause();
        else this.showMainMenu();
      }
    });
  },

  quitGame() {
    this.mode = 'quit';
    Menu.open({
      title: '放 弃',
      sub: '旅程到此为止',
      dim: false,
      items: [{ label: '回到主菜单', action: () => this.showMainMenu() }],
      onCancel: () => this.showMainMenu()
    });
  },

  hitStop(d) { this.hitstop = Math.max(this.hitstop, d); },

  setImpactFrame(x, y, ang, len) {
    this.impactSil = { x, y, ang, len };
  },

  onReaction(text, x, y) {
    this.showTimedHint('◈ ' + text, 1.4);
    FX.shake(3);
    void x; void y;
  },

  resize() {
    const s = Math.max(1, Math.min(Math.floor(innerWidth / GAME_W), Math.floor(innerHeight / GAME_H)));
    Input.scale = s;
    this.canvas.style.width = (GAME_W * s) + 'px';
    this.canvas.style.height = (GAME_H * s) + 'px';
  },

  makeVignette() {
    const v = makeCanvas(GAME_W, GAME_H);
    const g = v.g;
    const grd = g.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.36, GAME_W / 2, GAME_H / 2, GAME_H * 0.95);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.6, 'rgba(2,4,10,0.14)');
    grd.addColorStop(1, 'rgba(2,4,10,0.5)');
    g.fillStyle = grd;
    g.fillRect(0, 0, GAME_W, GAME_H);
    this.vignette = v.c;
  },

  // ---------------------------------------------------------
  update(dt) {
    this.t += dt;
    const cam = this.cam;
    const p = this.player;

    // 世界坐标下的鼠标
    Input.mouse.wx = Input.mouse.sx + cam.x;
    Input.mouse.wy = Input.mouse.sy + cam.y;

    // ---- 菜单态 ----
    if (this.mode === 'menu' || this.mode === 'quit') {
      Menu.update(dt);
      FX.update(dt);
      this.fadeIn = Math.max(0, this.fadeIn - dt * 1.6);
      Input.endFrame();
      return;
    }
    if (Menu.visible) {
      Menu.update(dt);
      Input.endFrame();
      return;
    }
    // 顿帧（光刃冲击）
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      FX.updateShake(dt);      // 定帧期间屏幕照样抖
      Input.endFrame();
      return;
    }
    // 暂停
    if (Input.wasPressed('Escape') || Input.wasPressed('Tab')) {
      this.openPause();
      Input.endFrame();
      return;
    }

    if (!this.err) {
      World.update(dt);
      p.update(dt, this.t);
      Magic.update(dt);
      FX.update(dt);
      this.updateDemo(dt);
    }

    // 相机
    const tx = p.x + p.vx * 0.14 - GAME_W / 2;
    const ty = p.y - GAME_H * 0.68 + U.clamp(p.vy * 0.04, -18, 22);
    cam.x = U.damp(cam.x, tx, 7, dt);
    cam.y = U.damp(cam.y, ty, 5.5, dt);
    cam.x = U.clamp(cam.x, World.boundX0, World.boundX1 - GAME_W);
    cam.y = U.clamp(cam.y, World.boundY0, World.boundY1 - GAME_H);
    if (this.fadeIn > 0) this.fadeIn = Math.max(0, this.fadeIn - dt * 1.6);

    Input.endFrame();
  },

  // ---------------------------------------------------------
  killPlayer() {
    const cp = World.respawnPoint();
    this.player.respawn(cp.x, cp.y - 1);
    FX.flash('#050a14', 0.8, 2.4);
    FX.shake(2);
    this.cam.x = this.player.x - GAME_W / 2;
    this.cam.y = this.player.y - GAME_H * 0.68;
  },

  onPickup(p) {
    this.player.addStone(p.el);
    const c = EL[p.el];
    const hp = this.player.handPos();
    FX.burst(p.x, p.y, 34, {
      spread: Math.PI, spdMin: 30, spdMax: 160, life: 0.8,
      sizeMin: 1, sizeMax: 3, col: [c.core, c.hot, c.mid], grav: -30, drag: 2
    });
    FX.ring(p.x, p.y, 2, 40, 0.6, c.hot, 2);
    FX.flash(U.hexA(c.lightCol, 0.5), 0.3, 4);
    FX.shake(3);
    if (p.el === 'lightning') {
      this.showTimedHint('得到了「雷」魔法石 —— 滚轮 / 右键 切换属性', 6);
      this.showTimedHint('W  释放魔法     ·     按住左键蓄力 + W  =  元素剑技', 6);
    } else if (p.el === 'light') {
      this.showTimedHint('得到了「光」魔法石 . . .', 8);
    }
  },

  onCheckpoint(c) {
    FX.ring(this.player.x, this.player.y - 8, 2, 22, 0.5, '#9fb4d8', 1);
  },

  onThornsIgnite() {
    FX.flash('#ff8a2a', 0.2, 5);
    FX.shake(4);
  },

  showTimedHint(text, dur) {
    // 顶替旧的临时提示
    for (let i = this.hints.length - 1; i >= 0; i--) {
      if (this.hints[i].timed) this.hints.splice(i, 1);
    }
    this.hints.push({ text, life: dur, max: dur, timed: true, x: null });
  },

  // ---------------------------------------------------------
  render() {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.imageSmoothingEnabled = false;

    // 主菜单 / 放弃：只画菜单
    if (!this.player || this.mode === 'menu' || this.mode === 'quit') {
      Menu.draw(g);
      if (this.fadeIn > 0) {
        g.globalAlpha = this.fadeIn;
        g.fillStyle = '#04060c';
        g.fillRect(0, 0, GAME_W, GAME_H);
        g.globalAlpha = 1;
      }
      if (this.err) {
        g.fillStyle = 'rgba(0,0,0,0.8)';
        g.fillRect(0, 0, GAME_W, 30);
        D.text(g, 'ERROR ' + this.err, 6, 14, 9, '#ff6b6b', 1);
      }
      this.frames++;
      return;
    }

    const camx = Math.round(this.cam.x + FX.shakeX);
    const camy = Math.round(this.cam.y + FX.shakeY);
    const camObj = { x: camx, y: camy };

    World.drawBackground(g, camObj, this.t);

    g.save();
    g.translate(-camx, -camy);
    World.drawTerrain(g);
    if (this.hide.indexOf('dyn') < 0) World.drawDynamic(g, this.t);
    FX.drawDecals(g);
    this.player.spear.draw(g, this.t);
    if (this.hide.indexOf('ply') < 0) this.player.draw(g, this.t);
    Magic.drawProjectiles(g);
    if (this.hide.indexOf('fx') < 0) FX.draw(g);
    g.restore();

    if (this.hide.indexOf('light') < 0) this.drawLighting(g, camx, camy);
    this.drawHints(g, camx, camy);

    // 闪光
    if (FX.flashA > 0.002) {
      g.globalAlpha = Math.min(1, FX.flashA);
      g.fillStyle = FX.flashCol;
      g.fillRect(0, 0, GAME_W, GAME_H);
      g.globalAlpha = 1;
    }

    g.drawImage(this.vignette, 0, 0);

    if (this.fadeIn > 0) {
      g.globalAlpha = this.fadeIn;
      g.fillStyle = '#04060c';
      g.fillRect(0, 0, GAME_W, GAME_H);
      g.globalAlpha = 1;
    }

    // 黑闪冲击帧：黑底上压一层纯白剑影 + 冲击环
    if (this.impactSil) {
      if (FX.flashA <= 0.02) {
        this.impactSil = null;
      } else {
        const sl = this.impactSil;
        const a = Math.min(1, FX.flashA * 1.2);
        const cx = sl.x - camx, cy = sl.y - camy;
        const dx = Math.cos(sl.ang), dy = Math.sin(sl.ang);
        const nx = -dy, ny = dx;
        g.save();
        g.globalAlpha = a;
        g.fillStyle = '#ffffff';
        const L = sl.len, body = L * 0.78, w = 6;
        for (let i = 2; i <= L; i++) {
          const ww = i <= body ? w : Math.max(1, w * (L - i) / (L - body));
          const ox = cx + dx * i, oy = cy + dy * i;
          g.fillRect(Math.round(ox - nx * ww * 0.5), Math.round(oy - ny * ww * 0.5),
            Math.max(1, Math.round(ww)), Math.max(1, Math.round(ww)));
        }
        // 冲击环
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2;
        const ir = 10 + (1 - FX.flashA) * 46;
        g.beginPath();
        g.arc(cx + dx * L * 0.86, cy + dy * L * 0.86, ir, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 1;
        g.beginPath();
        g.arc(cx + dx * L * 0.86, cy + dy * L * 0.86, ir * 0.55, 0, Math.PI * 2);
        g.stroke();
        g.restore();
        g.globalAlpha = 1;
      }
    }

    // 暂停 / 存档覆盖层
    if (Menu.visible) Menu.draw(g);

    if (this.err) {
      g.fillStyle = 'rgba(0,0,0,0.8)';
      g.fillRect(0, 0, GAME_W, 30);
      D.text(g, 'ERROR ' + this.err, 6, 14, 9, '#ff6b6b', 1);
    }

    this.frames++;
    if (this.dbg) {
      const p = this.player;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(0, 0, 190, 38);
      D.text(g, 'f=' + this.frames + ' t=' + this.t.toFixed(1) + ' fade=' + this.fadeIn.toFixed(2), 4, 8, 8, '#9fe8ff', 1);
      D.text(g, 'x=' + p.x.toFixed(0) + ' y=' + p.y.toFixed(0) + ' g=' + (p.grounded ? 1 : 0) + ' st=' + p.state, 4, 19, 8, '#9fe8ff', 1);
      D.text(g, 'j=' + p.airJumpsUsed + '/' + p.airBudget + ' w=' + p.weapon + ' sp=' + p.spear.state, 4, 30, 8, '#9fe8ff', 1);
      D.text(g, 'fx p' + FX.parts.length + ' r' + FX.rings.length + ' b' + FX.bolts.length + ' m' + FX.beams.length + ' c' + FX.crescents.length + ' bl' + FX.blasts.length + ' lb=' + p.lb.phase, 4, 41, 8, '#9fe8ff', 1);
    }
  },

  drawLighting(g, camx, camy) {
    const L = this.lightG;
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, GAME_W, GAME_H);
    // 夜幕
    const nightA = this.player.x > 1100 ? 0.46 : 0.32;
    L.fillStyle = 'rgba(6,10,22,' + nightA + ')';
    L.fillRect(0, 0, GAME_W, GAME_H);

    L.globalCompositeOperation = 'destination-out';
    const punch = (x, y, r, a) => {
      if (r <= 0) return;
      const grd = L.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      grd.addColorStop(0.45, 'rgba(255,255,255,' + a * 0.55 + ')');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      L.fillStyle = grd;
      L.beginPath();
      L.arc(x, y, r, 0, Math.PI * 2);
      L.fill();
    };

    // 月光环境
    punch(360 - camx * 0.04, 46 - camy * 0.05, 260, 0.34);
    punch(GAME_W * 0.5, -40, 620, 0.22);
    punch(GAME_W * 0.5, GAME_H * 0.5, 560, 0.16);

    const p = this.player;
    const el = EL[p.currentEl()];
    const charging = p.charging ? U.clamp(p.chargeT / PH.chargeFull, 0, 1) : 0;
    punch(p.x - camx, p.y - 13 - camy, 62 + charging * 26, 0.85);
    if (charging > 0.15 || p.castT < 0.2) {
      punch(p.x - camx, p.y - 13 - camy, 40 + charging * 30, 0.5);
    }

    // 特效灯
    for (const l of FX.lights) {
      const k = 1 - l.t / l.life;
      const lx = (l.src ? l.src.x + (l.dx || 0) : l.x) - camx;
      const ly = (l.src ? l.src.y + (l.dy || 0) : l.y) - camy;
      punch(lx, ly, l.r * (0.7 + 0.3 * k), Math.min(1, l.a * k));
    }

    // 火焰余辉（荆棘燃烧）
    const th = World.thorns;
    if (th && th.alive && th.burn > 0) {
      punch(th.x + th.w / 2 - camx, th.y + th.h / 2 - camy, 90, 0.7);
    }

    L.globalCompositeOperation = 'source-over';
    g.drawImage(this.lightC, 0, 0);
  },

  drawHints(g, camx, camy) {
    const p = this.player;
    g.save();
    g.translate(-camx, -camy);

    // 世界内位置提示（靠近才显形，只显示最近的一条）
    let bestH = null, bestD = 1e9;
    for (const h of HINTS) {
      if ((h.lvl || 'level1') !== World.levelId) continue;
      const d = Math.abs(p.x - h.x);
      if (d < bestD && d < 185) { bestD = d; bestH = h; }
    }
    if (bestH) {
      const a = U.clamp(1 - bestD / 165, 0, 1) * 0.55;
      if (a > 0.02) {
        const lines = bestH.text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const yy = bestH.y + i * 13;
          D.text(g, lines[i], bestH.x, yy, 10, '#0a0d14', a * 0.9, 'center', 'bold');
          D.text(g, lines[i], bestH.x, yy - 1, 10, '#cfdcef', a, 'center', 'bold');
        }
      }
    }

    // 计时提示（拾取 / 事件）
    for (let i = this.hints.length - 1; i >= 0; i--) {
      const h = this.hints[i];
      h.life -= FIXED_DT;
      if (h.life <= 0) { this.hints.splice(i, 1); continue; }
      const k = Math.min(1, (h.max - h.life) / 0.5, h.life / 0.8);
      const a = U.clamp(k, 0, 1) * 0.95;
      const idx = this.hints.indexOf(h);
      const yy = p.y - 46 - idx * 16;
      D.text(g, h.text, p.x, yy + 1, 10, '#04060c', a, 'center', 'bold');
      D.text(g, h.text, p.x, yy, 10, '#e8eefb', a, 'center', 'bold');
    }
    g.restore();
  }
};

addEventListener('load', () => {
  try {
    Game.init();
  } catch (e) {
    const g = document.getElementById('game');
    if (g) {
      const c = g.getContext('2d');
      c.fillStyle = '#000';
      c.fillRect(0, 0, 480, 270);
      c.fillStyle = '#ff6b6b';
      c.font = '10px monospace';
      c.fillText('INIT ERROR: ' + e.message, 8, 20);
      c.fillText((e.stack || '').split('\n')[1] || '', 8, 34);
    }
  }
});
