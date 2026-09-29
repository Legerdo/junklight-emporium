// 시드 고정 난수 (mulberry32). 상태가 숫자 하나라 저장/복원이 쉽다.
export class Rng {
  s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pickWeighted<T>(list: { w: number; v: T }[]): T {
    let total = 0;
    for (const e of list) total += e.w;
    let r = this.next() * total;
    for (const e of list) {
      r -= e.w;
      if (r <= 0) return e.v;
    }
    return list[list.length - 1].v;
  }
}

export function hashSeed(...parts: number[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}
