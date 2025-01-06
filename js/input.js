import { canvas } from './main.js';
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
export let flashlightDisabledUntil = 0; // flashlightDisabledUntil을 export
export let flashlightWasOnBeforeDisable = true; // 이전 전등 상태 저장 변수 추가

export function initializeInput() {
  document.addEventListener("keydown", (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (e.key === 'e' && Date.now() > flashlightDisabledUntil) {
      setFlashlightOn(!flashlightOn); // 전등 토글을 setFlashlightOn으로 변경
    }
    if (e.key === 'h') debugMode = !debugMode;
  });

  document.addEventListener("keyup", (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 플레이어 시선 각도 항상 업데이트
    updatePlayerAngle(mouseX, mouseY);
    
    if (flashlightOn) { // 플래시라이트가 켜져 있을 때만 조명 각도 업데이트
      const dx = mouseX - canvas.width / 2;
      const dy = mouseY - canvas.height / 2;
      flashlight.angle = Math.atan2(dy, dx);
    }
  });
}

export function disableFlashlight(duration) {
  flashlightWasOnBeforeDisable = flashlightOn; // 전등이 켜져 있었는지 저장
  flashlightOn = false;
  flashlightDisabledUntil = Date.now() + duration;
}

export function setFlashlightOn(value) {
  // 전등이 비활성화된 상태에서는 켤 수 없음
  if (Date.now() <= flashlightDisabledUntil) {
    return;
  }
  
  // 전등 상태 변경 가능
  flashlightOn = value;
  flashlightWasOnBeforeDisable = value;
}