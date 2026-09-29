// 표현 설정. 게임 규칙·정산에는 영향을 주지 않는다(속도는 같은 고정 스텝을 더 자주 돌릴 뿐).
export interface Settings {
  master: number;
  sfx: number;
  music: number;
  shake: number; // 0~1
  flash: boolean;
  reducedMotion: boolean;
  speed: number; // 1, 1.5, 2, 3
  popups: boolean;
}

const KEY = 'junklight.settings.v1';
export const settings: Settings = {
  master: 0.8,
  sfx: 0.8,
  music: 0.5,
  shake: 0.6,
  flash: true,
  reducedMotion: false,
  speed: 1,
  popups: true,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch {
    /* 무시 */
  }
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && !localStorage.getItem(KEY)) {
    settings.reducedMotion = true;
    settings.shake = 0;
  }
}
export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* 무시 */
  }
}
export const shakeScale = () => (settings.reducedMotion ? 0 : settings.shake);
export const particleScale = () => (settings.reducedMotion ? 0.35 : 1);
