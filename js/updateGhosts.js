import { maze, mazeOffsetX, mazeOffsetY, canvas } from './main.js';
import { player } from './player.js';
import { flashlightSegments, flashlight } from './flashlight.js';
import { ghosts, createGhosts, ghostCount } from './createGhosts.js';
import { flashlightOn } from './input.js'; // 추가된 import

export function updateGhosts() {
  const currentTime = Date.now();
  ghosts.forEach((ghost, index) => {
    if (ghost.type === 'follower') {
      const playerX = -mazeOffsetX + canvas.width / 2;
      const playerY = -mazeOffsetY + canvas.height / 2;
      const angle = Math.atan2(playerY - ghost.y, playerX - ghost.x);
      ghost.dx = Math.cos(angle) * ghost.speed;
      ghost.dy = Math.sin(angle) * ghost.speed;
    } else if (ghost.type === 'random') {
      // 랜덤 이동
    } else if (ghost.type === 'teleporter') {
      if (currentTime - ghost.lastTeleport > ghost.teleportInterval) {
        ghost.fading = true;
        ghost.lastTeleport = currentTime;
      }
      if (ghost.fading) {
        ghost.opacity -= 0.05;
        if (ghost.opacity <= 0) {
          let newX, newY;
          const playerX = -mazeOffsetX + canvas.width / 2;
          const playerY = -mazeOffsetY + canvas.height / 2;
          do {
            newX = Math.random() * maze.width - maze.width / 2;
            newY = Math.random() * maze.height - maze.height / 2;
          } while (
            newX > playerX - 75 && newX < playerX + 75 &&
            newY > playerY - 75 && newY < playerY + 75
          );
          ghost.x = newX;
          ghost.y = newY;
          ghost.opacity = 0;
          ghost.fading = false;
        }
      } else if (ghost.opacity < 1) {
        ghost.opacity += 0.05;
      }
    } else if (ghost.type === 'weepingAngel') {
      const playerX = -mazeOffsetX + canvas.width / 2;
      const playerY = -mazeOffsetY + canvas.height / 2;
      const dx = playerX - ghost.x;
      const dy = playerY - ghost.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 500 && !player.isLookingAt(ghost)) { // 플레이어가 유령을 바라보지 않으면 이동 (시야각 45도)
        const angle = Math.atan2(dy, dx);
        ghost.dx = Math.cos(angle) * ghost.speed;
        ghost.dy = Math.sin(angle) * ghost.speed;
      } else {
        ghost.dx = 0;
        ghost.dy = 0;
      }
    }

    ghost.x += ghost.dx;
    ghost.y += ghost.dy;

    // 미로 벽 통과 가능
    if (ghost.x < -maze.width / 2) ghost.x = maze.width / 2;
    if (ghost.x > maze.width / 2) ghost.x = -maze.width / 2;
    if (ghost.y < -maze.height / 2) ghost.y = maze.height / 2;
    if (ghost.y > maze.height / 2) ghost.y = -maze.height / 2;

    // 광선 피격 판정 추가
    if (flashlightOn) { // 플래시라이트 상태 확인
      if (isGhostHitByRay(ghost) && isWithinEffectiveRange(ghost)) {
        ghost.health -= 1; // 필요에 따라 데미지 조정
        ghost.size += 0.1;
        if (ghost.health <= 0) {
          ghosts.splice(index, 1);
        }
      }
    }
  });

  // 유령 개체수 유지
  while (ghosts.length < ghostCount) {
    createGhosts(1);
  }
}

function isGhostHitByRay(ghost) {
  const ghostWorldX = ghost.x + mazeOffsetX;
  const ghostWorldY = ghost.y + mazeOffsetY;

  // 유령이 플래시라이트 범위 내에 있는지 검사
  for (const segment of flashlightSegments) {
    const dx = ghostWorldX - segment.startX;
    const dy = ghostWorldY - segment.startY;
    const segmentLength = Math.sqrt(
      (segment.endX - segment.startX) ** 2 + 
      (segment.endY - segment.startY) ** 2
    );
    
    // 광선 방향 벡터
    const rayDirX = (segment.endX - segment.startX) / segmentLength;
    const rayDirY = (segment.endY - segment.startY) / segmentLength;

    // 유령까지의 투영 거리
    const projLength = dx * rayDirX + dy * rayDirY;
    
    if (projLength < 0 || projLength > segmentLength) continue;

    // 광선에서 유령까지의 수직 거리
    const perpDist = Math.abs(dx * rayDirY - dy * rayDirX);
    
    if (perpDist < ghost.size) {
      return true;
    }
  }
  return false;
}

function isWithinEffectiveRange(ghost) {
  const dx = ghost.x - player.x;
  const dy = ghost.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < flashlight.maxDistance * 0.4; // 유령을 피격할 수 있는 최대 거리(플래시라이트의 40%)
}
