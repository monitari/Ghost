import { canvas, playSound } from './main.js';
import { player, updatePlayerAngle } from './player.js';
import { flashlight } from './flashlight.js';

export const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  e: false,
  h: false,
};

export let flashlightOn = true;
export let debugMode = false;
export let flashlightDisabledUntil = 0;
export let flashlightWasOnBeforeDisable = true;

export function initializeInput() {
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  canvas.addEventListener("mousemove", handleMouseMove);
}

function handleKeyDown(e) {
  if (!window.gameRunning) return;
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'e') handleFlashlightToggle();
  if (e.key.toLowerCase() === 'h') toggleDebugMode();
}

function handleKeyUp(e) {
  if (!window.gameRunning) return;
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
}

function handleMouseMove(e) {
  if (!window.gameRunning) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  updatePlayerAngle(mouseX, mouseY);
  if (flashlightOn) updateFlashlightAngle(mouseX, mouseY);
}

function handleFlashlightToggle() {
  if (Date.now() > flashlightDisabledUntil && !player.debuffs.some(debuff => debuff.type === 'flashlightDisabled')) {
    setFlashlightOn(!flashlightOn);
    playSound('sounds/player/light-switch.mp3', 1000, 1000, 0, 1.0);
    console.log('전등 상태 토글');
  } else {
    playSound('sounds/player/light-switch-fail.mp3', 1000, 1000, 0, 1.0);
    console.log('전등이 켜지지 않음');
  }
  dispatchStatsUpdatedEvent();
}

function toggleDebugMode() {
  debugMode = !debugMode;
  console.log(`디버그 모드: ${debugMode}`);
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

export function disableFlashlight(duration) {
  flashlightWasOnBeforeDisable = flashlightOn;
  flashlightOn = false;
  const debuff = {
    type: 'flashlightDisabled',
    expiresAt: Date.now() + duration
  };
  player.addDebuff(debuff);
  dispatchStatsUpdatedEvent();
}

export function immobilizePlayer(duration) {
  const debuff = {
    type: 'immobilized',
    expiresAt: Date.now() + duration
  };
  player.addDebuff(debuff);
  dispatchStatsUpdatedEvent();
}

export function hideWarning(duration) {
  const debuff = {
    type: 'warningHidden',
    expiresAt: Date.now() + duration
  };
  player.addDebuff(debuff);
  dispatchStatsUpdatedEvent();
}

export function setFlashlightOn(value) {
  const hasFlashlightDebuff = player.debuffs.some(debuff => debuff.type === 'flashlightDisabled' && Date.now() <= debuff.expiresAt);
  if (hasFlashlightDebuff) {
    flashlightOn = false;
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
}