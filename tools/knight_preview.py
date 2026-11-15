# -*- coding: utf-8 -*-
"""骑士像素图预览 v2：17x24（金发/银板甲/白披风/长剑），参考用户给的图。"""
from PIL import Image

W = 17
C = {
    '.': None,
    'H': '#e8cc86', 'h': '#c9a45e', 'd': '#8d6a33',
    's': '#f2d3b0', 'S': '#d3aa84', 'e': '#2a3040', 'n': '#c09070',
    'M': '#d2dbE8', 'm': '#9aa6bb', 'k': '#6d798f', 'K': '#4a5468', 'X': '#2f3644',
    'g': '#d8b26a', 'G': '#a8843c',
    'w': '#f1ebdc', 'W': '#d5cdb8', 'v': '#b0a790',
    'l': '#6b4a33', 'L': '#8a6349', 'b': '#292631', 'r': '#a8322a',
    'o': '#12151f', 'c': '#d2dbE8',
}

ROWS = [
    # 头 0..7
    '.....HHHHH.......',
    '...HHHHHHHHH.....',
    '..HHhhhhhhhhH....',
    '.HHhhhhhhhhhhhH..',
    '.HHhhhsssshhhHH..',
    '.HHhhssessshhhH..',
    '..HhSssssSssh....',
    '...SSccccSS......',
    # 上身 8..15
    '..PPPMMMMMPPP....',
    '.PPpmmgMgmmppPP..',
    '.PpmMmmgmmmmpP...',
    '.KpmMmMgMmmmpK...',
    '.KllllgggllllK...',
    '..KmmmmmmmmmK....',
    '..KKmMKmmmKmKK...',
    '...KmmmmmmmK.....',
    # 腿 16..23
    '...KmmK..KmmK....',
    '...KmmK..KmmK....',
    '...KmmK..KmmK....',
    '...KMmK..KMmK....',
    '..KbbbK..KbbbK...',
    '..KbbbK..KbbbK...',
    '...KKK....KKK....',
    '.................',
]


def build(rows, cape=None):
    H = len(rows)
    grid = [[(13, 18, 31) for _ in range(W + 2)] for _ in range(H + 2)]
    cells = set()
    if cape:
        for (x, y, ch) in cape:
            if 0 <= y < H and 0 <= x < W and C.get(ch):
                grid[y + 1][x + 1] = hex2rgb(C[ch])
    for j, r in enumerate(rows):
        assert len(r) == W, ('row', j, len(r), r)
        for i, ch in enumerate(r):
            if C.get(ch):
                grid[j + 1][i + 1] = hex2rgb(C[ch])
                cells.add((i + 1, j + 1))
    oc = hex2rgb(C['o'])
    add = []
    for (x, y) in cells:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in cells and 0 <= n[1] < H + 2 and 0 <= n[0] < W + 2:
                add.append(n)
    for (x, y) in add:
        grid[y][x] = oc
    return grid


def make_cape(H):
    out = []
    for j in range(9, H - 1):
        k = (j - 9) / float(H - 11)
        wid = 6 + k * 7
        cx = 5.0 - k * 2.4
        for x in range(W):
            if abs(x - cx) < wid / 2:
                if k < 0.12:
                    ch = 'w'
                elif x < cx - 1:
                    ch = 'v' if k > 0.62 else 'W'
                else:
                    ch = 'W' if k < 0.8 else 'v'
                out.append((x, j, ch))
    return out


def hex2rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


if __name__ == '__main__':
    grid = build(ROWS, make_cape(len(ROWS)))
    H, Wd = len(grid), len(grid[0])
    img = Image.new('RGB', (Wd, H))
    px = img.load()
    for y in range(H):
        for x in range(Wd):
            px[x, y] = grid[y][x]
    big = img.resize((Wd * 10, H * 10), Image.NEAREST)
    small = img.resize((Wd * 3, H * 3), Image.NEAREST)
    out = Image.new('RGB', (big.width + small.width + 24, max(big.height, small.height)), (16, 22, 34))
    out.paste(big, (0, 0))
    out.paste(small, (big.width + 12, big.height - small.height))
    out.save(r'D:\小小骑士\shots\knight_v2.png')
    print('rows', len(ROWS))
