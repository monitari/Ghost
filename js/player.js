import { flashlight } from './flashlight.js';
import { canvas } from './main.js';
import { incrementDebuffCount, incrementHitCount } from './uistats.js';
import { ghosts, createGhosts } from './createGhosts.js';
import { playSound } from './main.js';
import { disableFlashlight, hideWarning, immobilizePlayer } from './input.js';

export const player = {
  x: 0,
  y: 0,
  size: 10,
  colliderSize: 10,
  angle: 0,
  debuffs: [], // debuff 속성을 배열로 변경
  isLookingAt(ghost) {
    const dx = ghost.x - this.x;
    const dy = ghost.y - this.y;
    const angleToGhost = Math.atan2(dy, dx);
    const angleDifference = Math.abs(this.angle - angleToGhost);
    return angleDifference < flashlight.fov;
  }
};

// 디버프 추가 함수 수정: 디버프 획득 시 횟수 증가
player.addDebuff = function(debuff) {
  this.debuffs.push(debuff);
  incrementDebuffCount(debuff.type); // 디버프 획득 횟수 증가
};

// 디버프 제거 함수
player.removeDebuff = function(debuffType) {
  this.debuffs = this.debuffs.filter(d => d.type !== debuffType);
};

export function initializePlayer() {
  player.x = 0;
  player.y = 0;
}

export function drawPlayer(ctx) {
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, player.size, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();
}

export function updatePlayerAngle(mouseX, mouseY) {
  const dx = mouseX - canvas.width / 2;
  const dy = mouseY - canvas.height / 2;
  player.angle = Math.atan2(dy, dx);
}

export function checkPlayerGhostCollision(flashColor, flashTime) {
  ghosts.forEach((ghost, index) => {
    const dxGhost = ghost.x - player.x;
    const dyGhost = player.y - ghost.y;
    const distance = Math.sqrt(dxGhost * dxGhost + dyGhost * dyGhost);
    if (distance < player.size + ghost.size) {
      flashColor = ghost.color;
      flashTime = 30;
      const ghostType = ghost.type;
      ghosts.splice(index, 1);
      createGhosts(1, ghostType);
      
      playSound('sounds/effect/hit.mp3', 1000, 500, 0, 1.0);
      if (ghost.type === 'charger' || ghost.type === 'shadow') 
        playSound('sounds/player/player-hit-long.mp3', 1000, 500, 0.8, 1.0);
      else playSound('sounds/player/player-hit-short.mp3', 1000, 500, 0.8, 1.0);

      if (ghost.type === 'charger') disableFlashlight(3000); // 3초간 전등 사용 불가
      if (ghost.type === 'earthBound') immobilizePlayer(3000); // 3초간 움직임 제한
      if (ghost.type === 'shadow') hideWarning(3000); // 3초간 경고 메시지 숨김
      incrementHitCount(ghostType); // 유령 타입별 닿은 횟수 증가
    }
  });
  return { flashColor, flashTime };
}