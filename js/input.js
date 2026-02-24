/**
 * input.js — 입력·배터리·디버프 관리 모듈
 *
 * PC 키보드/마우스, 모바일 조이스틱/터치 입력을 처리하고
 * 손전등 토글, 배터리 소모/충전, 디버프 부여 기능을 제공한다.
 */

import { canvas } from './config.js';
import { playSound } from './audio.js';
import { player, updatePlayerAngle } from './player.js';
import { flashlight } from './flashlight.js';
import { isGameRunning, getDeltaTime } from './gameState.js';

// ═══════════════════════════════════════
//  키보드 상태
// ═══════════════════════════════════════
export const keys = {
  w: false, a: false, s: false, d: false,
  e: false, h: false,
};

// ═══════════════════════════════════════
//  손전등 상태
// ═══════════════════════════════════════
export let flashlightOn = true;
export let debugMode    = false;
export let flashlightDisabledUntil   = 0;
export let flashlightWasOnBeforeDisable = true;

// ═══════════════════════════════════════
//  배터리 시스템
// ═══════════════════════════════════════
export const battery = {
  current:              200,    // 현재 배터리 (0 – max)
  max:                  200,    // 최대 용량
  drainRate:            0.07,   // 초당 소모율 (점등 시)
  rechargeRate:         0.05,   // 초당 충전율 (소등 시)
  minRechargeThreshold: 30,     // 방전 → 재사용 최소 충전량
  isDepleted:           false,  // 배터리 방전 상태
  lastUpdate:           Date.now(),
  _wasDepletedNotified: false,
};

// ═══════════════════════════════════════
//  배터리 업데이트 (매 프레임)
// ═══════════════════════════════════════
/**
 * 손전등 ON → 배터리 소모 (누전 디버프 시 3× 가속)
 * 손전등 OFF → 배터리 충전 (누전 디버프 시 충전 불가)
 */
export function updateBattery() {
  const deltaTime = getDeltaTime();
  battery.lastUpdate = Date.now();

  if (flashlightOn && !battery.isDepleted) {
    // ── 소모 ──
    const hasDrain = player.debuffs.some(
      d => d.type === 'batteryDrain' && Date.now() <= d.expiresAt);
    const drainMultiplier = hasDrain ? 3.0 : 1.0;

    battery.current -= battery.drainRate * drainMultiplier * deltaTime * 60;

    if (battery.current <= 0) {
      battery.current = 0;
      battery.isDepleted = true;
      flashlightOn = false;
      playSound('sounds/effect/battery_discharge.mp3', 2000, 500, 0, 1.0);
      playSound('sounds/player/light-switch-fail.mp3', 800, 300, 0, 0.5);
      battery._wasDepletedNotified = true;
      updateFlashlightButtonState();
    }
  } else if (!flashlightOn) {
    // ── 충전 (누전 중 충전 불가) ──
    const hasDrainOff = player.debuffs.some(
      d => d.type === 'batteryDrain' && Date.now() <= d.expiresAt);
    if (hasDrainOff) return;

    battery.current += battery.rechargeRate * deltaTime * 60;
    if (battery.current >= battery.max) battery.current = battery.max;

    if (battery.isDepleted && battery.current >= battery.minRechargeThreshold) {
      battery.isDepleted = false;
      battery._wasDepletedNotified = false;
    }
  }
}

/** 아이템으로 배터리를 amount 만큼 즉시 충전한다. */
export function rechargeBattery(amount) {
  battery.current = Math.min(battery.current + amount, battery.max);
  if (battery.current >= battery.minRechargeThreshold) {
    battery.isDepleted = false;
  }
}

/** 배터리 잔량을 0 – 100 %로 반환한다. */
export function getBatteryPercent() {
  return Math.round((battery.current / battery.max) * 100);
}

// ═══════════════════════════════════════
//  모바일 감지
// ═══════════════════════════════════════
/**
 * 터치스크린 + 작은 화면/호버 불가 조합으로 모바일을 판별한다.
 * PC 터치스크린 오감지를 방지하기 위해 단순 ontouchstart 만으론 판단하지 않는다.
 */
let _isMobileCache = null;
export function isMobile() {
  if (_isMobileCache !== null) return _isMobileCache;
  const hasTouchScreen  = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isSmallScreen   = window.innerWidth <= 1024;
  const hasCoarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  _isMobileCache = hasTouchScreen && (isSmallScreen || hasCoarsePointer);
  return _isMobileCache;
}

// ═══════════════════════════════════════
//  조이스틱 상태
// ═══════════════════════════════════════
let joystickActive  = false;
let joystickTouchId = null;
let joystickBaseX   = 0;
let joystickBaseY   = 0;
let joystickDx      = 0;
let joystickDy      = 0;

// 에임 터치 상태
let aimTouchId = null;

// ═══════════════════════════════════════
//  입력 초기화
// ═══════════════════════════════════════
export function initializeInput() {
  // PC 입력
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup",   handleKeyUp);
  canvas.addEventListener("mousemove", handleMouseMove);

  // 모바일 터치 입력
  if (isMobile()) initMobileControls();
}

// ═══════════════════════════════════════
//  모바일 컨트롤 초기화
// ═══════════════════════════════════════
function initMobileControls() {
  const joystickArea = document.getElementById('joystick-area');
  const btnFlashlight = document.getElementById('btn-flashlight');

  if (joystickArea) {
    joystickArea.addEventListener('touchstart', handleJoystickStart, { passive: false });
    joystickArea.addEventListener('touchmove', handleJoystickMove, { passive: false });
    joystickArea.addEventListener('touchend', handleJoystickEnd, { passive: false });
    joystickArea.addEventListener('touchcancel', handleJoystickEnd, { passive: false });
  }

  // 손전등 버튼
  if (btnFlashlight) {
    btnFlashlight.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleFlashlightToggle();
      updateFlashlightButtonState();
    }, { passive: false });
  }

  // 캔버스에서 터치로 에임 조절
  canvas.addEventListener('touchstart', handleAimTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleAimTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleAimTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', handleAimTouchEnd, { passive: false });
}

// ═══════════════════════════════════════
//  조이스틱 핸들러
// ═══════════════════════════════════════
function handleJoystickStart(e) {
  e.preventDefault();
  if (!isGameRunning()) return;
  const touch = e.changedTouches[0];
  joystickTouchId = touch.identifier;
  joystickActive = true;

  const area = document.getElementById('joystick-area');
  const rect = area.getBoundingClientRect();
  joystickBaseX = rect.left + rect.width / 2;
  joystickBaseY = rect.top + rect.height / 2;
  
  updateJoystickPosition(touch.clientX, touch.clientY);
}

function handleJoystickMove(e) {
  e.preventDefault();
  if (!joystickActive) return;
  for (const touch of e.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      updateJoystickPosition(touch.clientX, touch.clientY);
      break;
    }
  }
}

function handleJoystickEnd(e) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === joystickTouchId) {
      joystickActive = false;
      joystickTouchId = null;
      joystickDx = 0;
      joystickDy = 0;
      keys.w = false;
      keys.s = false;
      keys.a = false;
      keys.d = false;
      
      // 조이스틱 썸 위치 리셋
      const thumb = document.getElementById('joystick-thumb');
      if (thumb) {
        thumb.style.transform = 'translate(-50%, -50%)';
        thumb.style.left = '50%';
        thumb.style.top = '50%';
      }
      break;
    }
  }
}

function updateJoystickPosition(touchX, touchY) {
  const maxRadius = 55; // 조이스틱 최대 이동 반경
  let dx = touchX - joystickBaseX;
  let dy = touchY - joystickBaseY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > maxRadius) {
    dx = (dx / distance) * maxRadius;
    dy = (dy / distance) * maxRadius;
  }

  joystickDx = dx / maxRadius; // -1 ~ 1 정규화
  joystickDy = dy / maxRadius;

  // 조이스틱 썸 시각적 이동
  const thumb = document.getElementById('joystick-thumb');
  if (thumb) {
    thumb.style.left = `calc(50% + ${dx}px)`;
    thumb.style.top = `calc(50% + ${dy}px)`;
  }

  // 데드존 적용 (0.15)
  const deadzone = 0.15;
  keys.w = joystickDy < -deadzone;
  keys.s = joystickDy > deadzone;
  keys.a = joystickDx < -deadzone;
  keys.d = joystickDx > deadzone;
}

/** 조이스틱 아날로그 값(-1 ~ 1)을 반환한다. main.js 이동 계산에서 사용. */
export function getJoystickValues() {
  if (!joystickActive) return { dx: 0, dy: 0 };
  const deadzone = 0.15;
  return {
    dx: Math.abs(joystickDx) > deadzone ? joystickDx : 0,
    dy: Math.abs(joystickDy) > deadzone ? joystickDy : 0,
  };
}

// ═══════════════════════════════════════
//  에임 터치 핸들러 (캔버스 터치 → 손전등 방향)
// ═══════════════════════════════════════
function handleAimTouchStart(e) {
  if (!isGameRunning()) return;
  // 조이스틱 영역이나 버튼 영역의 터치는 무시
  for (const touch of e.changedTouches) {
    if (isInUIArea(touch.clientX, touch.clientY)) continue;
    if (aimTouchId === null) {
      aimTouchId = touch.identifier;
      processAimTouch(touch.clientX, touch.clientY);
    }
  }
}

function handleAimTouchMove(e) {
  if (!isGameRunning()) return;
  for (const touch of e.changedTouches) {
    if (touch.identifier === aimTouchId) {
      processAimTouch(touch.clientX, touch.clientY);
      break;
    }
  }
}

function handleAimTouchEnd(e) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === aimTouchId) {
      aimTouchId = null;
      break;
    }
  }
}

function processAimTouch(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;
  updatePlayerAngle(mouseX, mouseY);
  if (flashlightOn) updateFlashlightAngle(mouseX, mouseY);
}

function isInUIArea(x, y) {
  // 조이스틱 영역 체크
  const joystickArea = document.getElementById('joystick-area');
  if (joystickArea) {
    const rect = joystickArea.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
  }
  // 버튼 영역 체크
  const buttonsArea = document.getElementById('mobile-buttons');
  if (buttonsArea) {
    const rect = buttonsArea.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
  }
  return false;
}

// ═══════════════════════════════════════
//  손전등 버튼 상태
// ═══════════════════════════════════════
/** 모바일 손전등 버튼의 active / disabled 클래스를 갱신한다. */
export function updateFlashlightButtonState() {
  const btn = document.getElementById('btn-flashlight');
  if (!btn) return;
  const hasDebuff = player.debuffs.some(debuff => debuff.type === 'flashlightDisabled');
  btn.classList.toggle('active', flashlightOn);
  btn.classList.toggle('disabled', hasDebuff);
}

function handleKeyDown(e) {
  if (!isGameRunning()) return;
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'e') handleFlashlightToggle();
  //if (e.key.toLowerCase() === 'h') toggleDebugMode();
}

function handleKeyUp(e) {
  if (!isGameRunning()) return;
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
}

function handleMouseMove(e) {
  if (!isGameRunning()) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  updatePlayerAngle(mouseX, mouseY);
  if (flashlightOn) updateFlashlightAngle(mouseX, mouseY);
}

function handleFlashlightToggle() {
  const hasDebuff = player.debuffs.some(debuff => debuff.type === 'flashlightDisabled');
  const canToggle = Date.now() > flashlightDisabledUntil && !hasDebuff && !battery.isDepleted;
  
  if (canToggle) {
    setFlashlightOn(!flashlightOn);
    playSound('sounds/player/light-switch.mp3', 1000, 1000, 0, 1.0);
  } else {
    playSound('sounds/player/light-switch-fail.mp3', 1000, 1000, 0, 1.0);
  }
  updateFlashlightButtonState();
  dispatchStatsUpdatedEvent();
}

function toggleDebugMode() {
  debugMode = !debugMode;
}

function updateFlashlightAngle(mouseX, mouseY) {
  const dx = mouseX - canvas.width / 2;
  const dy = mouseY - canvas.height / 2;
  flashlight.angle = Math.atan2(dy, dx);
}

function dispatchStatsUpdatedEvent() {
  const event = new Event('statsUpdated');
  window.dispatchEvent(event);
}

// ═══════════════════════════════════════
//  디버프 부여 함수
// ═══════════════════════════════════════

/** 손전등 사용 불가 디버프를 부여한다. */
export function disableFlashlight(duration) {
  flashlightWasOnBeforeDisable = flashlightOn;
  flashlightOn = false;
  const debuff = {
    type: 'flashlightDisabled',
    expiresAt: Date.now() + duration
  };
  player.addDebuff(debuff);
  updateFlashlightButtonState();
  dispatchStatsUpdatedEvent();
}

/** 이동 불가 디버프를 부여한다. */
export function immobilizePlayer(duration) {
  const debuff = {
    type: 'immobilized',
    expiresAt: Date.now() + duration
  };
  player.addDebuff(debuff);
  dispatchStatsUpdatedEvent();
}

/** 경고 표시 숨김 디버프를 부여한다. */
export function hideWarning(duration) {
  const debuff = {
    type: 'warningHidden',
    expiresAt: Date.now() + duration
  };
  player.addDebuff(debuff);
  dispatchStatsUpdatedEvent();
}

/** 혼란(방향 반전) 디버프를 부여한다. */
export function confusePlayer(duration) {
  const debuff = {
    type: 'confusion',
    expiresAt: Date.now() + duration
  };
  player.addDebuff(debuff);
  //playSound('sounds/effect/confuse.mp3', 1000, 500, 0, 0.8);
  dispatchStatsUpdatedEvent();
}

/** 배터리 누전 디버프를 부여한다. (소모 3×, 충전 불가) */
export function drainBattery(duration) {
  const debuff = {
    type: 'batteryDrain',
    expiresAt: Date.now() + duration
  };
  player.addDebuff(debuff);
  playSound('sounds/effect/battery_discharge.mp3', 500, 200, 0, 0.5);
  dispatchStatsUpdatedEvent();
}

// ═══════════════════════════════════════
//  손전등 상태 제어
// ═══════════════════════════════════════
/** 손전등 ON/OFF 를 설정한다. 디버프 활성 시 강제 OFF. */
export function setFlashlightOn(value) {
  const hasFlashlightDebuff = player.debuffs.some(debuff => debuff.type === 'flashlightDisabled' && Date.now() <= debuff.expiresAt);
  if (hasFlashlightDebuff) {
    flashlightOn = false;
    updateFlashlightButtonState();
    return;
  }
  flashlightOn = value;
  flashlightWasOnBeforeDisable = value;
  player.debuffs.forEach(debuff => {
    if (debuff.type === 'flashlightDisabled' && Date.now() > debuff.expiresAt) {
      player.removeDebuff(debuff.type);
      flashlightOn = flashlightWasOnBeforeDisable;
      dispatchStatsUpdatedEvent();
    }
  });
  updateFlashlightButtonState();
}