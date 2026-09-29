import type { Mods } from './mods';

export type Material = 'wood' | 'glass' | 'metal' | 'cloth' | 'clock' | 'star';
export type SiteId = 'alley' | 'docks' | 'greenhouse' | 'attic' | 'crater';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legend';
export type DamageSrc =
  | 'strike'
  | 'shard'
  | 'spark'
  | 'blast'
  | 'fire'
  | 'pulse'
  | 'splinter'
  | 'resonance'
  | 'landing'
  | 'machine';

export interface JunkDef {
  id: string;
  name: string;
  mat: Material;
  hp: number;
  coins: number;
  star?: number;
  r: number; // 충돌 반지름(px)
  shards?: number;
  contents?: { pool: string[]; n: number };
  curio?: number; // 골동품 발견 확률
  bigBlast?: number; // 폭발/파동 크기 배율
  container?: boolean;
  desc: string;
}

export interface SiteDef {
  id: SiteId;
  name: string;
  npc: string;
  blurb: string;
  rule: string;
  coinMult: number;
  starMult: number;
  gravity: number;
  pool: Record<string, number>;
  curios: string[];
  lampToUnlock: number; // 이 수의 등불이 켜져야 갈 수 있다
}

export type ToolKind = 'mallet' | 'crowbar' | 'poker' | 'magnet' | 'fork' | 'key' | 'star';
export interface ToolDef {
  id: ToolKind;
  name: string;
  desc: string;
  cost: number;
  site: SiteId;
  radius: number;
  dmg: number;
}

export interface CurioDef {
  id: string;
  name: string;
  rarity: Rarity;
  site: SiteId | 'legend';
  desc: string;
  apply: (m: Mods) => void;
}

export type MachineKind = 'thumper' | 'magnetpole' | 'brazier' | 'bell' | 'winder' | 'antenna';
export interface MachineDef {
  id: MachineKind;
  name: string;
  desc: string;
  cost: number;
  site: SiteId;
}

export interface UpgradeDef {
  id: string;
  name: string;
  desc: (lvl: number) => string;
  max: number;
  site: SiteId;
  cost: (lvl: number) => number;
  apply: (m: Mods, lvl: number) => void;
}

export type GoalKind =
  | 'breakIds'
  | 'cartMat'
  | 'combo'
  | 'sparkChain'
  | 'magnetPull'
  | 'oneOriginMat'
  | 'blastChain'
  | 'clearCart'
  | 'fireBreaks'
  | 'resonanceBreaks'
  | 'heart';

export interface RequestDef {
  id: string;
  site: SiteId | 'post';
  title: string;
  text: string;
  kind: GoalKind;
  target: number;
  ids?: string[];
  mat?: Material;
  reward: { coins?: number; star?: number; curio?: string };
}

export interface LampDef {
  id: string;
  name: string;
  cost: number; // 별빛
  unlocks?: SiteId;
  text: string;
}

export interface ConstellationDef {
  id: string;
  name: string;
  desc: string;
  apply: (m: Mods) => void;
}

export interface SavedItem {
  d: string;
  x: number;
  y: number;
  hp: number;
  s?: 1;
  dp?: number;
  b?: 1;
  f?: number;
  v?: number;
}

export interface BenchSnapshot {
  site: SiteId;
  strikesLeft: number;
  extraStrikes: number;
  firstStrikeUsed: boolean;
  items: SavedItem[];
  rng: number;
  cartValueStart: number;
  pending: string[];
  machinesFired: boolean;
  freeGiven: number;
  bellsRung: number;
  loadCount: number;
  cart?: { coins: number; star: number; breaks: number };
}

export interface GameState {
  v: number;
  seed: number;
  coins: number;
  star: number;
  totalCoins: number;
  totalStar: number;
  site: SiteId;
  upgrades: Record<string, number>;
  tools: ToolKind[];
  tool: ToolKind;
  curios: string[]; // 보유(발견)한 골동품
  equipped: (string | null)[];
  machines: Partial<Record<MachineKind, number>>; // 보유 수
  sockets: (MachineKind | null)[];
  lamps: number;
  requests: Record<string, number>; // 진행도, -1 = 완료
  heart: { hp: number; max: number; phase: number } | null;
  ended: boolean;
  endedAt: number | null;
  ngPlus: number;
  constellation: string | null;
  badges: string[];
  peddler: { stock: string[]; refreshAt: number };
  bench: BenchSnapshot | null;
  cartSeq: number;
  breaksSinceCurio: number;
  seen: string[]; // 도감에 기록된 잡동사니
  stats: {
    carts: number;
    breaks: number;
    bestCombo: number;
    shinies: number;
    playTime: number;
    curiosFound: number;
  };
  milestones: Record<string, number>; // 이름 → 누적 플레이 시간(초)
  prefs: { magpieOff: boolean; eyeOff: boolean };
}
