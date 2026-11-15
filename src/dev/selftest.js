'use strict';

// ============================================================
//  自检脚本（?test）：脚本化操作验证核心机制
//  结果写到 #testout 与 document.title，可用 --dump-dom 抓取
// ============================================================

Object.assign(Game, {

  runTests() {
    const P = this.player;
    const out = [];
    const ks = (c) => { Input.down[c] = true; Input.pressed[c] = true; };
    const ku = (c) => { Input.down[c] = false; };
    const clear = () => { for (const k in Input.down) Input.down[k] = false; Input.mouse.left = false; };
    const aim = (wx, wy) => { Input.mouse.sx = wx - this.cam.x; Input.mouse.sy = wy - this.cam.y; };
    const step = (n) => { for (let i = 0; i < n; i++) this.update(FIXED_DT); };
    const place = (x, y) => {
      P.respawn(x, y); this.cam.x = x - GAME_W / 2; this.cam.y = y - GAME_H * 0.68;
      P.spear.x = x; P.spear.y = y - 10;
    };

    // --- A. 悬崖：投矛 → 收矛(多一次跳跃) → 三段跳越过 ---
    clear();
    place(600, 224);
    P.weapon = 'spear';
    aim(760, 214);
    Input.mouse.left = true;
    step(24);
    Input.mouse.left = false;
    step(1);
    step(70);
    const spearStuck = P.spear.state;
    ks('KeyS');
    step(50);
    const budA = P.airBudget;
    Input.down.KeyD = true;
    let crossedA = false, maxX = 0, deaths = 0; const samp = {};
    const origKill = this.killPlayer.bind(this);
    this.killPlayer = () => { deaths++; origKill(); };
    for (let i = 0; i < 320; i++) {
      if (P.grounded) { if (P.x > 650) ks('Space'); }
      else if (P.airJumpsUsed < P.airBudget && P.vy > -70) ks('Space');
      this.update(FIXED_DT);
      maxX = Math.max(maxX, P.x);
      for (const k of [780, 800, 810, 820, 830]) { if (P.x >= k && samp[k] == null) samp[k] = Math.round(P.y); }
      if (deaths > 0) break;
      if (P.grounded && P.x > 820) { crossedA = true; break; }
    }
    this.killPlayer = origKill;
    out.push('A_cliff st0=' + spearStuck + ' bud=' + budA + ' maxX=' + maxX.toFixed(0) + ' y@' + JSON.stringify(samp) +
      ' x=' + P.x.toFixed(0) + ' cross=' + crossedA + ' deaths=' + deaths);

    // --- A2. 只用二段跳（应该过不去） ---
    clear();
    place(600, 224);
    P.airBudget = 1;
    Input.down.KeyD = true;
    let crossA2 = false; const samp2 = {}; let deaths2 = 0;
    const ok2 = this.killPlayer.bind(this);
    this.killPlayer = () => { deaths2++; ok2(); };
    for (let i = 0; i < 200; i++) {
      if (P.grounded) { if (P.x > 650) ks('Space'); }
      else if (P.airJumpsUsed < 1 && P.vy > -70) ks('Space');
      this.update(FIXED_DT);
      for (const k2 of [700, 760, 820, 880]) { if (P.x >= k2 && samp2[k2] == null) samp2[k2] = Math.round(P.y) + '/' + Math.round(P.vx); }
      if (deaths2 > 0) break;
      if (P.grounded && P.x > 820) { crossA2 = true; break; }
    }
    this.killPlayer = ok2;
    out.push('A2_noSpear x=' + P.x.toFixed(0) + ' cross=' + crossA2 + ' d=' + deaths2 + ' s=' + JSON.stringify(samp2));

    // --- B. 投矛插墙 ---
    clear();
    place(890, 262);
    step(6);
    P.weapon = 'spear';
    const weapon = P.weapon;
    aim(900, 150);
    Input.mouse.left = true;
    step(46);
    Input.mouse.left = false;
    step(1);
    step(60);
    out.push('B_spear w=' + weapon + ' st=' + P.spear.state +
      ' plat=' + (P.spear.plat ? (P.spear.plat.y.toFixed(0) + '/' + P.spear.plat.x.toFixed(0)) : 'none'));

    // --- C. 站在矛上：二段跳 + 空中收矛 + 第三跳 上岩台 ---
    let reachedTop = false;
    let recalled = false;
    if (P.spear.plat) {
      const pl = P.spear.plat;
      P.x = pl.x + pl.w / 2;
      P.y = pl.y - 0.5;
      P.vx = 0; P.vy = 0;
      P.airJumpsUsed = 0; P.airBudget = 1;
      this.cam.x = P.x - GAME_W / 2;
      this.cam.y = P.y - GAME_H * 0.68;
      step(4);
      const y0 = P.y;
      Input.down.KeyD = true;
      for (let i = 0; i < 140; i++) {
        if (P.grounded && i < 8) ks('Space');
        else if (!recalled && P.airJumpsUsed >= 1 && P.vy > -70) { ku('Space'); ks('KeyS'); recalled = true; }
        else if (P.airJumpsUsed < P.airBudget && P.vy > -70) ks('Space');
        if (P.x > 936) Input.down.KeyD = false;
        this.update(FIXED_DT);
        if (P.grounded && P.y <= 18) { reachedTop = true; break; }
      }
      out.push('C_wall y0=' + y0.toFixed(0) + ' x=' + P.x.toFixed(0) + ' y=' + P.y.toFixed(0) + ' g=' + (P.grounded ? 1 : 0) +
        ' top=' + reachedTop + ' j=' + P.airJumpsUsed + '/' + P.airBudget + ' rc=' + recalled);
    } else {
      out.push('C_wall SKIP');
    }

    // --- D. 荆棘阻挡 ---
    clear();
    place(1290, 224);
    Input.down.KeyD = true;
    step(90);
    out.push('D_block x=' + P.x.toFixed(0) + ' alive=' + World.thorns.alive);

    // --- E. 火可烧荆棘 ---
    clear();
    P.stones = ['fire', 'lightning', 'light'];
    P.elIndex = 0;
    P.cd.fire = 0;
    place(1250, 224);
    step(10);
    aim(1352, 190);
    ks('KeyW');
    step(2);
    step(150);
    out.push('E_burn alive=' + World.thorns.alive + ' burn=' + World.thorns.burn.toFixed(2));
    Input.down.KeyD = true;
    step(90);
    out.push('E_pass x=' + P.x.toFixed(0));

    // --- F. 收矛刷新跳跃 ---
    clear();
    place(700, 100);
    P.spear.state = 'stuck';
    P.spear.x = 760; P.spear.y = 160;
    P.airBudget = 1;
    P.airJumpsUsed = 1;
    step(2);
    ks('KeyS');
    step(50);
    out.push('F_recall st=' + P.spear.state + ' bud=' + P.airBudget + ' used=' + P.airJumpsUsed);

    // --- G. 风位移刷新空中跳跃 ---
    clear();
    place(700, 150);
    P.stones = ['fire', 'wind'];
    P.elIndex = 1;
    P.cd.wind = 0;
    P.airBudget = 1;
    P.airJumpsUsed = 1;
    aim(840, 150);
    ks('KeyW');
    step(3);
    out.push('G_wind bud=' + P.airBudget + ' used=' + P.airJumpsUsed + ' vx=' + P.vx.toFixed(0));

    // --- H. 长矛滞留元素参与反应 ---
    clear();
    place(700, 224);
    P.spear.state = 'stuck';
    P.spear.x = 760;
    P.spear.y = 200;
    P.spear.el = 'fire';
    World.impacts.length = 0;
    FX.reset();
    World.react('lightning', 772, 202);
    out.push('H_stuckReact shake=' + FX.shakeAmt.toFixed(1) + ' fx=' + FX.rings.length);

    // --- I. 光刃后摇定身（直到光粒散完） ---
    clear();
    place(300, 224);
    P.lb.len = 60;
    P.lb.dir = 1;
    P.lb.ang = 0;
    P.lb.wm = 1;
    P.lb.charge = 1;
    P.lb.phase = 'swing';
    P.lb.t = 0.2;
    P.lbImpact();
    const x0 = P.x;
    Input.down.KeyD = true;
    step(60);
    const moved1 = Math.abs(P.x - x0);
    step(160);
    const moved2 = Math.abs(P.x - x0);
    out.push('I_lock 1s=' + moved1.toFixed(1) + ' total=' + moved2.toFixed(1) + ' x=' + P.x.toFixed(0) + ' lock=' + P.moveLock.toFixed(2));

    const txt = out.join(' || ');
    const d = document.createElement('div');
    d.id = 'testout';
    d.textContent = txt;
    d.style.cssText = 'position:fixed;left:0;bottom:0;color:#0f0;font:10px monospace;background:#000;z-index:9';
    document.body.appendChild(d);
    document.title = 'TEST ' + txt;

    clear();
    P.respawn(70, 224);
    this.cam.x = 70 - GAME_W / 2;
    this.cam.y = 224 - GAME_H * 0.68;
  },

});
