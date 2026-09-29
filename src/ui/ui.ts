// HTML 오버레이: HUD, 패널, 알림. 규칙은 Game 메서드로만 바꾼다.
import type { Bench } from '../core/bench';
import {
  CONSTELLATIONS,
  CURIO,
  CURIOS,
  HEART_PHASES,
  JUNK,
  LAMPS,
  MACHINE,
  MACHINES,
  MAT_NAME,
  MAT_RULE,
  RARITY_NAME,
  REQUEST,
  REQUESTS,
  SITE,
  SITES,
  TOOL,
  TOOLS,
  UPGRADES,
} from '../core/data';
import type { Game, GameEvent } from '../core/game';
import type { MachineKind, Material, SiteId, ToolKind } from '../core/types';
import { saveSettings, settings } from '../settings';
import { audio } from '../view/audio';
import { iconUrl } from '../view/icons';

type Panel = 'shop' | 'curios' | 'workshop' | 'requests' | 'map' | 'codex' | 'settings';

export function fmt(n: number): string {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('ko-KR');
  if (n < 1e8) return (n / 1e4).toFixed(n < 1e5 ? 2 : 1).replace(/\.?0+$/, '') + '만';
  if (n < 1e12) return (n / 1e8).toFixed(n < 1e9 ? 2 : 1).replace(/\.?0+$/, '') + '억';
  return (n / 1e12).toFixed(2).replace(/\.?0+$/, '') + '조';
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const icon = (key: string, cls = '') => `<img class="px ${cls}" src="${iconUrl(key)}" alt="" draggable="false">`;
const MAT_ICON: Record<Material, string> = { wood: 'j_crate', glass: 'j_bottle', metal: 'j_can', cloth: 'j_rag', clock: 'j_windup', star: 'j_starbit' };

export interface UIHooks {
  save(): void;
  reset(): void;
  newGamePlus(c: string | null): void;
  sceneRefresh(): void;
  endEndingFreeze(): void;
  exportSave(): string;
}

export class UI {
  private root: HTMLElement;
  g: Game;
  hooks: UIHooks;
  panel: Panel | null = null;
  private tab: Record<string, string> = { shop: 'upgrades', codex: 'junk' };
  private selSlot = 0;
  private selSocket = 0;
  private el: Record<string, HTMLElement> = {};
  private shownCoins = 0;
  private shownStar = 0;
  private combo = { n: 0, mult: 1, t: 0, active: false };
  private lampNudged = -1;
  private modal: HTMLElement | null = null;
  scale = 1;
  canvasRect = { left: 0, top: 0 };
  private coinPos = { x: 10, y: 8 };
  private starPos = { x: 60, y: 8 };
  private lastPanelRefresh = 0;
  private hintShown = new Set<string>();
  private seenReq = 0;

  constructor(root: HTMLElement, g: Game, hooks: UIHooks) {
    this.root = root;
    this.g = g;
    this.hooks = hooks;
    this.build();
    this.shownCoins = g.s.coins;
    this.shownStar = g.s.star;
  }

  // ---------- 골격 ----------
  private build() {
    this.root.innerHTML = `
      <div id="res">
        <div class="res coin" title="동전: 강화·도구·장치 구입에 쓴다">${icon('x_coin', 'ic')}<b id="coins">0</b></div>
        <div class="res star" title="별빛: 등불을 밝혀 새 지역을 연다">${icon('x_mote', 'ic')}<b id="star">0</b><span id="lampgoal"></span></div>
      </div>
      <nav id="menu">
        <button data-open="shop" id="btn-shop">상점</button>
        <button data-open="workshop" id="btn-workshop">작업대</button>
        <button data-open="curios" id="btn-curios">진열장</button>
        <button data-open="requests" id="btn-requests">의뢰<i id="reqdot"></i></button>
        <button data-open="map" id="btn-map">지도</button>
        <button data-open="codex">도감</button>
        <button data-open="settings" aria-label="설정">설정</button>
      </nav>
      <div id="combo" aria-hidden="true"></div>
      <div id="toasts"></div>
      <div id="bar">
        <button id="toolbtn" data-open="workshop" title="도구 바꾸기 (1~7)"></button>
        <div id="pips"></div>
        <div id="goal"></div>
        <button id="bell" title="Space">수레 부르기</button>
      </div>
      <div id="backdrop" class="hidden"></div>
      <section id="panel" class="hidden" role="dialog" aria-modal="true">
        <header><h2 id="ptitle"></h2><button id="pclose" aria-label="닫기">✕</button></header>
        <div id="pbody"></div>
      </section>
    `;
    const q = (id: string) => this.root.querySelector<HTMLElement>('#' + id)!;
    for (const id of ['coins', 'star', 'lampgoal', 'combo', 'toasts', 'toolbtn', 'pips', 'goal', 'bell', 'panel', 'pbody', 'ptitle', 'backdrop', 'reqdot']) this.el[id] = q(id);
    this.root.addEventListener('click', (ev) => this.onClick(ev));
    this.root.addEventListener('input', (ev) => this.onInput(ev));
    q('pclose').addEventListener('click', () => this.close());
    q('backdrop').addEventListener('click', () => this.close());
    this.el.bell.addEventListener('click', () => this.bell());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  layout(scale: number, left: number, top: number) {
    this.scale = scale;
    this.canvasRect = { left, top };
    const cr = this.root.getBoundingClientRect();
    const c = this.root.querySelector('.res.coin img')?.getBoundingClientRect();
    const s = this.root.querySelector('.res.star img')?.getBoundingClientRect();
    if (c) this.coinPos = { x: (c.left + c.width / 2 - cr.left) / scale, y: (c.top + c.height / 2 - cr.top) / scale };
    if (s) this.starPos = { x: (s.left + s.width / 2 - cr.left) / scale, y: (s.top + s.height / 2 - cr.top) / scale };
  }
  coinTarget() {
    return this.coinPos;
  }
  starTarget() {
    return this.starPos;
  }

  modalOpen() {
    return this.panel !== null || this.modal !== null;
  }

  // ---------- 입력 ----------
  bell() {
    audio.ensure();
    if (this.modalOpen()) return;
    const r = this.g.ringBell();
    if (r === 'none') audio.deny();
    else audio.click();
  }

  private onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'Escape') {
      if (this.modal && this.modal.dataset.closable === '1') this.closeModal();
      else if (this.panel) this.close();
      return;
    }
    if (this.modalOpen()) return;
    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      this.bell();
    } else if (/^[1-7]$/.test(e.key)) {
      const t = this.g.s.tools[Number(e.key) - 1];
      if (t) {
        this.g.setTool(t);
        audio.click();
      }
    }
  }

  private onInput(ev: Event) {
    const t = ev.target as HTMLInputElement;
    const k = t.dataset.set as keyof typeof settings | undefined;
    if (!k) return;
    if (t.type === 'checkbox') (settings as unknown as Record<string, boolean>)[k] = t.checked;
    else (settings as unknown as Record<string, number>)[k] = Number(t.value);
    audio.setVolumes(settings.master, settings.sfx, settings.music);
    saveSettings();
  }

  private onClick(ev: MouseEvent) {
    const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-open],[data-act]');
    if (!target) return;
    audio.ensure();
    if (target.dataset.open) {
      const p = target.dataset.open as Panel;
      if (this.panel === p) this.close();
      else this.open(p);
      audio.click();
      return;
    }
    const act = target.dataset.act!;
    const id = target.dataset.id ?? '';
    const g = this.g;
    let ok: boolean | undefined;
    switch (act) {
      case 'tab':
        this.tab[this.panel!] = id;
        ok = true;
        break;
      case 'buyUpgrade':
        ok = g.buyUpgrade(id);
        break;
      case 'buyTool':
        ok = g.buyTool(id as ToolKind);
        break;
      case 'setTool':
        ok = g.setTool(id as ToolKind);
        break;
      case 'buyMachine':
        ok = g.buyMachine(id as MachineKind);
        this.hooks.sceneRefresh();
        break;
      case 'buyPeddler':
        ok = g.buyPeddler(id);
        break;
      case 'reroll':
        ok = g.rerollPeddler();
        break;
      case 'selSlot':
        this.selSlot = Number(id);
        ok = true;
        break;
      case 'equip': {
        const cur = g.s.equipped.indexOf(id);
        if (cur >= 0) ok = g.equip(cur, null);
        else {
          let slot = g.s.equipped[this.selSlot] === null ? this.selSlot : g.s.equipped.indexOf(null);
          if (slot < 0) slot = this.selSlot;
          ok = g.equip(slot, id);
        }
        this.hooks.sceneRefresh();
        break;
      }
      case 'unequip':
        ok = g.equip(Number(id), null);
        this.hooks.sceneRefresh();
        break;
      case 'selSocket':
        this.selSocket = Number(id);
        ok = true;
        break;
      case 'place':
        ok = g.setSocket(this.selSocket, id as MachineKind);
        if (!ok) {
          // 다른 소켓에서 옮겨 오기
          const from = g.s.sockets.indexOf(id as MachineKind);
          if (from >= 0) {
            g.setSocket(from, null);
            ok = g.setSocket(this.selSocket, id as MachineKind);
          }
        }
        this.hooks.sceneRefresh();
        break;
      case 'unplace':
        ok = g.setSocket(Number(id), null);
        this.hooks.sceneRefresh();
        break;
      case 'lamp':
        ok = g.lightLamp();
        this.hooks.sceneRefresh();
        break;
      case 'site':
        ok = g.setSite(id as SiteId);
        this.hooks.sceneRefresh();
        if (ok) this.toast(`${SITE[id as SiteId].name}(으)로 수거지를 옮겼다. 다음 수레부터 적용.`);
        break;
      case 'togglePref': {
        const k = id as 'magpieOff' | 'eyeOff';
        g.s.prefs[k] = !g.s.prefs[k];
        if (k === 'magpieOff' && !g.s.prefs.magpieOff && !g.bench && g.lvl('magpie')) g.autoNext = 0.5;
        ok = true;
        break;
      }
      case 'speed':
        settings.speed = Number(id);
        saveSettings();
        ok = true;
        break;
      case 'save':
        this.hooks.save();
        this.toast('저장했다.');
        ok = true;
        break;
      case 'export': {
        const data = this.hooks.exportSave();
        void navigator.clipboard?.writeText(data).then(
          () => this.toast('저장 데이터를 클립보드에 복사했다.'),
          () => this.toast('복사하지 못했다.'),
        );
        ok = true;
        break;
      }
      case 'reset':
        this.confirm('정말 처음부터 시작할까? 모든 진행이 지워진다.', () => this.hooks.reset());
        ok = true;
        break;
      case 'ngplus':
        this.confirm(
          id ? `「${CONSTELLATIONS.find((c) => c.id === id)?.name}」의 밤을 시작할까? 골동품·도감·별자리 기록은 남고, 나머지는 새로 시작한다.` : '조건 없이 다음 밤을 시작할까? 골동품·도감·기록은 남는다.',
          () => this.hooks.newGamePlus(id || null),
        );
        ok = true;
        break;
      case 'closeModal':
        this.closeModal();
        ok = true;
        break;
      case 'endingContinue':
        this.closeModal();
        this.hooks.endEndingFreeze();
        ok = true;
        break;
      case 'endingNext':
        this.closeModal();
        this.hooks.endEndingFreeze();
        this.open('map');
        ok = true;
        break;
    }
    if (ok === false) audio.deny();
    else if (act.startsWith('buy') || act === 'lamp') audio.buy();
    else audio.click();
    if (this.panel) this.renderPanel();
  }

  // ---------- 패널 ----------
  open(p: Panel) {
    if (this.modal) return;
    this.panel = p;
    if (p === 'curios') {
      const e = this.g.s.equipped.indexOf(null);
      this.selSlot = e >= 0 ? e : 0;
    }
    if (p === 'workshop') {
      const e = this.g.s.sockets.indexOf(null);
      this.selSocket = e >= 0 ? e : 0;
    }
    this.el.panel.classList.remove('hidden');
    this.el.backdrop.classList.remove('hidden');
    this.renderPanel();
    this.el.panel.querySelector<HTMLElement>('#pclose')?.focus({ preventScroll: true });
  }
  close() {
    this.panel = null;
    this.el.panel.classList.add('hidden');
    this.el.backdrop.classList.add('hidden');
  }

  renderPanel() {
    const p = this.panel;
    if (!p) return;
    const titles: Record<Panel, string> = { shop: '상점', curios: '진열장 · 골동품', workshop: '작업대 · 도구와 장치', requests: '마을 의뢰', map: '지도 · 등불', codex: '도감', settings: '설정' };
    this.el.ptitle.textContent = titles[p];
    const body = this.el.pbody;
    const scroll = body.scrollTop;
    body.innerHTML = this[`render_${p}`]();
    body.scrollTop = scroll;
    this.lastPanelRefresh = performance.now();
  }

  private costBtn(act: string, id: string, cost: number, label = '', unit: 'coin' | 'star' = 'coin') {
    const have = unit === 'coin' ? this.g.s.coins : this.g.s.star;
    const dis = have < cost ? 'disabled' : '';
    return `<button class="cost ${unit}" data-act="${act}" data-id="${id}" data-cost="${cost}" data-unit="${unit}" ${dis}>${label ? label + ' ' : ''}${icon(unit === 'coin' ? 'x_coin' : 'x_mote', 'ic')}${fmt(cost)}</button>`;
  }

  private tabs(list: [string, string][], cur: string) {
    return `<div class="tabs">${list.map(([id, name]) => `<button data-act="tab" data-id="${id}" class="${cur === id ? 'on' : ''}">${name}</button>`).join('')}</div>`;
  }

  render_shop() {
    const g = this.g;
    const tab = this.tab.shop;
    let h = this.tabs(
      [
        ['upgrades', '강화'],
        ['tools', '도구'],
        ['machines', '장치'],
        ['peddler', '떠돌이 상인'],
      ],
      tab,
    );
    if (tab === 'upgrades') {
      h += '<ul class="list">';
      let hidden = 0;
      for (const u of UPGRADES) {
        if (!g.siteUnlocked(u.site)) {
          hidden++;
          continue;
        }
        if (g.s.constellation === 'hands' && u.id === 'strikes') continue;
        const lvl = g.lvl(u.id);
        const maxed = lvl >= u.max;
        h += `<li><div class="name">${u.name} <small>${maxed ? '완료' : `Lv.${lvl}/${u.max}`}</small></div><div class="desc">${esc(u.desc(lvl))}</div>
          <div class="act">${maxed ? '<span class="done">최대</span>' : this.costBtn('buyUpgrade', u.id, g.upgradeCost(u.id))}</div></li>`;
      }
      h += '</ul>';
      if (hidden) h += `<p class="note">새 지역에서 강화 ${hidden}종이 더 열린다.</p>`;
    } else if (tab === 'tools') {
      h += '<p class="note">도구는 언제든 바꿀 수 있다. 도구마다 두드리는 방식이 다르다. (작업대 패널 또는 숫자키 1~7)</p><ul class="list">';
      for (const t of TOOLS) {
        const own = g.s.tools.includes(t.id);
        if (!own && !g.siteUnlocked(t.site)) {
          h += `<li class="locked"><div class="ico">${icon('t_' + t.id)}</div><div class="name">???</div><div class="desc">${SITE[t.site].name}에서 판매</div></li>`;
          continue;
        }
        h += `<li><div class="ico">${icon('t_' + t.id)}</div><div class="name">${t.name}</div><div class="desc">${esc(t.desc)} <small>위력 ${t.dmg}+${g.mods.power} · 범위 ${t.radius}</small></div>
          <div class="act">${own ? (g.s.tool === t.id ? '<span class="done">사용 중</span>' : `<button data-act="setTool" data-id="${t.id}">들기</button>`) : this.costBtn('buyTool', t.id, t.cost)}</div></li>`;
      }
      h += '</ul>';
    } else if (tab === 'machines') {
      const sockets = g.socketsCount();
      h += `<p class="note">장치는 작업대 위 레일의 소켓에 걸린다. 수레마다 첫 타격이 떨어지면 자기 줄에서 따라 움직인다. 소켓 ${sockets}/5 (강화 탭에서 늘린다)</p><ul class="list">`;
      for (const m of MACHINES) {
        if (!g.siteUnlocked(m.site)) {
          h += `<li class="locked"><div class="ico">${icon('m_' + m.id)}</div><div class="name">???</div><div class="desc">${SITE[m.site].name}에서 판매</div></li>`;
          continue;
        }
        const own = g.s.machines[m.id] ?? 0;
        h += `<li><div class="ico">${icon('m_' + m.id)}</div><div class="name">${m.name} <small>보유 ${own}</small></div><div class="desc">${esc(m.desc)}</div>
          <div class="act">${this.costBtn('buyMachine', m.id, g.machineCost(m.id), own ? '하나 더' : '')}</div></li>`;
      }
      h += '</ul>';
    } else {
      const st = g.s.peddler.stock;
      h += `<p class="note">누더기 여우가 골동품을 판다. 물건은 수레 10대마다 바뀐다. (다음 교체: ${Math.max(0, g.s.peddler.refreshAt - g.s.cartSeq)}대 후)</p><ul class="list">`;
      if (!st.length) h += '<li><div class="desc">지금 열린 지역의 골동품을 모두 모았다.</div></li>';
      for (const id of st) {
        const c = CURIO[id];
        h += `<li><div class="ico">${icon('c_' + id)}</div><div class="name">${c.name} <small class="r-${c.rarity}">${RARITY_NAME[c.rarity]}</small></div><div class="desc">${esc(c.desc)}</div>
          <div class="act">${this.costBtn('buyPeddler', id, g.peddlerPrice(id))}</div></li>`;
      }
      h += `</ul><div class="row">${this.costBtn('reroll', '', g.rerollCost(), '물건 바꾸기')}</div>`;
    }
    return h;
  }

  render_curios() {
    const g = this.g;
    const s = g.s;
    let h = '<p class="note">골동품은 고물 속에서 발견하거나 상인에게 산다. 진열한 것만 효과가 있다. 언제든 바꿔 끼울 수 있다.</p><div class="slots">';
    s.equipped.forEach((id, i) => {
      h += `<button class="slot ${i === this.selSlot ? 'sel' : ''}" data-act="selSlot" data-id="${i}">${id ? icon('c_' + id) + `<span>${CURIO[id].name}</span>` : '<span class="empty">빈 칸</span>'}</button>`;
    });
    if (s.equipped.length < 6) h += `<div class="slot lockedslot"><span>칸 늘리기: 상점 › 강화</span></div>`;
    h += '</div><ul class="grid">';
    const sitesOpen = SITES.filter((x) => g.siteUnlocked(x.id)).map((x) => x.id as string);
    for (const c of CURIOS) {
      const own = s.curios.includes(c.id);
      if (!own) {
        if (c.site === 'legend' ? !s.ended : !sitesOpen.includes(c.site)) continue;
        h += `<li class="unk"><div class="ico">${icon('c_' + c.id, 'sil')}</div><div class="name">???</div><div class="desc">${c.site === 'legend' ? '엔딩 이후 어딘가에서' : SITE[c.site as SiteId].name}</div></li>`;
        continue;
      }
      const eq = s.equipped.indexOf(c.id);
      h += `<li class="${eq >= 0 ? 'on' : ''}" data-act="equip" data-id="${c.id}" title="클릭해서 ${eq >= 0 ? '내리기' : '진열하기'}">
        <div class="ico">${icon('c_' + c.id)}</div><div class="name">${c.name} <small class="r-${c.rarity}">${RARITY_NAME[c.rarity]}</small></div><div class="desc">${esc(c.desc)}</div>${eq >= 0 ? '<b class="tag">진열 중</b>' : ''}</li>`;
    }
    h += '</ul>';
    return h;
  }

  render_workshop() {
    const g = this.g;
    const s = g.s;
    let h = '<h3>손에 든 도구</h3><div class="tools">';
    s.tools.forEach((t, i) => {
      const d = TOOL[t];
      h += `<button class="toolpick ${s.tool === t ? 'sel' : ''}" data-act="setTool" data-id="${t}" title="${esc(d.desc)}">${icon('t_' + t)}<span>${i + 1}. ${d.name}</span></button>`;
    });
    h += `</div><p class="desc tooldesc">${esc(TOOL[s.tool].desc)}</p>`;
    const n = g.socketsCount();
    h += `<h3>레일 소켓 <small>${n}/5</small></h3>`;
    if (!n) h += `<p class="note">${g.siteUnlocked('docks') ? '상점 › 강화에서 작업대 소켓을 달면 장치를 걸 수 있다.' : '고철 부두에 가면 작업대 장치를 걸 수 있다.'}</p>`;
    else {
      h += '<div class="slots">';
      s.sockets.forEach((k, i) => {
        h += `<button class="slot ${i === this.selSocket ? 'sel' : ''}" data-act="selSocket" data-id="${i}">${k ? icon('m_' + k) + `<span>${MACHINE[k].name}</span>` : `<span class="empty">${i + 1}번 소켓</span>`}</button>`;
      });
      h += '</div><p class="note">소켓을 고른 뒤 아래 장치를 누르면 건다. 소켓 위치(열)가 장치가 일하는 줄이다.</p><ul class="list">';
      const owned = MACHINES.filter((m) => (s.machines[m.id] ?? 0) > 0);
      if (!owned.length) h += '<li><div class="desc">가진 장치가 없다. 상점 › 장치에서 산다.</div></li>';
      for (const m of owned) {
        const have = s.machines[m.id] ?? 0;
        const placed = g.placedCount(m.id);
        h += `<li><div class="ico">${icon('m_' + m.id)}</div><div class="name">${m.name} <small>${placed}/${have} 설치</small></div><div class="desc">${esc(m.desc)}</div>
          <div class="act"><button data-act="place" data-id="${m.id}">${this.selSocket + 1}번에 걸기</button></div></li>`;
      }
      h += '</ul>';
      if (s.sockets[this.selSocket]) h += `<div class="row"><button data-act="unplace" data-id="${this.selSocket}">${this.selSocket + 1}번 소켓 비우기</button></div>`;
    }
    if (g.lvl('magpie')) {
      h += `<h3>까치 조수</h3><div class="row"><button data-act="togglePref" data-id="magpieOff" class="${s.prefs.magpieOff ? '' : 'sel'}">수레 자동 부르기: ${s.prefs.magpieOff ? '꺼짐' : '켜짐'}</button>`;
      if (g.lvl('magpieEye')) h += `<button data-act="togglePref" data-id="eyeOff" class="${s.prefs.eyeOff ? '' : 'sel'}">남은 타격 맡기기: ${s.prefs.eyeOff ? '꺼짐' : '켜짐'}</button>`;
      h += '</div>';
    }
    return h;
  }

  render_requests() {
    const g = this.g;
    let h = '';
    const groups: (SiteId | 'post')[] = ['alley', 'docks', 'greenhouse', 'attic', 'crater', 'post'];
    for (const site of groups) {
      const list = REQUESTS.filter((r) => r.site === site && g.requestVisible(r));
      if (!list.length) continue;
      const who = site === 'post' ? '별이 돌아간 뒤' : `${SITE[site].name} · ${SITE[site].npc}`;
      h += `<h3>${who}</h3><ul class="list">`;
      for (const r of list) {
        const p = g.requestProgress(r.id);
        const done = p < 0;
        const rw = [r.reward.coins ? `${fmt(r.reward.coins)} 동전` : '', r.reward.star ? `별빛 ${r.reward.star}` : '', r.reward.curio ? `골동품 「${CURIO[r.reward.curio].name}」` : ''].filter(Boolean).join(' · ');
        const pct = done ? 100 : Math.min(100, (p / r.target) * 100);
        h += `<li class="${done ? 'done' : ''}"><div class="name">${r.title}</div><div class="desc">${esc(r.text)}${rw ? ` <small>보상: ${rw}</small>` : ''}</div>
          <div class="act">${done ? '<span class="done">완료</span>' : r.kind === 'heart' ? '' : `<div class="bar"><i style="width:${pct}%"></i></div><small>${Math.floor(p)}/${r.target}</small>`}</div></li>`;
      }
      h += '</ul>';
    }
    return h;
  }

  render_map() {
    const g = this.g;
    const s = g.s;
    let h = '<h3>수거지</h3><p class="note">수거지를 바꾸면 다음 수레부터 그곳의 고물이 온다. 예전 지역도 언제든 다시 갈 수 있다.</p><ul class="list">';
    for (const site of SITES) {
      const open = g.siteUnlocked(site.id);
      const cur = s.site === site.id;
      h += `<li class="${open ? '' : 'locked'} ${cur ? 'cur' : ''}"><div class="ico">${icon(site.id === 'alley' ? 'j_crate' : site.id === 'docks' ? 'j_safe' : site.id === 'greenhouse' ? 'j_belljar' : site.id === 'attic' ? 'j_cuckoo' : 'j_meteor', open ? '' : 'sil')}</div>
        <div class="name">${open ? site.name : '???'} ${open ? `<small>×${site.coinMult} 동전</small>` : ''}</div>
        <div class="desc">${open ? `${esc(site.blurb)} <small>${esc(site.rule)}</small>` : `${LAMPS[site.lampToUnlock - 1].name}을(를) 밝히면 열린다.`}</div>
        <div class="act">${open ? (cur ? '<span class="done">여기</span>' : `<button data-act="site" data-id="${site.id}">가기</button>`) : ''}</div></li>`;
    }
    h += '</ul><h3>마을 등불</h3><ul class="list">';
    LAMPS.forEach((l, i) => {
      const lit = i < s.lamps;
      const next = i === s.lamps;
      h += `<li class="${lit ? 'done' : next ? '' : 'locked'}"><div class="name">${l.name}</div><div class="desc">${lit ? esc(l.text) : next ? (l.unlocks ? `밝히면 ${SITE[l.unlocks].name}이(가) 열린다.` : '밝히면 별의 심장이 깨어난다.') : '…'}</div>
        <div class="act">${lit ? '<span class="done">켜짐</span>' : next ? this.costBtn('lamp', '', l.cost, '밝히기', 'star') : ''}</div></li>`;
    });
    h += '</ul>';
    if (s.heart) {
      const ph = HEART_PHASES[s.heart.phase];
      h += `<h3>별의 심장</h3><p class="desc">${ph.name}: ${ph.hint} 남은 빛 ${fmt(s.heart.hp)}/${fmt(s.heart.max)}. 망치로 직접 치면 거의 들지 않는다. 심장 곁에서 연쇄를 일으켜라.</p>`;
    }
    if (s.ended) {
      h += `<h3>다음 밤</h3><p class="note">골동품·도감·최고 기록·별자리 배지는 남기고 처음부터 다시 시작한다. 별자리는 규칙을 바꾼다. 지금처럼 자유 플레이를 계속해도 된다.</p><ul class="list">`;
      h += `<li><div class="name">맑은 밤</div><div class="desc">조건 없이 다시 시작. 모아 둔 골동품으로 초반이 빨라진다.</div><div class="act"><button data-act="ngplus" data-id="">시작</button></div></li>`;
      for (const c of CONSTELLATIONS)
        h += `<li><div class="name">${c.name} ${s.badges.includes(c.id) ? '<small class="r-legend">달성</small>' : ''}</div><div class="desc">${esc(c.desc)}</div><div class="act"><button data-act="ngplus" data-id="${c.id}">시작</button></div></li>`;
      h += '</ul>';
    }
    return h;
  }

  render_codex() {
    const g = this.g;
    const s = g.s;
    const tab = this.tab.codex;
    let h = this.tabs(
      [
        ['junk', `잡동사니 ${s.seen.length}/${Object.keys(JUNK).length - 1}`],
        ['curios', `골동품 ${s.curios.length}/${CURIOS.length}`],
        ['rules', '재질 규칙'],
        ['stats', '기록'],
      ],
      tab,
    );
    if (tab === 'rules') {
      h += '<ul class="list">';
      for (const m of Object.keys(MAT_NAME) as Material[]) h += `<li><div class="ico">${icon(MAT_ICON[m])}</div><div class="name">${MAT_NAME[m]}</div><div class="desc">${MAT_RULE[m]}</div></li>`;
      h += '</ul><p class="note">연쇄: 짧은 시간 안에 계속 부수면 연쇄가 이어지고 동전 배율이 오른다. 타격을 아껴 두었다가 연쇄가 끊기기 전에 치면 더 길게 이어진다.</p>';
    } else if (tab === 'junk') {
      h += '<ul class="grid">';
      for (const j of Object.values(JUNK)) {
        if (j.id === 'heart') continue;
        const seen = s.seen.includes(j.id);
        h += seen
          ? `<li><div class="ico">${icon('j_' + j.id)}</div><div class="name">${j.name} <small>${MAT_NAME[j.mat]}</small></div><div class="desc">${esc(j.desc)} <small>체력 ${j.hp}${j.star ? ` · 별빛 ${j.star}` : ''}${j.contents ? ' · 내용물' : ''}</small></div></li>`
          : `<li class="unk"><div class="ico">${icon('j_' + j.id, 'sil')}</div><div class="name">???</div></li>`;
      }
      h += '</ul>';
    } else if (tab === 'curios') {
      h += '<ul class="grid">';
      for (const c of CURIOS) {
        const own = s.curios.includes(c.id);
        h += own
          ? `<li><div class="ico">${icon('c_' + c.id)}</div><div class="name">${c.name} <small class="r-${c.rarity}">${RARITY_NAME[c.rarity]}</small></div><div class="desc">${esc(c.desc)}</div></li>`
          : `<li class="unk"><div class="ico">${icon('c_' + c.id, 'sil')}</div><div class="name">???</div><div class="desc">${c.site === 'legend' ? '전설' : SITE[c.site as SiteId].name}</div></li>`;
      }
      h += '</ul>';
    } else {
      const st = s.stats;
      const t = (sec: number) => `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분`;
      h += `<ul class="list stats">
        <li><div class="name">플레이 시간</div><div class="desc">${t(st.playTime)}</div></li>
        <li><div class="name">처리한 수레</div><div class="desc">${fmt(st.carts)}대</div></li>
        <li><div class="name">부순 물건</div><div class="desc">${fmt(st.breaks)}개 (반짝이 ${fmt(st.shinies)})</div></li>
        <li><div class="name">최고 연쇄</div><div class="desc">${st.bestCombo}</div></li>
        <li><div class="name">번 동전</div><div class="desc">${fmt(s.totalCoins)}</div></li>
        <li><div class="name">모은 별빛</div><div class="desc">${fmt(s.totalStar)}</div></li>
        <li><div class="name">밤</div><div class="desc">${s.ngPlus + 1}번째 밤${s.constellation ? ` · ${CONSTELLATIONS.find((c) => c.id === s.constellation)?.name}` : ''}</div></li>
        <li><div class="name">별자리 배지</div><div class="desc">${s.badges.length ? s.badges.map((b) => (b === 'first' ? '첫 별' : CONSTELLATIONS.find((c) => c.id === b)?.name)).join(', ') : '없음'}</div></li>
      </ul>`;
    }
    return h;
  }

  render_settings() {
    const sl = (k: keyof typeof settings, label: string, min = 0, max = 1, step = 0.05) =>
      `<label class="set"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${settings[k]}" data-set="${k}"></label>`;
    const ck = (k: keyof typeof settings, label: string) => `<label class="set"><span>${label}</span><input type="checkbox" ${settings[k] ? 'checked' : ''} data-set="${k}"></label>`;
    return `
      <h3>소리</h3>${sl('master', '전체 음량')}${sl('sfx', '효과음')}${sl('music', '음악')}
      <h3>화면</h3>${sl('shake', '화면 흔들림')}${ck('flash', '번쩍임 효과')}${ck('reducedMotion', '동작 줄이기 (흔들림·입자 감소)')}${ck('popups', '숫자 팝업')}
      <div class="set"><span>연출 속도 <small>(결과는 같고 빨리 진행)</small></span><div class="seg">${[1, 1.5, 2, 3].map((v) => `<button data-act="speed" data-id="${v}" class="${settings.speed === v ? 'sel' : ''}">${v}×</button>`).join('')}</div></div>
      <h3>조작</h3><p class="desc">작업대 클릭: 두드리기 · Space/Enter 또는 문 클릭: 수레 부르기·정산 · 1~7: 도구 · Esc: 닫기<br>진열장·창문·레일을 클릭하면 해당 패널이 열린다.</p>
      <h3>저장</h3><p class="note">진행은 자동 저장된다(브라우저 저장소).</p>
      <div class="row"><button data-act="save">지금 저장</button><button data-act="export">저장 데이터 복사</button><button data-act="reset" class="danger">처음부터</button></div>
      <p class="note">별고물 상회 · 모든 그림과 소리는 코드로 만들었다. 글꼴: 갈무리(Galmuri, SIL OFL 1.1).</p>`;
  }

  // ---------- 모달 ----------
  showModal(html: string, closable = true) {
    this.closeModal();
    this.close();
    const m = document.createElement('div');
    m.className = 'modal';
    m.dataset.closable = closable ? '1' : '0';
    m.innerHTML = `<div class="mbox">${html}</div>`;
    this.root.appendChild(m);
    this.modal = m;
    m.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }
  closeModal() {
    this.modal?.remove();
    this.modal = null;
  }
  private confirm(text: string, yes: () => void) {
    this.showModal(`<p>${esc(text)}</p><div class="row"><button data-act="closeModal">취소</button><button class="danger" id="yes">확인</button></div>`);
    this.modal!.querySelector('#yes')!.addEventListener('click', () => {
      this.closeModal();
      yes();
    });
  }

  intro() {
    this.showModal(
      `<h2>별고물 상회</h2>
      <p>별이 떨어진 밤, 마을의 등불이 모두 꺼졌다. 별은 산산이 부서져 버려진 고물 속에 섞여 들어갔다.</p>
      <p>너는 골목 끝 작은 고물상 <b>별고물 상회</b>의 새 주인. 고물을 두드려 부수면 동전과 <b>별빛</b>이 나온다. 별빛을 모아 등불을 다시 밝히자.</p>
      <p class="note">재질마다 부서질 때 반응이 다르다. 유리는 파편을, 금속은 스파크를, 태엽은 폭발을 일으킨다. 한 번의 타격이 여러 물건을 연달아 부수게 만들어 보자.</p>
      <div class="row"><button data-act="closeModal" class="big">문 열기</button></div>`,
    );
  }

  heartIntro() {
    this.showModal(
      `<h2>별의 심장</h2>
      <p>별 받침대가 빛나자, 언덕에서 커다란 빛덩이가 작업대로 굴러왔다. 떨어진 별의 심장이다.</p>
      <p>심장은 망치질로는 거의 깨지지 않는다. 심장 곁에서 일어나는 <b>파편·스파크·폭발·불·별빛 파동·공명</b>이 심장을 깨운다. 연쇄가 길수록 더 강하게 울린다.</p>
      <p class="note">심장은 세 겹이다. 겹마다 약한 반응이 다르니, 도구와 골동품·장치를 바꿔 가며 공략하자. 심장은 수레가 바뀌어도 그대로 남는다.</p>
      <div class="row"><button data-act="closeModal" class="big">해 보자</button></div>`,
    );
  }

  ending() {
    const s = this.g.s;
    const t = s.endedAt ?? s.stats.playTime;
    this.showModal(
      `<h2>별이 돌아갔다</h2>
      <p>심장이 마지막으로 울리자, 별빛이 작업대에서 떠올라 창밖으로 날아갔다. 하늘 한가운데에 별이 다시 걸렸다.</p>
      <p>마을의 모든 등불이 켜졌다. 골목에도, 부두에도, 온실과 시계탑에도.</p>
      <ul class="list stats">
        <li><div class="name">걸린 시간</div><div class="desc">${Math.floor(t / 60)}분</div></li>
        <li><div class="name">처리한 수레</div><div class="desc">${fmt(s.stats.carts)}대</div></li>
        <li><div class="name">최고 연쇄</div><div class="desc">${s.stats.bestCombo}</div></li>
        <li><div class="name">모은 골동품</div><div class="desc">${s.curios.length}/${CURIOS.length}</div></li>
      </ul>
      <p class="note">이제 별 낙하지에서 전설의 골동품이 나오고, 새 의뢰가 열렸다. 지도에서 「다음 밤」을 골라 별자리 규칙으로 다시 시작할 수도 있다.</p>
      <div class="row"><button data-act="endingContinue">계속 운영하기</button><button data-act="endingNext" class="big">다음 밤 살펴보기</button></div>`,
      false,
    );
  }

  // ---------- 알림 ----------
  toast(html: string, cls = '', ms = 3800) {
    const t = document.createElement('div');
    t.className = 'toast ' + cls;
    t.innerHTML = html;
    this.el.toasts.prepend(t);
    while (this.el.toasts.children.length > 5) this.el.toasts.lastElementChild?.remove();
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  }

  onEvent(e: GameEvent) {
    const g = this.g;
    switch (e.k) {
      case 'break':
        this.combo = { n: e.combo, mult: e.mult, t: 0, active: true };
        break;
      case 'comboEnd':
        this.combo.active = false;
        this.combo.t = 0;
        break;
      case 'freeStrike':
        this.toast('나비 표본: 타격 +1', 'gold', 2000);
        break;
      case 'cartDone': {
        const parts = [`${icon('x_coin', 'ic')}+${fmt(e.coins)}`];
        if (e.star) parts.push(`${icon('x_mote', 'ic')}+${e.star}`);
        if (e.best >= 3) parts.push(`연쇄 ${e.best}`);
        let extra = '';
        if (e.salvage > 0) extra = `<small>남은 고물 처분 +${fmt(e.salvage)}</small>`;
        if (e.cleared && e.breaks > 0) extra = e.sweep > 0 ? `<small>싹쓸이! 남은 타격 ${e.unused} × 12% = +${fmt(e.sweep)}</small>` : '<small>수레를 싹 비웠다!</small>';
        this.toast(`<b>정산</b> ${parts.join(' ')}${extra}`, 'sum', 3000);
        if (g.s.stats.carts === 1) this.hint('first-cart', '첫 수레 끝! 동전이 모이면 위쪽 「상점」에서 강화를 사자.');
        break;
      }
      case 'curio': {
        if (e.isNew) {
          const c = CURIO[e.id];
          const eq = g.s.equipped.includes(e.id);
          this.toast(`${icon('c_' + e.id, 'big')}<div><b>골동품 발견! 「${c.name}」</b><small>${esc(c.desc)}</small><small>${eq ? '진열장에 놓았다.' : '진열장이 가득 찼다. 진열장에서 바꿔 끼울 수 있다.'}</small></div>`, 'curio', 6000);
          this.nudge('btn-curios');
        } else this.toast(`이미 가진 골동품이다. 감정해서 ${fmt(e.bonus)} 동전을 받았다.`, '', 2500);
        break;
      }
      case 'request': {
        const r = REQUEST[e.id];
        const rw = [r.reward.coins ? `${fmt(r.reward.coins)} 동전` : '', r.reward.star ? `별빛 ${r.reward.star}` : '', r.reward.curio ? `「${CURIO[r.reward.curio].name}」` : ''].filter(Boolean).join(', ');
        this.toast(`<b>의뢰 완료: ${r.title}</b>${rw ? `<small>보상: ${rw}</small>` : ''}`, 'req', 4500);
        break;
      }
      case 'lamp': {
        const l = LAMPS[e.index];
        this.toast(`<b>${l.name}이(가) 켜졌다</b><small>${esc(l.text)}</small>`, 'gold', 6000);
        if (e.index === LAMPS.length - 1) setTimeout(() => this.heartIntro(), 600);
        break;
      }
      case 'site':
        this.toast(`<b>새 수거지: ${SITE[e.id].name}</b><small>${esc(SITE[e.id].rule)} 지도에서 오갈 수 있다.</small>`, 'gold', 6000);
        g.setSite(e.id);
        this.hooks.sceneRefresh();
        break;
      case 'heartPhase': {
        const ph = HEART_PHASES[e.phase];
        this.toast(`<b>심장의 겹이 벗겨졌다: ${ph.name}</b><small>${ph.hint}</small>`, 'gold', 7000);
        break;
      }
      case 'ending':
        setTimeout(() => this.ending(), 3300);
        break;
    }
    if (this.panel && (e.k === 'cartDone' || e.k === 'curio' || e.k === 'request' || e.k === 'lamp')) this.renderPanel();
  }

  private hint(key: string, text: string) {
    if (this.hintShown.has(key)) return;
    this.hintShown.add(key);
    this.toast(`<b>도움말</b><small>${esc(text)}</small>`, 'hint', 7000);
  }

  private nudge(id: string) {
    const b = this.root.querySelector('#' + id);
    if (!b) return;
    b.classList.remove('nudge');
    void (b as HTMLElement).offsetWidth;
    b.classList.add('nudge');
    setTimeout(() => b.classList.remove('nudge'), 4000);
  }

  // ---------- 매 프레임 ----------
  frame(dt: number) {
    const g = this.g;
    const s = g.s;
    // 숫자 굴리기
    this.shownCoins += (s.coins - this.shownCoins) * Math.min(1, dt * 10);
    if (Math.abs(s.coins - this.shownCoins) < 1) this.shownCoins = s.coins;
    this.shownStar += (s.star - this.shownStar) * Math.min(1, dt * 10);
    if (Math.abs(s.star - this.shownStar) < 0.5) this.shownStar = s.star;
    setText(this.el.coins, fmt(this.shownCoins));
    setText(this.el.star, fmt(this.shownStar));
    const l = g.nextLamp();
    setText(this.el.lampgoal, l ? `/${fmt(l.cost)}` : '');
    if (l && s.star >= l.cost && this.lampNudged !== s.lamps) {
      this.lampNudged = s.lamps;
      this.toast(`<b>별빛이 모였다!</b><small>지도(또는 창문)를 열어 「${l.name}」을(를) 밝히자.</small>`, 'gold', 7000);
      this.nudge('btn-map');
    }
    this.root.querySelector('#btn-map')?.classList.toggle('ready', !!l && s.star >= l.cost);
    // 의뢰 점: 아직 확인하지 않은 새 의뢰가 있으면 표시
    const visibleReq = REQUESTS.filter((r) => g.requestVisible(r)).length;
    if (this.panel === 'requests') this.seenReq = visibleReq;
    this.el.reqdot.classList.toggle('on', visibleReq > this.seenReq);

    // 도구 버튼
    const tk = `t_${s.tool}`;
    if (this.el.toolbtn.dataset.k !== tk) {
      this.el.toolbtn.dataset.k = tk;
      this.el.toolbtn.innerHTML = `${icon(tk)}<span>${TOOL[s.tool].name}</span>`;
    }
    // 타격 표시
    const b = g.bench;
    this.renderPips(b);
    // 종
    let label: string;
    let dis = false;
    let mode = '';
    if (!b) {
      if (g.autoNext >= 0) {
        label = '까치가 부르는 중…';
        mode = 'auto';
      } else {
        label = '수레 부르기';
        mode = 'call';
      }
    } else if (b.phase === 'dump') {
      label = '쏟는 중…';
      dis = true;
    } else if (g.canEndEarly()) {
      label = `정산하기`;
      mode = 'finish';
    } else {
      label = b.totalStrikes > 0 ? '반응 중…' : '정산 대기…';
      dis = true;
    }
    setText(this.el.bell, label);
    this.el.bell.toggleAttribute('disabled', dis);
    this.el.bell.dataset.mode = mode;
    this.el.bell.classList.toggle('nudge-soft', s.stats.carts === 0 && !b);
    // 목표
    let goal = g.nextGoal();
    if (b && b.phase === 'ready' && b.totalStrikes > 0 && s.stats.carts < 3) goal = '고물을 클릭해 두드리자. 원 안의 물건이 맞는다.';
    else if (b && b.phase === 'ready' && b.totalStrikes > 0 && g.canEndEarly() && s.stats.carts < 6) goal = `타격이 ${b.totalStrikes}번 남았다. 다 쓰거나 「정산하기」.`;
    setText(this.el.goal, goal);
    // 연쇄
    this.combo.t += dt;
    const show = this.combo.n >= 3 && (this.combo.active || this.combo.t < 0.9);
    const ce = this.el.combo;
    if (show) {
      const html = `연쇄 <b>${this.combo.n}</b> <span>×${this.combo.mult.toFixed(2)}</span>`;
      if (ce.dataset.h !== html) {
        ce.dataset.h = html;
        ce.innerHTML = html;
        ce.classList.remove('pop');
        void ce.offsetWidth;
        ce.classList.add('pop');
      }
      ce.classList.toggle('big', this.combo.n >= 20);
      ce.classList.toggle('huge', this.combo.n >= 50);
      ce.style.opacity = this.combo.active ? '1' : String(Math.max(0, 1 - this.combo.t / 0.9));
    } else ce.style.opacity = '0';
    // 패널 구매 가능 여부 갱신
    if (this.panel) {
      for (const btn of this.el.pbody.querySelectorAll<HTMLButtonElement>('button[data-cost]')) {
        const have = btn.dataset.unit === 'star' ? s.star : s.coins;
        btn.disabled = have < Number(btn.dataset.cost);
      }
      if (performance.now() - this.lastPanelRefresh > 4000 && this.panel === 'requests') this.renderPanel();
    }
    // 첫 도움말
    if (b && b.phase === 'ready' && s.stats.breaks === 0) this.hint('first-strike', '작업대 위의 고물을 클릭하면 망치로 두드린다. 수레마다 타격 횟수가 정해져 있다.');
    if (s.stats.carts >= 2 && s.coins >= 25 && !s.milestones.firstBuy) {
      this.hint('first-buy', '동전이 모였다. 상점에서 「도구 손질」이나 「큰 수레」를 사 보자.');
      this.root.querySelector('#btn-shop')?.classList.add('ready');
    } else if (s.milestones.firstBuy) this.root.querySelector('#btn-shop')?.classList.remove('ready');
    if (g.siteUnlocked('docks') && g.lvl('sockets') === 0 && s.coins >= 900) this.hint('sockets', '부두에서는 작업대 소켓을 달고 「쿵쿵이」 같은 장치를 걸 수 있다. 장치는 첫 타격에 맞춰 함께 움직인다.');
    if (s.site === 'crater' && s.heart && b && b.phase === 'ready') this.hint('heart', '별의 심장은 곁에서 일어나는 반응으로 깎인다. 심장 옆 물건을 노리자.');
  }

  private renderPips(b: Bench | null) {
    const g = this.g;
    const total = b ? Math.max(g.mods.strikes, b.strikesLeft) : g.mods.strikes;
    const left = b ? b.strikesLeft : total;
    const extra = b ? b.extraStrikes : 0;
    const key = `${total}|${left}|${extra}`;
    if (this.el.pips.dataset.k === key) return;
    this.el.pips.dataset.k = key;
    let h = '';
    for (let i = 0; i < total; i++) h += `<i class="${i < left ? 'on' : ''}"></i>`;
    for (let i = 0; i < extra; i++) h += '<i class="on gold"></i>';
    this.el.pips.innerHTML = h;
    this.el.pips.title = `남은 타격 ${left + extra}`;
  }
}

function setText(el: HTMLElement, t: string) {
  if (el.textContent !== t) el.textContent = t;
}
void MACHINE;
