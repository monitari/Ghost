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
export let flashlightDisabledUntil = 0; // flashlightDisabledUntil을 export
export let flashlightWasOnBeforeDisable = true; // 이전 전등 상태 저장 변수 추가

export function initializeInput() {
  console.log('입력 초기화 시작');
  document.addEventListener("keydown", (e) => {
    if (!window.gameRunning) return; // 게임이 시작되지 않았으면 무시
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (e.key === 'e' && Date.now() > flashlightDisabledUntil) {
      setFlashlightOn(!flashlightOn); // 전등 토글을 setFlashlightOn으로 변경
      playSound('sounds/player/light-switch.mp3', 1000, 1000, 0, 1.0); // 전등 효과음 추가
      console.log('전등 상태 토글');
      
      // 통계 업데이트
      const event = new Event('statsUpdated');
      window.dispatchEvent(event);
    }
    if (e.key === 'h') {
      debugMode = !debugMode;
      console.log(`디버그 모드: ${debugMode}`);
    }
  });

  document.addEventListener("keyup", (e) => {
    if (!window.gameRunning) return; // 게임이 시작되지 않았으면 무시
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!window.gameRunning) return; // 게임이 시작되지 않았으면 무시
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
  
  const debuff = {
    type: 'flashlightDisabled',
    expiresAt: Date.now() + duration
  };
  
  player.addDebuff(debuff); // 디버프를 배열에 추가
  
  // 통계 업데이트
  const event = new Event('statsUpdated');
  window.dispatchEvent(event);
}

// 플레이어를 immobilize 상태로 만드는 함수 추가
export function immobilizePlayer(duration) {
  const debuff = {
    type: 'immobilized',
    expiresAt: Date.now() + duration
  };
  player.addDebuff(debuff);
  
  // 통계 업데이트
  const event = new Event('statsUpdated');
  window.dispatchEvent(event);
}

export function setFlashlightOn(value) {
  // 활성화된 디버프가 있는지 확인
  const hasFlashlightDebuff = player.debuffs.some(debuff => debuff.type === 'flashlightDisabled' && Date.now() <= debuff.expiresAt);
  
  if (hasFlashlightDebuff) {
    flashlightOn = false;
    return;
  }
  
  // 전등 상태 변경 가능
  flashlightOn = value;
  flashlightWasOnBeforeDisable = value;
  
  // 디버프가 만료되었을 때 전등 자동 조절
  player.debuffs.forEach(debuff => {
    if (debuff.type === 'flashlightDisabled' && Date.now() > debuff.expiresAt) {
      player.removeDebuff(debuff.type);
      flashlightOn = flashlightWasOnBeforeDisable;
      
      // 통계 업데이트
      const event = new Event('statsUpdated');
      window.dispatchEvent(event);
    }
  });
}