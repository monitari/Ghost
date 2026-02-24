/**
 * audio.js — 오디오 관리 모듈
 *
 * 효과음 프리로드, 재생(페이드아웃 지원), 걷기 루프 사운드를 관리한다.
 * 순환 의존성 없이 독립적으로 동작한다.
 */

// ═══════════════════════════════════════
//  내부 상태
// ═══════════════════════════════════════
const preloadedSounds = {};   // src → Audio 캐시
let walkSound = null;         // 걷기 루프 인스턴스

// ═══════════════════════════════════════
//  프리로드
// ═══════════════════════════════════════
/**
 * 단일 사운드 파일을 미리 로드한다.
 * @param {string} src      - 파일 경로
 * @param {number} timeout  - 로드 타임아웃(ms)
 * @returns {Promise<Audio|null>}
 */
export function preloadSound(src, timeout = 3000) {
  return new Promise((resolve) => {
    const sound = new Audio(src);

    const timeoutId = setTimeout(() => {
      console.warn(`사운드 로드 타임아웃: ${src}`);
      resolve(null);
    }, timeout);

    sound.addEventListener('canplaythrough', () => {
      clearTimeout(timeoutId);
      preloadedSounds[src] = sound;
      resolve(sound);
    }, { once: true });

    sound.addEventListener('error', (e) => {
      clearTimeout(timeoutId);
      console.warn(`사운드 로드 실패: ${src}`, e);
      resolve(null);
    }, { once: true });

    sound.load();
  });
}

/** 게임에 사용되는 주요 사운드를 일괄 프리로드한다. */
export function preloadAllSounds() {
  const soundFiles = [
    'sounds/player/walk.mp3',
    'sounds/effect/hit.mp3',
    'sounds/effect/battery_discharge.mp3',
    'sounds/player/player-hit-long.mp3',
    'sounds/player/player-hit-short.mp3',
    'sounds/player/light-switch.mp3',
    'sounds/player/light-switch-fail.mp3',
    'sounds/effect/recharge.mp3',
  ];
  return Promise.all(soundFiles.map(src => preloadSound(src)));
}

// ═══════════════════════════════════════
//  효과음 재생
// ═══════════════════════════════════════
/**
 * 효과음을 재생한다. 프리로드된 사운드가 있으면 복제하여 사용한다.
 * @param {string} src             - 파일 경로
 * @param {number} duration        - 재생 지속 시간(ms), 이후 페이드아웃
 * @param {number} fadeOutDuration - 페이드아웃 시간(ms)
 * @param {number} startTime      - 시작 오프셋(초)
 * @param {number} volume         - 볼륨 (0.0 – 1.0)
 */
export function playSound(src, duration = 1000, fadeOutDuration = 500, startTime = 0, volume = 1.0) {
  const sound = preloadedSounds[src]
    ? preloadedSounds[src].cloneNode()
    : new Audio(src);

  sound.volume      = volume;
  sound.currentTime = startTime;
  sound.play().catch(() => {});

  if (duration > 0) {
    setTimeout(() => {
      const step = sound.volume / (fadeOutDuration / 50);
      const fade = setInterval(() => {
        if (sound.volume > step) {
          sound.volume -= step;
        } else {
          sound.volume = 0;
          sound.pause();
          clearInterval(fade);
        }
      }, 50);
    }, duration);
  }
}

// ═══════════════════════════════════════
//  걷기 사운드 (루프)
// ═══════════════════════════════════════
/** 걷기 사운드를 시작한다 (이미 재생 중이면 무시). */
export function playWalkSound() {
  if (!walkSound) {
    walkSound = new Audio('sounds/player/walk.mp3');
    walkSound.loop = true;
  }
  if (walkSound.paused) {
    walkSound.play().catch(error => {
      if (error.name !== 'AbortError') console.error('walkSound.play() 오류:', error);
    });
  }
}

/** 걷기 사운드를 정지하고 처음으로 되감는다. */
export function stopWalkSound() {
  if (walkSound && !walkSound.paused) {
    walkSound.pause();
    walkSound.currentTime = 0;
  }
}
