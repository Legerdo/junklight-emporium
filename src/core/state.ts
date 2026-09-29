import { CURIO, JUNK, REQUESTS } from './data';
import type { GameState } from './types';

export const SAVE_VERSION = 1;

export function newState(seed = (Math.random() * 2 ** 31) >>> 0): GameState {
  return {
    v: SAVE_VERSION,
    seed,
    coins: 0,
    star: 0,
    totalCoins: 0,
    totalStar: 0,
    site: 'alley',
    upgrades: {},
    tools: ['mallet'],
    tool: 'mallet',
    curios: [],
    equipped: [null],
    machines: {},
    sockets: [],
    lamps: 0,
    requests: {},
    heart: null,
    ended: false,
    endedAt: null,
    ngPlus: 0,
    constellation: null,
    badges: [],
    peddler: { stock: [], refreshAt: 0 },
    bench: null,
    cartSeq: 0,
    breaksSinceCurio: 0,
    seen: [],
    stats: { carts: 0, breaks: 0, bestCombo: 0, shinies: 0, playTime: 0, curiosFound: 0 },
    milestones: {},
    prefs: { magpieOff: false, eyeOff: false },
  };
}

// 저장 데이터를 현재 구조에 맞게 보정한다(누락 필드 채움, 잘못된 id 제거).
export function normalize(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<GameState>;
  if (typeof r.coins !== 'number' || typeof r.seed !== 'number') return null;
  const base = newState(r.seed);
  const s: GameState = {
    ...base,
    ...r,
    stats: { ...base.stats, ...(r.stats ?? {}) },
    peddler: { ...base.peddler, ...(r.peddler ?? {}) },
    prefs: { ...base.prefs, ...(r.prefs ?? {}) },
  } as GameState;
  s.curios = (s.curios ?? []).filter((id) => CURIO[id]);
  s.equipped = (s.equipped ?? [null]).map((id) => (id && CURIO[id] && s.curios.includes(id) ? id : null));
  if (!s.equipped.length) s.equipped = [null];
  s.seen = (s.seen ?? []).filter((id) => JUNK[id]);
  s.peddler.stock = s.peddler.stock.filter((id) => CURIO[id]);
  for (const k of Object.keys(s.requests)) if (!REQUESTS.some((q) => q.id === k)) delete s.requests[k];
  if (!Number.isFinite(s.coins) || s.coins < 0) s.coins = 0;
  if (!Number.isFinite(s.star) || s.star < 0) s.star = 0;
  s.v = SAVE_VERSION;
  return s;
}
