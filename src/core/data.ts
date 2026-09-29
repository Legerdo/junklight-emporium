// 콘텐츠·밸런스 데이터. 수치 조정은 이 파일에서 한다.
import type {
  ConstellationDef,
  CurioDef,
  JunkDef,
  LampDef,
  MachineDef,
  RequestDef,
  SiteDef,
  ToolDef,
  UpgradeDef,
  Material,
  SiteId,
} from './types';

export const MAT_NAME: Record<Material, string> = {
  wood: '나무',
  glass: '유리',
  metal: '금속',
  cloth: '천',
  clock: '태엽',
  star: '별',
};

export const MAT_RULE: Record<Material, string> = {
  wood: '부서지면 파편이 닿은 물건을 때린다. 불이 붙고, 불로 태우면 동전 +50%.',
  glass: '깨지면 유리 파편이 사방으로 튄다.',
  metal: '부서지면 가까운 금속으로 스파크가 튄다.',
  cloth: '먼지를 뿜어 주변을 약하게 만든다. 파편을 막는다.',
  clock: '맞으면 태엽이 감겨 잠시 뒤 폭발한다.',
  star: '부서지면 별빛 파동이 퍼진다. 별빛을 준다.',
};

const J = (d: JunkDef) => d;
export const JUNK: Record<string, JunkDef> = Object.fromEntries(
  [
    // 뒷골목
    J({ id: 'crate', name: '나무 상자', mat: 'wood', hp: 3, coins: 3, r: 8, container: true, contents: { pool: ['bottle', 'can', 'rag', 'bulb', 'purse', 'paper'], n: 2 }, desc: '안에 뭐가 들었을까.' }),
    J({ id: 'bottle', name: '유리병', mat: 'glass', hp: 1, coins: 2, r: 5, shards: 3, desc: '톡 치면 와장창.' }),
    J({ id: 'rag', name: '헌 천 뭉치', mat: 'cloth', hp: 2, coins: 3, r: 7, desc: '먼지가 풀풀.' }),
    J({ id: 'can', name: '찌그러진 깡통', mat: 'metal', hp: 2, coins: 2, r: 6, desc: '전기가 잘 통한다.' }),
    J({ id: 'bulb', name: '낡은 전구', mat: 'glass', hp: 1, coins: 1, star: 1, r: 5, shards: 2, desc: '별빛이 조금 남아 있다.' }),
    J({ id: 'paper', name: '신문 뭉치', mat: 'wood', hp: 1, coins: 1, r: 7, desc: '잘 탄다.' }),
    J({ id: 'teddy', name: '헌 곰인형', mat: 'cloth', hp: 3, coins: 5, r: 7, curio: 0.025, desc: '솜 속에 뭔가 숨겨져 있기도.' }),
    J({ id: 'drawer', name: '서랍장', mat: 'wood', hp: 6, coins: 8, r: 11, container: true, contents: { pool: ['bottle', 'can', 'rag', 'bulb', 'purse', 'teddy', 'starbit'], n: 3 }, curio: 0.012, desc: '서랍마다 잡동사니가 가득.' }),
    J({ id: 'purse', name: '동전 주머니', mat: 'cloth', hp: 1, coins: 9, r: 5, desc: '짤랑짤랑.' }),
    J({ id: 'starbit', name: '별부스러기', mat: 'star', hp: 2, coins: 4, star: 2, r: 5, desc: '떨어진 별의 아주 작은 조각.' }),
    // 고철 부두
    J({ id: 'chain', name: '쇠사슬', mat: 'metal', hp: 3, coins: 4, r: 7, desc: '무겁고 전기가 잘 흐른다.' }),
    J({ id: 'plate', name: '고철판', mat: 'metal', hp: 4, coins: 5, r: 9, desc: '두껍다.' }),
    J({ id: 'safe', name: '작은 금고', mat: 'metal', hp: 12, coins: 30, r: 10, container: true, contents: { pool: ['purse', 'purse', 'starbit', 'lantern'], n: 2 }, curio: 0.07, desc: '단단하지만 보물이 있다.' }),
    J({ id: 'net', name: '낡은 어망', mat: 'cloth', hp: 3, coins: 4, r: 8, desc: '비린내 나는 먼지.' }),
    J({ id: 'buoy', name: '유리 부표', mat: 'glass', hp: 2, coins: 5, r: 7, shards: 4, desc: '두꺼운 유리.' }),
    J({ id: 'lantern', name: '선박 랜턴', mat: 'glass', hp: 2, coins: 4, star: 1, r: 6, shards: 3, desc: '별빛이 스며 있다.' }),
    J({ id: 'seachest', name: '선원 상자', mat: 'wood', hp: 4, coins: 5, r: 9, container: true, contents: { pool: ['chain', 'can', 'lantern', 'purse', 'net', 'bottle'], n: 3 }, curio: 0.012, desc: '짠내 나는 상자.' }),
    // 유리 온실
    J({ id: 'pot', name: '깨진 화분', mat: 'glass', hp: 2, coins: 4, r: 7, shards: 3, desc: '도자기도 잘 깨진다.' }),
    J({ id: 'pane', name: '온실 유리판', mat: 'glass', hp: 1, coins: 3, r: 8, shards: 5, desc: '얇고 날카롭다.' }),
    J({ id: 'belljar', name: '유리 종', mat: 'glass', hp: 2, coins: 8, r: 8, shards: 6, curio: 0.035, desc: '표본이 들어 있곤 하다.' }),
    J({ id: 'wcan', name: '녹슨 물뿌리개', mat: 'metal', hp: 3, coins: 5, r: 7, desc: '물기 머금은 금속.' }),
    J({ id: 'planter', name: '나무 화단 상자', mat: 'wood', hp: 5, coins: 6, r: 10, container: true, contents: { pool: ['pot', 'pane', 'seedbag', 'lampglass', 'bottle'], n: 3 }, desc: '흙과 유리가 뒤섞였다.' }),
    J({ id: 'seedbag', name: '씨앗 자루', mat: 'cloth', hp: 2, coins: 6, r: 6, desc: '포슬포슬한 먼지.' }),
    J({ id: 'lampglass', name: '온실등', mat: 'glass', hp: 1, coins: 3, star: 1, r: 5, shards: 3, desc: '희미한 별빛.' }),
    // 시계탑 다락
    J({ id: 'windup', name: '태엽 인형', mat: 'clock', hp: 2, coins: 6, r: 6, desc: '건드리면 째깍째깍.' }),
    J({ id: 'cuckoo', name: '뻐꾸기 시계', mat: 'clock', hp: 4, coins: 12, r: 9, bigBlast: 1.4, desc: '크게 터진다.' }),
    J({ id: 'gearbox', name: '톱니 상자', mat: 'metal', hp: 5, coins: 10, r: 8, desc: '톱니가 빼곡하다.' }),
    J({ id: 'trunk', name: '낡은 트렁크', mat: 'wood', hp: 8, coins: 15, r: 12, container: true, contents: { pool: ['windup', 'frame', 'musicbox', 'purse', 'rag', 'windup'], n: 4 }, curio: 0.015, desc: '누군가의 추억 한 짐.' }),
    J({ id: 'musicbox', name: '오르골', mat: 'clock', hp: 3, coins: 10, r: 7, curio: 0.035, desc: '멜로디와 함께 터진다.' }),
    J({ id: 'frame', name: '초상화 액자', mat: 'wood', hp: 3, coins: 8, r: 8, desc: '마른 나무 틀.' }),
    // 별 낙하지
    J({ id: 'starshard', name: '별조각', mat: 'star', hp: 3, coins: 10, star: 3, r: 6, desc: '따뜻하게 빛난다.' }),
    J({ id: 'meteor', name: '작은 운석', mat: 'star', hp: 10, coins: 30, star: 10, r: 11, bigBlast: 1.6, curio: 0.08, desc: '묵직한 별빛 덩어리.' }),
    J({ id: 'slag', name: '녹은 고철', mat: 'metal', hp: 4, coins: 8, r: 8, desc: '별의 열에 녹았다.' }),
    J({ id: 'glassrock', name: '유리화 돌', mat: 'glass', hp: 3, coins: 8, r: 7, shards: 5, desc: '모래가 녹아 유리가 됐다.' }),
    J({ id: 'charcrate', name: '그을린 상자', mat: 'wood', hp: 4, coins: 8, r: 9, container: true, contents: { pool: ['starshard', 'slag', 'glassrock', 'starclock', 'bulb', 'rag'], n: 3 }, desc: '아직 뜨겁다.' }),
    J({ id: 'starclock', name: '별 태엽', mat: 'clock', hp: 3, coins: 15, star: 2, r: 7, desc: '별빛으로 도는 태엽.' }),
    // 특수
    J({ id: 'heart', name: '별의 심장', mat: 'star', hp: 1, coins: 0, r: 22, desc: '떨어진 별의 핵. 연쇄 반응으로만 깨어난다.' }),
  ].map((d) => [d.id, d]),
);

export const SITES: SiteDef[] = [
  {
    id: 'alley',
    name: '뒷골목 쓰레기장',
    npc: '호롱 영감',
    blurb: '상자와 병, 헌 천이 굴러다니는 골목.',
    rule: '기본 규칙을 익히기 좋은 곳.',
    coinMult: 1,
    starMult: 1,
    gravity: 520,
    pool: { crate: 20, bottle: 18, rag: 13, can: 12, bulb: 7, paper: 14, teddy: 6, drawer: 5, starbit: 2 },
    curios: ['purse', 'falsebottom', 'marbles', 'glove', 'crowfeather', 'duster', 'matchbox'],
    lampToUnlock: 0,
  },
  {
    id: 'docks',
    name: '고철 부두',
    npc: '갈매 선장',
    blurb: '녹슨 금속과 금고가 쌓인 부두.',
    rule: '젖은 부두: 스파크가 30% 더 멀리 튄다.',
    coinMult: 3,
    starMult: 2,
    gravity: 520,
    pool: { can: 14, chain: 14, plate: 10, safe: 4, net: 10, buoy: 9, lantern: 7, seachest: 9, bottle: 7, starbit: 3, windup: 2 },
    curios: ['coil', 'wetrope', 'anchor', 'lens', 'compass'],
    lampToUnlock: 1,
  },
  {
    id: 'greenhouse',
    name: '유리 온실 폐허',
    npc: '정원사 이끼',
    blurb: '깨진 유리와 화분이 가득한 온실.',
    rule: '유리 온실: 유리 파편이 1개씩 더 튄다.',
    coinMult: 8,
    starMult: 4,
    gravity: 520,
    pool: { pot: 14, pane: 16, belljar: 6, wcan: 10, planter: 10, seedbag: 8, lampglass: 8, can: 6, rag: 5, crate: 5, starbit: 4 },
    curios: ['dewdrop', 'prism', 'butterfly', 'moss', 'bellows'],
    lampToUnlock: 2,
  },
  {
    id: 'attic',
    name: '시계탑 다락',
    npc: '태엽 박사',
    blurb: '멈춘 시계와 태엽 장난감의 무덤.',
    rule: '째깍이는 다락: 태엽 도화선이 20% 짧다.',
    coinMult: 20,
    starMult: 8,
    gravity: 520,
    pool: { windup: 14, cuckoo: 6, gearbox: 10, trunk: 7, musicbox: 6, frame: 10, crate: 6, bottle: 6, can: 7, rag: 6, paper: 8, starbit: 4, lantern: 5 },
    curios: ['cuckoofeather', 'gearnecklace', 'pocketwatch', 'sheetmusic', 'loupe'],
    lampToUnlock: 3,
  },
  {
    id: 'crater',
    name: '별 낙하지',
    npc: '호롱 영감',
    blurb: '별이 떨어진 언덕. 중력이 약하다.',
    rule: '낮은 중력: 물건이 천천히 떨어지고 높이 튄다.',
    coinMult: 45,
    starMult: 10,
    gravity: 300,
    pool: { starshard: 12, meteor: 3, slag: 10, glassrock: 10, charcrate: 10, starclock: 8, chain: 6, cuckoo: 4, pane: 6, windup: 6, rag: 4, bulb: 5, paper: 5 },
    curios: ['stardust', 'meteorite', 'lodestone'],
    lampToUnlock: 4,
  },
];
export const SITE: Record<SiteId, SiteDef> = Object.fromEntries(SITES.map((s) => [s.id, s])) as Record<SiteId, SiteDef>;

export const TOOLS: ToolDef[] = [
  { id: 'mallet', name: '나무 망치', desc: '넓게 두드린다. 무난하다.', cost: 0, site: 'alley', radius: 16, dmg: 2 },
  { id: 'crowbar', name: '쇠지레', desc: '한 물건을 강하게 비틀고 맞닿은 물건을 벌린다(절반 피해). 상자는 내용물 +2, 금고엔 2배.', cost: 150, site: 'alley', radius: 9, dmg: 5 },
  { id: 'poker', name: '부지깽이', desc: '주변 나무·천에 불을 붙인다. 불은 옆 나무로 번지고 위력 강화로 더 세게 탄다.', cost: 400, site: 'alley', radius: 14, dmg: 1 },
  { id: 'magnet', name: '말굽 자석', desc: '넓은 범위의 금속을 한데 끌어모은 뒤, 모인 금속 전부에 전기를 흘린다.', cost: 4000, site: 'docks', radius: 26, dmg: 2 },
  { id: 'fork', name: '소리굽쇠', desc: '작업대 위 모든 유리를 울린다(위력이 그대로 실린다). 직접 치는 힘은 약하다.', cost: 50000, site: 'greenhouse', radius: 14, dmg: 1 },
  { id: 'key', name: '태엽 열쇠', desc: '넓게 주변 태엽을 모두 감는다. 열쇠로 감긴 태엽은 1.5배 넓고 더 세게 터진다.', cost: 400000, site: 'attic', radius: 56, dmg: 1 },
  { id: 'star', name: '별망치', desc: '이 망치로 부순 물건은 작은 별빛 파동을 낸다.', cost: 4000000, site: 'crater', radius: 22, dmg: 4 },
];
export const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolDef['id'], ToolDef>;

const C = (c: CurioDef) => c;
export const CURIOS: CurioDef[] = [
  // 뒷골목
  C({ id: 'purse', name: '빛바랜 지갑', rarity: 'common', site: 'alley', desc: '나무 물건의 동전 +60%.', apply: (m) => (m.matCoin.wood *= 1.6) }),
  C({ id: 'falsebottom', name: '이중 바닥', rarity: 'uncommon', site: 'alley', desc: '상자류가 부서지면 내용물 +1.', apply: (m) => (m.crateExtra += 1) }),
  C({ id: 'marbles', name: '유리구슬 주머니', rarity: 'common', site: 'alley', desc: '유리 파편 +2.', apply: (m) => (m.shardBonus += 2) }),
  C({ id: 'glove', name: '헌 가죽 장갑', rarity: 'common', site: 'alley', desc: '수레마다 첫 타격 위력 +3.', apply: (m) => (m.firstStrikeBonus += 3) }),
  C({ id: 'crowfeather', name: '까마귀 깃털', rarity: 'uncommon', site: 'alley', desc: '남은 고물 처분가 25% → 80%.', apply: (m) => (m.salvage = Math.max(m.salvage, 0.8)) }),
  C({ id: 'duster', name: '먼지떨이', rarity: 'common', site: 'alley', desc: '천 먼지 범위 ×2, 약화 +1.', apply: (m) => ((m.dustRadius *= 2), (m.dustVuln += 1)) }),
  C({ id: 'matchbox', name: '성냥갑', rarity: 'uncommon', site: 'alley', desc: '불이 천에도 번지고, 번질 확률 +30%.', apply: (m) => ((m.fireCloth = true), (m.fireSpread += 0.3)) }),
  // 부두
  C({ id: 'coil', name: '구리 코일', rarity: 'common', site: 'docks', desc: '스파크 도약 +2.', apply: (m) => (m.sparkJumps += 2) }),
  C({ id: 'wetrope', name: '젖은 밧줄', rarity: 'uncommon', site: 'docks', desc: '스파크가 태엽 물건에도 튀어 태엽을 감는다.', apply: (m) => (m.sparkClock = true) }),
  C({ id: 'anchor', name: '녹슨 닻', rarity: 'uncommon', site: 'docks', desc: '금속이 세게 떨어지면 아래 물건에 피해 1.', apply: (m) => (m.landing = true) }),
  C({ id: 'lens', name: '등대 렌즈', rarity: 'common', site: 'docks', desc: '별빛을 주는 물건마다 별빛 +1.', apply: (m) => (m.starBonus += 1) }),
  C({ id: 'compass', name: '선원 나침반', rarity: 'common', site: 'docks', desc: '금고 체력 -50%, 금고 동전 +50%.', apply: (m) => ((m.safeHpMult *= 0.5), (m.safeCoinMult *= 1.5)) }),
  // 온실
  C({ id: 'dewdrop', name: '이슬 방울', rarity: 'uncommon', site: 'greenhouse', desc: '유리 파편이 한 번 튕겨 두 번 때린다.', apply: (m) => (m.shardBounce += 1) }),
  C({ id: 'prism', name: '프리즘', rarity: 'rare', site: 'greenhouse', desc: '파편이 금속에 맞으면 스파크가 튄다.', apply: (m) => (m.prism = true) }),
  C({ id: 'butterfly', name: '나비 표본', rarity: 'uncommon', site: 'greenhouse', desc: '연쇄 12마다 타격 +1 (수레당 최대 2).', apply: (m) => ((m.freeStrikeEvery = 12), (m.freeStrikeMax += 2)) }),
  C({ id: 'moss', name: '이끼 낀 돌', rarity: 'common', site: 'greenhouse', desc: '유리 동전 ×2, 대신 유리 체력 +1.', apply: (m) => ((m.matCoin.glass *= 2), (m.glassHpBonus += 1)) }),
  C({ id: 'bellows', name: '풀무 가죽', rarity: 'common', site: 'greenhouse', desc: '불 피해 ×2, 불이 반드시 번진다.', apply: (m) => ((m.fireDmg *= 2), (m.fireSpread = 1)) }),
  // 다락
  C({ id: 'cuckoofeather', name: '뻐꾸기 깃', rarity: 'common', site: 'attic', desc: '태엽 도화선 -50%, 폭발 범위 +30%.', apply: (m) => ((m.fuse *= 0.5), (m.blastRadius *= 1.3)) }),
  C({ id: 'gearnecklace', name: '톱니 목걸이', rarity: 'uncommon', site: 'attic', desc: '폭발이 나무와 천에 불을 붙인다.', apply: (m) => (m.blastIgnite = true) }),
  C({ id: 'pocketwatch', name: '회중시계', rarity: 'uncommon', site: 'attic', desc: '연쇄 유지 시간 +1초.', apply: (m) => (m.comboWindow += 1) }),
  C({ id: 'sheetmusic', name: '낡은 악보', rarity: 'common', site: 'attic', desc: '연쇄 배율 +0.03/개, 상한 +1.5.', apply: (m) => ((m.comboStep += 0.03), (m.comboCap += 1.5)) }),
  C({ id: 'loupe', name: '금 간 돋보기', rarity: 'rare', site: 'attic', desc: '골동품 발견 ×2, 반짝이 확률 ×1.5.', apply: (m) => ((m.curioMult *= 2), (m.shinyChance *= 1.5)) }),
  // 낙하지
  C({ id: 'stardust', name: '별가루 병', rarity: 'common', site: 'crater', desc: '별 파동 범위 +60%, 피해 +1.', apply: (m) => ((m.pulseRadius *= 1.6), (m.pulseDmg += 1)) }),
  C({ id: 'meteorite', name: '운석 조각', rarity: 'uncommon', site: 'crater', desc: '부서지는 물건이 5% 확률로 별부스러기를 남긴다.', apply: (m) => (m.meteorChance += 0.05) }),
  C({ id: 'lodestone', name: '천연 자석', rarity: 'rare', site: 'crater', desc: '스파크가 모든 재질로 튄다.', apply: (m) => (m.sparkAny = true) }),
  // 엔딩 이후
  C({ id: 'stareye', name: '떨어진 별의 눈', rarity: 'legend', site: 'legend', desc: '모든 파괴가 작은 별빛 파동을 낸다.', apply: (m) => (m.pulseOnBreak = true) }),
  C({ id: 'endless', name: '끝없는 태엽', rarity: 'legend', site: 'legend', desc: '태엽 물건이 한 번 더 폭발한다.', apply: (m) => (m.clockRearm = true) }),
  C({ id: 'crown', name: '고물왕의 왕관', rarity: 'legend', site: 'legend', desc: '동전 ×2, 수레 적재 +6.', apply: (m) => ((m.coinMult *= 2), (m.cartSize += 6)) }),
];
export const CURIO = Object.fromEntries(CURIOS.map((c) => [c.id, c])) as Record<string, CurioDef>;
export const RARITY_NAME = { common: '흔함', uncommon: '드묾', rare: '귀함', legend: '전설' } as const;
export const RARITY_WEIGHT = { common: 6, uncommon: 3, rare: 1.2, legend: 1 } as const;

export const MACHINES: MachineDef[] = [
  { id: 'thumper', name: '쿵쿵이', desc: '첫 타격이 떨어지면 따라서 자기 줄 맨 위 물건을 내리친다.', cost: 900, site: 'docks' },
  { id: 'magnetpole', name: '자석 기둥', desc: '쏟아지는 금속을 자기 줄로 끌어오고, 첫 타격 때 전기를 흘린다.', cost: 8000, site: 'docks' },
  { id: 'brazier', name: '화로', desc: '첫 타격 때 자기 줄에 가까운 나무·천 2개에 불을 붙인다.', cost: 40000, site: 'greenhouse' },
  { id: 'bell', name: '공명 종', desc: '연쇄 6에 울려 모든 유리를 때린다 (수레당 한 번).', cost: 70000, site: 'greenhouse' },
  { id: 'winder', name: '태엽 감개', desc: '첫 타격 때 자기 줄에 가까운 태엽 2개를 감는다.', cost: 400000, site: 'attic' },
  { id: 'antenna', name: '별 수신탑', desc: '첫 타격 때 자기 줄에 별빛 파동을 쏜다. 별빛 +10%.', cost: 3000000, site: 'crater' },
];
export const MACHINE = Object.fromEntries(MACHINES.map((m) => [m.id, m])) as Record<MachineDef['id'], MachineDef>;
export const machineCost = (id: MachineDef['id'], owned: number) => Math.round(MACHINE[id].cost * Math.pow(2.6, owned));
export const SOCKET_X = [161, 203, 245, 287, 329];

const geo = (base: number, g: number) => (l: number) => Math.round(base * Math.pow(g, l));
export const UPGRADES: UpgradeDef[] = [
  { id: 'power', name: '도구 손질', desc: (l) => `도구와 쿵쿵이 위력 +1 (현재 +${l})`, max: 12, site: 'alley', cost: geo(25, 3), apply: (m, l) => (m.power += l) },
  { id: 'cart', name: '큰 수레', desc: (l) => `수레 적재 +2 (현재 ${8 + l * 2}개)`, max: 12, site: 'alley', cost: geo(40, 3), apply: (m, l) => (m.cartSize += l * 2) },
  { id: 'strikes', name: '굳은살', desc: (l) => `수레당 타격 +1 (현재 ${3 + l}번)`, max: 4, site: 'alley', cost: (l) => [150, 3000, 60000, 1200000][l] ?? 1e15, apply: (m, l) => (m.strikes += l) },
  { id: 'appraise', name: '감정 실력', desc: (l) => `모든 동전 +15% (현재 +${l * 15}%)`, max: 12, site: 'alley', cost: geo(100, 3), apply: (m, l) => (m.coinMult *= 1 + 0.15 * l) },
  { id: 'slots', name: '진열장 칸', desc: (l) => `골동품 칸 +1 (현재 ${1 + l}칸)`, max: 5, site: 'alley', cost: (l) => [120, 4000, 60000, 700000, 6000000][l] ?? 1e15, apply: () => {} },
  { id: 'combo', name: '연쇄 감각', desc: (l) => `연쇄 배율 +0.02/개, 상한 +0.5 (현재 +${(l * 0.02).toFixed(2)})`, max: 8, site: 'docks', cost: geo(800, 2.8), apply: (m, l) => ((m.comboStep += 0.02 * l), (m.comboCap += 0.5 * l)) },
  { id: 'sockets', name: '작업대 소켓', desc: (l) => `장치 소켓 +1 (현재 ${l}개)`, max: 5, site: 'docks', cost: (l) => [900, 12000, 150000, 1500000, 12000000][l] ?? 1e15, apply: () => {} },
  { id: 'magpie', name: '까치 조수', desc: () => '정산이 끝나면 다음 수레를 알아서 부른다.', max: 1, site: 'docks', cost: () => 2500, apply: () => {} },
  { id: 'magpieEye', name: '까치의 눈', desc: () => '잠시 손을 놓으면 까치가 남은 타격을 좋은 자리에 쓴다.', max: 1, site: 'greenhouse', cost: () => 60000, apply: () => {} },
  { id: 'lucky', name: '반짝이 감별', desc: (l) => `반짝이는 물건 확률 +0.75% (현재 ${(1.5 + l * 0.75).toFixed(2)}%)`, max: 4, site: 'greenhouse', cost: geo(20000, 3), apply: (m, l) => (m.shinyChance += 0.0075 * l) },
];
export const UPGRADE = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<string, UpgradeDef>;

export const LAMPS: LampDef[] = [
  { id: 'l1', name: '골목 가로등', cost: 150, unlocks: 'docks', text: '골목에 불이 들어왔다. 부두로 가는 길이 보인다.' },
  { id: 'l2', name: '부두 등대', cost: 750, unlocks: 'greenhouse', text: '등대가 돌기 시작했다. 언덕 위 온실이 빛난다.' },
  { id: 'l3', name: '온실 등롱', cost: 2400, unlocks: 'attic', text: '온실이 초록빛으로 물들었다. 시계탑 창이 열렸다.' },
  { id: 'l4', name: '시계탑 불빛', cost: 5500, unlocks: 'crater', text: '시계탑이 다시 울린다. 별이 떨어진 언덕이 드러났다.' },
  { id: 'l5', name: '별 받침대', cost: 30000, text: '받침대가 빛나자 별의 심장이 작업대로 굴러왔다.' },
];

export const HEART_HP = 8000;
export const HEART_PHASES = [
  { name: '그을린 껍질', weak: ['blast', 'fire'] as string[], hint: '폭발과 불에 약하다.' },
  { name: '유리 결정', weak: ['shard', 'resonance'] as string[], hint: '유리 파편과 공명에 약하다.' },
  { name: '빛나는 핵', weak: ['spark', 'pulse'] as string[], hint: '스파크와 별빛 파동에 약하다.' },
];

export const REQUESTS: RequestDef[] = [
  { id: 'a1', site: 'alley', title: '상자 속을 보자', text: '상자나 서랍장 5개를 부숴라.', kind: 'breakIds', ids: ['crate', 'drawer'], target: 5, reward: { coins: 40 } },
  { id: 'a2', site: 'alley', title: '와장창', text: '한 수레에서 유리 4개를 깨라.', kind: 'cartMat', mat: 'glass', target: 4, reward: { star: 3 } },
  { id: 'a3', site: 'alley', title: '작은 연쇄', text: '연쇄 8을 만들어라.', kind: 'combo', target: 8, reward: { curio: 'falsebottom' } },
  { id: 'a4', site: 'alley', title: '모닥불', text: '불로 물건 8개를 태워라.', kind: 'fireBreaks', target: 8, reward: { star: 6, coins: 150 } },
  { id: 'd1', site: 'docks', title: '번쩍번쩍', text: '스파크 한 줄기로 4개를 때려라.', kind: 'sparkChain', target: 4, reward: { curio: 'coil' } },
  { id: 'd2', site: 'docks', title: '금고털이', text: '금고 3개를 열어라.', kind: 'breakIds', ids: ['safe'], target: 3, reward: { star: 10 } },
  { id: 'd3', site: 'docks', title: '끌어당겨', text: '자석으로 한 번에 금속 6개를 끌어와라.', kind: 'magnetPull', target: 6, reward: { coins: 3000 } },
  { id: 'd4', site: 'docks', title: '큰 파도', text: '연쇄 20을 만들어라.', kind: 'combo', target: 20, reward: { curio: 'lens' } },
  { id: 'g1', site: 'greenhouse', title: '유리 폭포', text: '타격 한 번이 이끈 반응으로 유리 8개를 깨라.', kind: 'oneOriginMat', mat: 'glass', target: 8, reward: { curio: 'dewdrop' } },
  { id: 'g2', site: 'greenhouse', title: '종소리', text: '유리 종 5개를 깨라.', kind: 'breakIds', ids: ['belljar'], target: 5, reward: { star: 25 } },
  { id: 'g3', site: 'greenhouse', title: '공명', text: '공명으로 유리 30개를 깨라.', kind: 'resonanceBreaks', target: 30, reward: { coins: 60000 } },
  { id: 'g4', site: 'greenhouse', title: '만개', text: '연쇄 35를 만들어라.', kind: 'combo', target: 35, reward: { curio: 'butterfly' } },
  { id: 't1', site: 'attic', title: '째깍째깍', text: '타격 한 번이 이끈 반응으로 폭발 4번.', kind: 'blastChain', target: 4, reward: { curio: 'cuckoofeather' } },
  { id: 't2', site: 'attic', title: '대청소', text: '12개 이상 실린 수레를 하나도 남김없이 비워라.', kind: 'clearCart', target: 12, reward: { star: 60 } },
  { id: 't3', site: 'attic', title: '뻐꾸기 합창', text: '뻐꾸기 시계 6개를 터뜨려라.', kind: 'breakIds', ids: ['cuckoo'], target: 6, reward: { coins: 500000 } },
  { id: 't4', site: 'attic', title: '대연쇄', text: '연쇄 60을 만들어라.', kind: 'combo', target: 60, reward: { curio: 'pocketwatch' } },
  { id: 'c1', site: 'crater', title: '별똥 사냥', text: '작은 운석 3개를 부숴라.', kind: 'breakIds', ids: ['meteor'], target: 3, reward: { curio: 'stardust' } },
  { id: 'c2', site: 'crater', title: '별의 심장', text: '별 받침대를 밝히고 별의 심장을 깨워라.', kind: 'heart', target: 1, reward: {} },
  { id: 'p1', site: 'post', title: '고물왕', text: '연쇄 120을 만들어라.', kind: 'combo', target: 120, reward: { curio: 'crown' } },
  { id: 'p2', site: 'post', title: '별똥비', text: '별 낙하지에서 운석 20개를 부숴라.', kind: 'breakIds', ids: ['meteor'], target: 20, reward: { curio: 'endless' } },
];
export const REQUEST = Object.fromEntries(REQUESTS.map((r) => [r.id, r])) as Record<string, RequestDef>;

export const CONSTELLATIONS: ConstellationDef[] = [
  { id: 'glass', name: '유리잔자리', desc: '어디서나 유리가 3배. 파편 +1, 대신 타격 -1.', apply: (m) => ((m.poolBias.glass = 3), (m.shardBonus += 1), (m.strikes -= 1)) },
  { id: 'iron', name: '닻자리', desc: '어디서나 금속이 3배. 스파크 도약 +1, 대신 도구 위력 -1.', apply: (m) => ((m.poolBias.metal = 3), (m.sparkJumps += 1), (m.power -= 1)) },
  { id: 'clock', name: '태엽자리', desc: '어디서나 태엽이 섞인다. 연쇄 배율 +0.03, 대신 처분가 0.', apply: (m) => ((m.poolBias.clock = 4), (m.comboStep += 0.03), (m.salvage = 0)) },
  { id: 'hands', name: '빈손자리', desc: '손 타격은 수레당 1번. 쿵쿵이 1대와 소켓 2개로 시작한다.', apply: (m) => (m.strikes = 1) },
];
export const CONSTELLATION = Object.fromEntries(CONSTELLATIONS.map((c) => [c.id, c])) as Record<string, ConstellationDef>;
