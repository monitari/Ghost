import { canvas } from './main.js';
import { player, updatePlayerAngle } from './player.js';
import { flashlight } from './flashlight.js';

export const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  e: false,
};

export let flashlightOn = true;

export function initializeInput() {
  document.addEventListener("keydown", (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    if (e.key === 'e') {
      flashlightOn = !flashlightOn;
    }
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
