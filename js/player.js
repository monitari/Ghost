import { canvas } from './main.js';
import { incrementDebuffCount } from './stats.js';

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
    return angleDifference < Math.PI / 4;
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
