# -*- coding: utf-8 -*-
"""像素小人预览器 v3：run-length 行定义 -> 自动居中 -> 放大 PNG（带描边）。"""
from PIL import Image

W = 15
C = {
    '.': None,
    'h': '#c9a45e', 'H': '#e8cf92', 'd': '#8f6b33', 'D': '#6b4f26',
    's': '#ecd0b0', 'S': '#c69b78', 'e': '#2b3240', 'n': '#a8805f',
    'm': '#79839a', 'M': '#adb7cb', 'k': '#4f586a', 'K': '#343b49',
    'g': '#d8b070', 'G': '#9d7b3f',
    'l': '#6b4a33', 'L': '#8d6750',
    'w': '#eae3d1', 'W': '#c8bfa8', 'v': '#a09884',
    'P': '#c6cfe0', 'p': '#8d96a9',
    'b': '#2c2833', 'r': '#7d2a24', 'c': '#cdd5e4',
    'o': '#12151f',
}


def row(*runs):
    """runs: (char, count) ... 自动左右居中补齐到 W"""
    s = ''
    for ch, n in runs:
        s += ch * n
    pad = W - len(s)
    left = pad // 2 + (pad % 2)
    right = pad - left
    return '.' * left + s + '.' * right


HEAD = [
    row(('h', 3), ('H', 3)),
    row(('h', 2), ('H', 5), ('h', 1)),
    row(('h', 2), ('s', 5), ('h', 1)),
    row(('h', 1), ('s', 1), ('e', 1), ('s', 1), ('e', 1), ('s', 1), ('h', 1)),
    row(('h', 1), ('s', 2), ('n', 1), ('s', 1), ('S', 1), ('h', 1)),
    row(('S', 1), ('s', 3), ('S', 1)),
    row(('c', 3)),
]

BODY = [
    row(('P', 2), ('M', 4), ('p', 2)),
    row(('P', 1), ('p', 1), ('m', 2), ('g', 1), ('m', 1), ('k', 2), ('K', 1)),
    row(('p', 1), ('k', 1), ('M', 1), ('m', 1), ('g', 1), ('m', 1), ('k', 2), ('K', 1)),
    row(('p', 1), ('k', 1), ('m', 1), ('r', 1), ('m', 2), ('k', 1), ('K', 2)),
    row(('l', 1), ('l', 1), ('l', 1), ('g', 1), ('l', 2), ('k', 1), ('K', 2)),
    row(('K', 1), ('k', 1), ('m', 3), ('k', 1), ('K', 2)),
    row(('K', 1), ('k', 1), ('m', 1), ('M', 1), ('k', 3), ('K', 1)),
    row(('K', 2), ('k', 1), ('m', 2), ('k', 1), ('K', 2)),
]

LEGS = [
    row(('k', 1), ('m', 2), ('k', 1), ('K', 2), ('k', 1), ('m', 2), ('k', 1)),
    row(('k', 1), ('M', 2), ('k', 1), ('K', 2), ('k', 1), ('M', 2), ('k', 1)),
    row(('k', 1), ('m', 2), ('k', 1), ('K', 2), ('k', 1), ('m', 2), ('k', 1)),
    row(('k', 1), ('m', 2), ('k', 1), ('K', 2), ('k', 1), ('m', 2), ('k', 1)),
    row(('b', 2), ('b', 1), ('K', 2), ('b', 1), ('b', 2)),
    row(('b', 2), ('K', 1), ('K', 2), ('K', 1), ('b', 2)),
]


def make_cape(n):
    out = []
    top, bot = 6, n - 2
    for j in range(top, n + 1):
        k = (j - top) / float(bot - top)
        wid = 5 + k * 4
        cx = 4.0 - k * 1.8
        for x in range(W):
            if abs(x - cx) < wid / 2:
                if k < 0.15:
                    ch = 'w'
                elif x < cx - 1:
                    ch = 'v' if k > 0.65 else 'W'
                else:
                    ch = 'W' if k < 0.75 else 'v'
                out.append((x, j, ch))
    return out


def build(all_rows, cape=None):
    H = len(all_rows)
    grid = [[(13, 18, 31) for _ in range(W)] for _ in range(H + 2)]
    if cape:
        for (x, y, ch) in cape:
            if 0 <= y < H and 0 <= x < W and C.get(ch):
                grid[y + 1][x + 1] = hex2rgb(C[ch])
    cells = set()
    for j, r in enumerate(all_rows):
        assert len(r) == W, (j, len(r), r)
        for i, ch in enumerate(r):
            if C.get(ch):
                grid[j + 1][i + 1] = hex2rgb(C[ch])
                cells.add((i + 1, j + 1))
    oc = hex2rgb(C['o'])
    add = []
    for (x, y) in cells:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in cells and 0 <= n[1] < H + 2 and 0 <= n[0] < W:
                add.append(n)
    for (x, y) in add:
        grid[y][x] = oc
    return grid


def hex2rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


if __name__ == '__main__':
    rows = HEAD + BODY + LEGS
    grid = build(rows, make_cape(len(rows)))
    H, Wd = len(grid), len(grid[0])
    img = Image.new('RGB', (Wd, H))
    px = img.load()
    for y in range(H):
        for x in range(Wd):
            px[x, y] = grid[y][x]
    big = img.resize((Wd * 10, H * 10), Image.NEAREST)
    # 游戏内实际观感（3x，夜晚背景）
    small = img.resize((Wd * 3, H * 3), Image.NEAREST)
    out = Image.new('RGB', (big.width + small.width + 26, max(big.height, small.height)), (16, 22, 34))
    out.paste(big, (0, 0))
    out.paste(small, (big.width + 14, big.height - small.height))
    out.save(r'D:\小小骑士\shots\sprite_v3.png')
    print('rows', len(rows))
