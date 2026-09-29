// 배경을 2D 캔버스에 픽셀 단위로 그린다. 등불·지역·엔딩 상태에 따라 다시 그린다.
import { TRAY } from '../core/bench';
import { SOCKET_X } from '../core/data';
import type { SiteId } from '../core/types';
import { PAL } from './palette';

export const W = 480;
export const H = 270;
export const WINDOW = { x: 170, y: 14, w: 140, h: 56 };
export const DOOR = { x: 400, y: 26, w: 74, h: 72 };
export const SHELF = { x: 6, y: 22, w: 82, h: 132 };
export const RAIL_Y = 90;

export interface BgState {
  lamps: number;
  site: SiteId;
  ended: boolean;
  sockets: number;
}

type Ctx = CanvasRenderingContext2D;
const px = (c: Ctx, x: number, y: number, col: string, w = 1, h = 1) => {
  c.fillStyle = col.startsWith('#') ? col : PAL[col];
  c.fillRect(Math.round(x), Math.round(y), w, h);
};
function rnd(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function dither(c: Ctx, x: number, y: number, w: number, h: number, a: string, b: string, t: number) {
  // t: 0..1 비율로 b를 섞는 체커 디더
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const th = ((i + j) & 1) === 0 ? 0.25 : 0.75;
      px(c, x + i, y + j, t > th ? b : a);
    }
}

export function paintBackground(c: Ctx, st: BgState) {
  c.clearRect(0, 0, W, H);
  // 벽: 세로 판자
  px(c, 0, 0, '1', W, H);
  for (let x = 0; x < W; x += 12) {
    px(c, x, 0, '2', 11, 176);
    px(c, x + 11, 0, '0', 1, 176);
    if ((x / 12) % 3 === 0) px(c, x + 3, 30 + ((x * 7) % 90), '1', 1, 3);
  }
  // 걸레받이/아래 벽
  px(c, 0, 172, 'z', W, 4);
  px(c, 0, 176, '1', W, 64);
  for (let x = 0; x < W; x += 24) px(c, x, 176, '0', 1, 64);
  // 바닥
  px(c, 0, 240, '2', W, 30);
  for (let y = 240; y < H; y += 6) px(c, 0, y, '1', W, 1);
  const r = rnd(11);
  for (let i = 0; i < 40; i++) px(c, r() * W, 241 + r() * 28, '3', 3, 1);

  paintStringLights(c, st.lamps);
  paintWindow(c, st);
  paintDoor(c, st.site);
  paintShelf(c);
  paintTrayBack(c);
  paintRail(c, st.sockets);
}

function paintStringLights(c: Ctx, lamps: number) {
  const n = 14;
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    const x = 96 + t * 290;
    const y = 6 + Math.sin(t * Math.PI * 3) * 2 + 2;
    px(c, x, y, '0');
  }
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = Math.round(96 + t * 290);
    const y = Math.round(6 + Math.sin(t * Math.PI * 3) * 2 + 3);
    const lit = i < Math.round((lamps / 5) * n);
    px(c, x, y, 'j', 1, 1);
    px(c, x - 1, y + 1, lit ? 'b' : '2', 3, 2);
    if (lit) {
      px(c, x, y + 1, 'w');
      px(c, x - 2, y + 1, 'a');
      px(c, x + 2, y + 1, 'a');
      px(c, x - 1, y + 3, 'a', 3, 1);
    }
  }
}

function paintWindow(c: Ctx, st: BgState) {
  const { x, y, w, h } = WINDOW;
  // 틀
  px(c, x - 4, y - 4, 'z', w + 8, h + 8);
  px(c, x - 3, y - 3, '4', w + 6, h + 6);
  px(c, x - 1, y - 1, '0', w + 2, h + 2);
  // 하늘
  const dawn = st.ended;
  for (let j = 0; j < h; j++) {
    const t = j / h;
    const a = dawn ? 'o' : 'n';
    const b = dawn ? 'p' : 'o';
    dither(c, x, y + j, w, 1, a, b, dawn ? t * 0.9 : t * 0.6);
  }
  const r = rnd(5);
  for (let i = 0; i < 30; i++) px(c, x + r() * w, y + r() * (h * 0.6), r() < 0.3 ? 'w' : 'p');
  // 먼 언덕
  for (let i = 0; i < w; i++) {
    const hh = 10 + Math.sin(i * 0.07) * 4 + Math.sin(i * 0.19) * 2;
    px(c, x + i, y + h - hh, '1', 1, hh);
  }
  // 별 받침대 언덕(오른쪽 위)
  const px5 = x + 108;
  const py5 = y + 30;
  for (let i = -14; i <= 14; i++) {
    const hh = Math.max(0, 12 - Math.abs(i) * 0.8);
    px(c, px5 + i, py5 + 10 - hh + 12, '1', 1, hh + 16);
  }
  px(c, px5 - 2, py5 + 6, 'k', 5, 3);
  px(c, px5 - 1, py5 + 4, 'l', 3, 2);
  // 지붕들
  const roofs = [
    [4, 22, 18],
    [24, 16, 14],
    [42, 28, 12],
    [74, 18, 16],
    [96, 14, 20],
    [118, 20, 14],
  ];
  const lit = st.lamps;
  roofs.forEach(([rx, rw, rh], k) => {
    const bx = x + rx;
    const by = y + h - rh;
    px(c, bx, by, '0', rw, rh);
    for (let i = 0; i < rw / 2; i++) px(c, bx + i, by - i * 0.5 - 1, '0', rw - i * 2, 1);
    // 창문 불빛: 켜진 등불 수에 따라
    for (let wy = by + 3; wy < y + h - 2; wy += 5)
      for (let wx = bx + 2; wx < bx + rw - 2; wx += 5) {
        const on = ((wx * 7 + wy * 3 + k) % 5) < lit;
        px(c, wx, wy, on ? 'a' : '2', 2, 2);
      }
  });
  // 시계탑(가운데)
  const tx = x + 62;
  px(c, tx, y + 14, '0', 12, h - 14);
  px(c, tx + 2, y + 8, '0', 8, 6);
  px(c, tx + 5, y + 4, '0', 2, 4);
  px(c, tx + 3, y + 18, lit >= 4 ? 'b' : '2', 6, 6);
  if (lit >= 4) {
    px(c, tx + 5, y + 19, '0', 1, 3);
    px(c, tx + 5, y + 21, '0', 2, 1);
  }
  // 온실(왼쪽 언덕)
  const gx = x + 30;
  const gy = y + 30;
  px(c, gx, gy + 4, lit >= 3 ? 'i' : 'g', 14, 7);
  px(c, gx + 2, gy + 2, lit >= 3 ? 'i' : 'g', 10, 2);
  px(c, gx + 4, gy, lit >= 3 ? 'h' : 'g', 6, 2);
  for (let i = 0; i < 14; i += 3) px(c, gx + i, gy + 4, '0', 1, 7);
  // 등대(오른쪽)
  const lx = x + 128;
  px(c, lx, y + 22, '7', 5, h - 22);
  for (let j = y + 26; j < y + h; j += 6) px(c, lx, j, '8', 5, 2);
  px(c, lx - 1, y + 18, lit >= 2 ? 'b' : 'j', 7, 4);
  if (lit >= 2) for (let i = 1; i < 26; i++) px(c, lx - i, y + 19 + Math.round(i * 0.15), i % 3 ? 'v' : 'b', 1, 1);
  // 골목 가로등(왼쪽 아래)
  const sx = x + 12;
  px(c, sx, y + h - 22, 'j', 1, 22);
  px(c, sx - 2, y + h - 24, lit >= 1 ? 'b' : 'k', 5, 3);
  if (lit >= 1) {
    px(c, sx - 3, y + h - 21, 'a', 7, 1);
    px(c, sx - 1, y + h - 25, 'w', 3, 1);
  }
  // 별 받침대
  if (lit >= 5 || st.ended) {
    px(c, px5 - 3, py5 + 1, 'v', 7, 3);
    px(c, px5 - 1, py5 - 1, 'w', 3, 2);
  }
  // 엔딩 이후: 하늘의 별
  if (st.ended) {
    const cx = x + 44;
    const cy = y + 10;
    px(c, cx - 2, cy - 2, 'w', 5, 5);
    for (let i = 3; i < 9; i++) {
      px(c, cx - i, cy, 'v');
      px(c, cx + i, cy, 'v');
      px(c, cx, cy - i, 'v');
      px(c, cx, cy + i, 'v');
    }
  }
  // 창살
  px(c, x + w / 2 - 1, y, '4', 2, h);
  px(c, x, y + h / 2 - 1, '4', w, 2);
  px(c, x - 5, y + h + 4, '5', w + 10, 3);
  px(c, x - 5, y + h + 7, 'z', w + 10, 1);
}

function paintDoor(c: Ctx, site: SiteId) {
  const { x, y, w, h } = DOOR;
  px(c, x - 4, y - 4, 'z', w + 6, h + 6);
  px(c, x - 3, y - 3, '3', w + 4, h + 4);
  px(c, x, y, '0', w, h);
  const r = rnd(site.length * 31);
  const sky = (a: string, b: string) => {
    for (let j = 0; j < h; j++) dither(c, x, y + j, w, 1, a, b, j / h);
  };
  switch (site) {
    case 'alley': {
      sky('n', '1');
      for (let j = 0; j < h - 14; j += 5)
        for (let i = (j / 5) % 2 ? -4 : 0; i < w; i += 9) {
          px(c, x + Math.max(0, i), y + 16 + j, 'x', Math.min(8, w - Math.max(0, i)), 4);
          px(c, x + Math.max(0, i), y + 16 + j, 'y', 1, 1);
        }
      px(c, x + 8, y + h - 20, 'k', 12, 14);
      px(c, x + 7, y + h - 22, 'l', 14, 3);
      px(c, x + 40, y + h - 6, 'c', 18, 2);
      break;
    }
    case 'docks': {
      sky('n', 'o');
      px(c, x, y + 38, 'c', w, h - 38);
      for (let i = 0; i < 18; i++) px(c, x + r() * w, y + 40 + r() * 20, 'd', 3, 1);
      px(c, x + 50, y + 8, 'w', 5, 5);
      px(c, x + 14, y + 6, '0', 3, 34);
      px(c, x + 14, y + 6, '0', 30, 3);
      px(c, x + 40, y + 9, 'j', 1, 14);
      px(c, x, y + h - 12, '3', w, 12);
      break;
    }
    case 'greenhouse': {
      sky('g', 'h');
      for (let i = 0; i < w; i += 12) px(c, x + i, y, 'g', 1, h);
      for (let j = 0; j < h; j += 12) px(c, x, y + j, 'g', w, 1);
      for (let i = 0; i < 14; i++) px(c, x + r() * w, y + r() * h * 0.7, 'i', 2, 2);
      for (let i = 0; i < w; i += 4) px(c, x + i, y + h - 10 - Math.floor(r() * 8), 'h', 2, 10);
      px(c, x, y + h - 8, '3', w, 8);
      break;
    }
    case 'attic': {
      sky('1', '2');
      px(c, x, y + 6, 'z', w, 5);
      px(c, x + 20, y, 'z', 5, h);
      px(c, x + 52, y, 'z', 5, h);
      const cx = x + 38;
      const cy = y + 32;
      for (let a = 0; a < Math.PI * 2; a += 0.08) px(c, cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 'a');
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        px(c, cx + Math.cos(a) * 16 - 1, cy + Math.sin(a) * 16 - 1, 'y', 3, 3);
      }
      px(c, x, y + h - 10, '3', w, 10);
      break;
    }
    case 'crater': {
      sky('n', 't');
      for (let i = 0; i < 20; i++) px(c, x + r() * w, y + r() * h * 0.5, 'w');
      for (let i = 0; i < w; i++) {
        const hh = 18 - Math.abs(i - w / 2) * 0.3;
        px(c, x + i, y + h - hh, '1', 1, hh);
      }
      px(c, x + w / 2 - 12, y + h - 16, 'v', 24, 3);
      px(c, x + w / 2 - 8, y + h - 18, 'w', 16, 2);
      for (let i = 0; i < 4; i++) px(c, x + 10 + i * 16, y + 6 + i * 5, 'v', 3, 1);
      break;
    }
  }
  // 문턱과 슈트
  px(c, x - 4, y + h + 2, '5', w + 6, 3);
  const len = x - 4 - (TRAY.R + 8);
  for (let i = 0; i < len; i++) {
    px(c, x - 4 - i, y + h + 2 + Math.floor(i * 0.25), '4', 1, 3);
    px(c, x - 4 - i, y + h + 5 + Math.floor(i * 0.25), 'z', 1, 1);
  }
}

function paintShelf(c: Ctx) {
  const { x, y, w, h } = SHELF;
  px(c, x, y, 'z', w, h);
  px(c, x + 2, y + 2, '1', w - 4, h - 4);
  for (let k = 0; k < 3; k++) {
    const by = y + 40 + k * 44;
    px(c, x, by, '5', w, 3);
    px(c, x, by + 3, '3', w, 1);
  }
  px(c, x + 4, y + 4, '4', w - 8, 1);
}

function paintTrayBack(c: Ctx) {
  const { L, R, F, TOP } = TRAY;
  px(c, L - 8, TOP - 4, 'z', R - L + 16, F - TOP + 12);
  px(c, L, TOP, '1', R - L, F - TOP);
  for (let x = L; x < R; x += 16) px(c, x, TOP, '0', 1, F - TOP);
  for (let y = TOP + 16; y < F; y += 16) px(c, L, y, '2', R - L, 1);
}

function paintRail(c: Ctx, sockets: number) {
  const x0 = TRAY.L;
  const x1 = TRAY.R;
  px(c, x0, RAIL_Y, 'j', x1 - x0, 4);
  px(c, x0, RAIL_Y, 'l', x1 - x0, 1);
  px(c, x0, RAIL_Y + 4, '0', x1 - x0, 1);
  for (let i = 0; i < 2; i++) {
    const bx = i ? x1 - 6 : x0 + 2;
    px(c, bx, 0, 'j', 3, RAIL_Y);
  }
  SOCKET_X.forEach((sx, i) => {
    const open = i < sockets;
    px(c, sx - 5, RAIL_Y - 2, open ? 'k' : '2', 10, 8);
    px(c, sx - 4, RAIL_Y - 1, open ? 'l' : '1', 8, 2);
    px(c, sx - 1, RAIL_Y + 3, open ? 'b' : '2', 2, 2);
  });
}

export function paintForeground(c: Ctx) {
  const { L, R, F, TOP } = TRAY;
  c.clearRect(0, 0, W, H);
  // 양옆 벽판
  for (const x of [L - 8, R]) {
    px(c, x, TOP - 4, '4', 8, F - TOP + 12);
    px(c, x + 1, TOP - 4, '5', 2, F - TOP + 12);
    px(c, x + 7, TOP - 4, '3', 1, F - TOP + 12);
    for (let y = TOP + 8; y < F; y += 30) px(c, x + 3, y, 'l', 2, 2);
  }
  // 앞턱
  px(c, L - 8, F, '5', R - L + 16, 3);
  px(c, L - 8, F + 3, '4', R - L + 16, 4);
  px(c, L - 8, F + 7, '3', R - L + 16, 1);
  for (let x = L; x < R; x += 36) px(c, x, F + 4, 'l', 2, 2);
  // 테이블 다리
  px(c, L - 4, F + 8, 'z', 6, 32);
  px(c, R - 2, F + 8, 'z', 6, 32);
}
