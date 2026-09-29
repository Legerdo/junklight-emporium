// 스프라이트 정의를 캔버스로 굽는다. Phaser 텍스처와 HTML 아이콘이 같은 원본을 쓴다.
import { CURIO_SPRITES, JUNK_SPRITES, MACHINE_SPRITES, MISC_SPRITES, TOOL_SPRITES, crackGrid, goldMap, gridToCanvas, toGrid } from './sprites';
import { PAL } from './palette';

export const CANVASES = new Map<string, HTMLCanvasElement>();
export const JUNK_COLORS: Record<string, string[]> = {};
const urls = new Map<string, string>();

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function buildAll() {
  if (CANVASES.size) return CANVASES;
  for (const [id, def] of Object.entries(JUNK_SPRITES)) {
    const g = toGrid(def);
    CANVASES.set(`j_${id}`, gridToCanvas(g));
    CANVASES.set(`j_${id}_g`, gridToCanvas(g, goldMap));
    CANVASES.set(`j_${id}_w`, gridToCanvas(g, (c) => (c === '0' ? '0' : 'w')));
    CANVASES.set(`j_${id}_c1`, gridToCanvas(crackGrid(g, hash(id), 1)));
    CANVASES.set(`j_${id}_c2`, gridToCanvas(crackGrid(g, hash(id), 2)));
    const cols = new Set<string>();
    g.forEach((row) => row.forEach((c) => c && c !== '0' && cols.add(PAL[c])));
    JUNK_COLORS[id] = [...cols];
  }
  for (const [id, def] of Object.entries(TOOL_SPRITES)) CANVASES.set(`t_${id}`, gridToCanvas(toGrid(def)));
  for (const [id, def] of Object.entries(MACHINE_SPRITES)) CANVASES.set(`m_${id}`, gridToCanvas(toGrid(def)));
  for (const [id, def] of Object.entries(CURIO_SPRITES)) CANVASES.set(`c_${id}`, gridToCanvas(toGrid(def)));
  for (const [id, def] of Object.entries(MISC_SPRITES)) CANVASES.set(`x_${id}`, gridToCanvas(toGrid(def)));
  buildHeart();
  return CANVASES;
}

// 별의 심장: 단계마다 껍질이 벗겨진다(절차적 픽셀 원).
function buildHeart() {
  const R = 22;
  const size = R * 2 + 3;
  for (let phase = 0; phase < 4; phase++) {
    for (const white of [false, true]) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const c = cv.getContext('2d')!;
      let s = 99 + phase;
      const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const dx = x - R - 1;
          const dy = y - R - 1;
          const d = Math.hypot(dx, dy);
          if (d > R + 0.5) continue;
          let col: string;
          const edge = d > R - 1.2;
          const light = (-dx - dy) / (R * 1.4);
          if (edge) col = '0';
          else if (phase === 0) col = light > 0.4 ? '3' : light > 0 ? '2' : '1';
          else if (phase === 1) col = light > 0.5 ? 'f' : light > 0.1 ? 'e' : light > -0.3 ? 'd' : 'c';
          else if (phase === 2) col = d < R * 0.45 ? 'w' : light > 0.2 ? 'v' : light > -0.3 ? 'b' : 'a';
          else col = d < R * 0.6 ? 'w' : 'v';
          c.fillStyle = white && !edge ? PAL.w : PAL[col];
          c.fillRect(x, y, 1, 1);
        }
      if (!white) {
        // 균열/빛줄기
        const crack = phase === 0 ? 'a' : phase === 1 ? 'w' : 'a';
        const n = phase === 0 ? 5 : phase === 1 ? 7 : 4;
        for (let k = 0; k < n; k++) {
          let x = R + 1;
          let y = R + 1;
          const a = rnd() * Math.PI * 2;
          for (let i = 0; i < R - 2; i++) {
            x += Math.cos(a) + (rnd() - 0.5);
            y += Math.sin(a) + (rnd() - 0.5);
            if (Math.hypot(x - R - 1, y - R - 1) < R - 1.5 && i > 3) {
              c.fillStyle = PAL[crack];
              c.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
          }
        }
      }
      CANVASES.set(`heart_${phase}${white ? '_w' : ''}`, cv);
    }
  }
}

export function iconUrl(key: string): string {
  let u = urls.get(key);
  if (u) return u;
  const cv = CANVASES.get(key);
  if (!cv) return '';
  u = cv.toDataURL();
  urls.set(key, u);
  return u;
}

export function iconSize(key: string) {
  const cv = CANVASES.get(key);
  return cv ? { w: cv.width, h: cv.height } : { w: 8, h: 8 };
}
