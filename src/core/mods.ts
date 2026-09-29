// 모든 규칙 수치의 집합. 골동품·강화·도구·별자리가 이 값을 바꾸고,
// 작업대 시뮬레이션은 이 값만 읽는다.
import type { Material } from './types';

export interface Mods {
  strikes: number;
  power: number;
  radiusMult: number;
  firstStrikeBonus: number;
  cartSize: number;

  coinMult: number;
  matCoin: Record<Material, number>;
  salvage: number;
  starBonus: number; // 별빛을 주는 물건마다 +n
  starMult: number;

  shardBonus: number;
  shardBounce: number;
  prism: boolean;

  sparkJumps: number;
  sparkRange: number;
  sparkDmg: number;
  sparkClock: boolean;
  sparkAny: boolean;

  crateExtra: number;
  dustRadius: number;
  dustVuln: number;

  fuse: number;
  blastRadius: number;
  blastDmg: number;
  blastIgnite: boolean;
  clockRearm: boolean;

  fireDmg: number;
  fireSpread: number;
  fireCloth: boolean;

  comboStep: number;
  comboWindow: number;
  comboCap: number;

  curioMult: number;
  shinyChance: number;

  pulseRadius: number;
  pulseDmg: number;
  meteorChance: number;
  pulseOnBreak: boolean;

  freeStrikeEvery: number;
  freeStrikeMax: number;
  landing: boolean;
  safeHpMult: number;
  safeCoinMult: number;
  glassHpBonus: number;
  heartMult: number;
  poolBias: Partial<Record<Material, number>>;
}

export function baseMods(): Mods {
  return {
    strikes: 3,
    power: 0,
    radiusMult: 1,
    firstStrikeBonus: 0,
    cartSize: 8,
    coinMult: 1,
    matCoin: { wood: 1, glass: 1, metal: 1, cloth: 1, clock: 1, star: 1 },
    salvage: 0.25,
    starBonus: 0,
    starMult: 1,
    shardBonus: 0,
    shardBounce: 0,
    prism: false,
    sparkJumps: 2,
    sparkRange: 56,
    sparkDmg: 2,
    sparkClock: false,
    sparkAny: false,
    crateExtra: 0,
    dustRadius: 22,
    dustVuln: 1,
    fuse: 1.1,
    blastRadius: 34,
    blastDmg: 3,
    blastIgnite: false,
    clockRearm: false,
    fireDmg: 1,
    fireSpread: 0.45,
    fireCloth: false,
    comboStep: 0.04,
    comboWindow: 1.3,
    comboCap: 3,
    curioMult: 1,
    shinyChance: 0.015,
    pulseRadius: 44,
    pulseDmg: 2,
    meteorChance: 0,
    pulseOnBreak: false,
    freeStrikeEvery: 0,
    freeStrikeMax: 0,
    landing: false,
    safeHpMult: 1,
    safeCoinMult: 1,
    glassHpBonus: 0,
    heartMult: 1,
    poolBias: {},
  };
}
