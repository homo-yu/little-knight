'use strict';

// ============================================================
//  骑士像素图（17x24 网格 + 6 套姿态烘焙 + 自动描边）
//  改造型只改这里的 ROWS / LEGS / COL，实体逻辑在 player.js
// ============================================================

const KNIGHT = {
  W: 19,
  H: 26,
  ROWS: [
    '.....HHHHH.......',
    '...HHHHHHHHH.....',
    '..HHhhhhhhhhH....',
    '.HHhhhhhhhhhhhH..',
    '.HHhhhsssshhhHH..',
    '.HHhhssessshhhH..',
    '..HhSssssSssh....',
    '...SSccccSS......',
    '..PPPMMMMMPPP....',
    '.PPpmmgMgmmppPP..',
    '.PpmMmmgmmmmpP...',
    '.KpmMmMgMmmmpK...',
    '.KllllgggllllK...',
    '..KmmmmmmmmmK....',
    '..KKmMKmmmKmKK...',
    '...KmmmmmmmK.....'
  ],
  LEGS: {
    idle: [
      '...KmmK..KmmK....',
      '...KmmK..KmmK....',
      '...KmmK..KmmK....',
      '...KMmK..KMmK....',
      '..KbbbK..KbbbK...',
      '..KbbbK..KbbbK...',
      '...KKK....KKK....',
      '.................'
    ],
    runA: [
      '..KmmK....KmmK...',
      '..KmmK.....KmmK..',
      '.KmmK......KmmK..',
      '.KMmK.......KMmK.',
      'KbbbK.......KbbbK',
      'KbbbK........Kbbb',
      '.KKK..........KK.',
      '.................'
    ],
    runB: [
      '....KmmK..KmmK...',
      '....KmmK..KmmK...',
      '....KmmK.KmmK....',
      '...KMmK..KMmK....',
      '..KbbbK..KbbbK...',
      '..KbbbK..KbbbK...',
      '...KKK....KKK....',
      '.................'
    ],
    air: [
      '...KmmK..KmmK....',
      '...KmmK..KmmK....',
      '..KMmK....KMmK...',
      '..KbbbK...KbbbK..',
      '...KKK.....KKK...',
      '.................',
      '.................',
      '.................'
    ]
  },
  COL: {
    H: '#e8cc86', h: '#c9a45e', d: '#8d6a33',
    s: '#f2d3b0', S: '#d3aa84', e: '#2a3040', n: '#c09070',
    M: '#d2dbe8', m: '#9aa6bb', k: '#6d798f', K: '#4a5468', X: '#2f3644',
    g: '#d8b26a', G: '#a8843c',
    w: '#f1ebdc', W: '#d5cdb8', v: '#b0a790',
    l: '#6b4a33', L: '#8a6349', b: '#292631', r: '#a8322a',
    o: '#12151f', c: '#d2dbe8'
  },
  poses: {},

  build(pose) {
    const W = KNIGHT.W, H = KNIGHT.H;
    const cv = makeCanvas(W, H);
    const g = cv.g;
    g.imageSmoothingEnabled = false;

    const legs = KNIGHT.LEGS[pose === 'runA' ? 'runA' : (pose === 'runB' ? 'runB' : (pose === 'idle' ? 'idle' : 'air'))];
    const rows = KNIGHT.ROWS.concat(legs);

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < 17; c++) {
        const ch = row[c];
        if (ch === '.' || ch === undefined) continue;
        D.rect(g, c + 1, r + 1, 1, 1, KNIGHT.COL[ch]);
      }
    }

    // 自动描边
    const img = g.getImageData(0, 0, W, H);
    const d = img.data;
    const oc = [18, 21, 31];
    const ops = [];
    const at = (x, y) => (y * W + x) * 4;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = at(x, y);
        if (d[i + 3] > 40) continue;
        let near = false;
        if (x > 0 && d[at(x - 1, y) + 3] > 40) near = true;
        else if (x < W - 1 && d[at(x + 1, y) + 3] > 40) near = true;
        else if (y > 0 && d[at(x, y - 1) + 3] > 40) near = true;
        else if (y < H - 1 && d[at(x, y + 1) + 3] > 40) near = true;
        if (near) ops.push(i);
      }
    }
    for (const i of ops) {
      d[i] = oc[0]; d[i + 1] = oc[1]; d[i + 2] = oc[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv.c;
  },

  init() {
    for (const p of ['idle', 'runA', 'runB', 'jump', 'fall', 'dash']) {
      KNIGHT.poses[p] = KNIGHT.build(p);
    }
  }
};
