import type { Game } from './game';
import { normalize } from './state';
import type { GameState } from './types';

export const SAVE_KEY = 'junklight.save.v1';

export interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

// 보상은 부서지는 순간 상태에 반영되고, 부서진 물건은 작업대 스냅샷에서 빠진다.
// 따라서 어느 순간에 저장해도 같은 보상이 두 번 들어오지 않는다.
export function serialize(g: Game): string {
  const s: GameState = { ...g.s };
  if (g.bench) {
    s.bench = g.bench.snapshot();
    s.bench.cart = { coins: g.cart.coins, star: g.cart.star, breaks: g.cart.breaks };
  } else s.bench = null;
  return JSON.stringify(s);
}

export function saveGame(g: Game, store: Storage) {
  try {
    store.setItem(SAVE_KEY, serialize(g));
    return true;
  } catch {
    return false;
  }
}

export function loadState(store: Storage): GameState | null {
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}
