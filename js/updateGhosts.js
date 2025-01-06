import { maze, mazeOffsetX, mazeOffsetY, canvas } from './main.js';
import { player } from './player.js';
import { flashlightSegments, flashlight, isGhostHitByRay } from './flashlight.js';
import { ghosts, createGhosts, ghostCount, originalSpeed, speedIncrement } from './createGhosts.js';
import { flashlightOn, disableFlashlight } from './input.js';

function handleGhostDeath(ghost, index) {
  const ghostType = ghost.type;
  createSpecialEffect(ghost.x, ghost.y, ghost.color);
  ghosts.splice(index, 1);
  createGhosts(1, ghostType);
}

function handleGhostFading(ghost) {
  // 기존 fade/appear 로직을 이 함수에 통합
  if (ghost.fading) {
    ghost.opacity -= 0.1; 
    if (ghost.opacity <= 0) {
      let newX, newY;
      const playerX = -mazeOffsetX + canvas.width / 2;
      const playerY = -mazeOffsetY + canvas.height / 2;
      do {
        newX = Math.random() * maze.width - maze.width / 2;
        newY = Math.random() * maze.height - maze.height / 2;
      } while (
        newX > playerX - maze.cellSize * 2 && newX < playerX + maze.cellSize * 2 &&
        newY > playerY - maze.cellSize * 2 && newY < playerY + maze.cellSize * 2
      );
      ghost.x = newX;
      ghost.y = newY;
      ghost.opacity = 0;
      ghost.fading = false;
      ghost.appearing = true; // 나타나는 상태로 전환
    }
  } else if (ghost.appearing) {
    ghost.opacity += 0.1;
    if (ghost.opacity >= 1) {
      ghost.opacity = 1;
      ghost.appearing = false; // 나타나는 상태 종료
    }
  }
}

export function updateGhosts() {
  const currentTime = Date.now();
  const ghostTypeCounts = { follower: 0, random: 0, teleporter: 0, weepingAngel: 0, charger: 0 };

  ghosts.forEach((ghost, index) => {
    const dxGhost = ghost.x - player.x;
    const dyGhost = ghost.y - player.y;
    const distance = Math.sqrt(dxGhost * dxGhost + dyGhost * dyGhost);

    ghostTypeCounts[ghost.type]++;
    updateGhostMovement(ghost, currentTime);
    ghost.x += ghost.dx;
    ghost.y += ghost.dy;
    handleMazeBoundaries(ghost);

    if (flashlightOn && isGhostHitByRay(ghost) && isWithinEffectiveRange(ghost)) {
      ghost.health -= 1;
      ghost.size += 0.1;
      if (ghost.health <= 0) handleGhostDeath(ghost, index);
    }

    // 먼저 appearing 상태 처리를 진행
    if (ghost.appearing) {
      ghost.opacity = Math.min(ghost.opacity + 0.05, 1);
      if (ghost.opacity >= 1) ghost.appearing = false;
    }

    // 모든 유령이 동일하게 투명도 조절
    if (flashlightOn && isGhostHitByRay(ghost)) {
      ghost.opacity = Math.min(ghost.opacity + 0.05, 1);
    } else if (flashlightOn) {
      ghost.opacity = Math.max(ghost.opacity - 0.05, 0.2);
    } else {
      // 플래시라이트가 꺼져 있을 때 모든 유령의 투명도를 0.2로 유지
      ghost.opacity = Math.max(ghost.opacity - 0.05, 0.2);
    }

    if (ghost.type === 'charger') {
      handleChargerMovement(ghost, player.x, player.y);
    } else {
      handleGhostFading(ghost);
    }

    // 충전기와의 충돌 체크
    if (ghost.type === 'charger' && distance < player.size + ghost.size) {
      disableFlashlight(3000); // 3초간 전등 사용 불가
    }
  });

  while (ghosts.length < ghostCount && !summonedAllFirstGhosts(ghostTypeCounts)) 
    createGhosts(1);
}

function updateGhostMovement(ghost, currentTime) {
  const playerX = -mazeOffsetX + canvas.width / 2;
  const playerY = -mazeOffsetY + canvas.height / 2;

  const dx = playerX - ghost.x;
  const dy = playerY - ghost.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (ghost.type === 'follower') {
    if (distance < ghost.visionRange) { // 무한을 의미하는 Infinity와 비교
      const angle = Math.atan2(dy, dx);
      ghost.dx = Math.cos(angle) * ghost.speed;
      ghost.dy = Math.sin(angle) * ghost.speed;
    }
  } 
  else if (ghost.type === 'teleporter') {
    handleTeleporterMovement(ghost, currentTime, playerX, playerY);
  }
  else if (ghost.type === 'weepingAngel') {
    if (distance < ghost.visionRange) {
      handleWeepingAngelMovement(ghost, playerX, playerY);
    }
  }
  else if (ghost.type === 'charger') {
    if (distance < ghost.visionRange) {
      handleChargerMovement(ghost, playerX, playerY);
    }
  }
}

function handleTeleporterMovement(ghost, currentTime, playerX, playerY) {
  // 전등이 유령에게 닿아도 순간이동을 준비
  if (currentTime - ghost.lastTeleport > ghost.teleportInterval) {
    ghost.lastTeleport = currentTime;
    ghost.fading = true;
  }

  if (ghost.fading) {
    ghost.opacity -= 0.1; 
    if (ghost.opacity <= 0) {
      let newX, newY;
      do {
        newX = Math.random() * maze.width - maze.width / 2;
        newY = Math.random() * maze.height - maze.height / 2;
      } while (
        newX > playerX - maze.cellSize * 2 && newX < playerX + maze.cellSize * 2 &&
        newY > playerY - maze.cellSize * 2 && newY < playerY + maze.cellSize * 2
      );
      ghost.x = newX;
      ghost.y = newY;
      ghost.opacity = 0;
      ghost.fading = false;
      ghost.appearing = true;
    }
  } else if (ghost.appearing) {
    ghost.opacity = Math.min(ghost.opacity + 0.1, 0.2);
    if (ghost.opacity >= 0.2) {
      ghost.opacity = 0.2;
      ghost.appearing = false;
    }
  } 
  else if (ghost.opacity < 0.2) {
    ghost.opacity = Math.min(ghost.opacity + 0.1, 0.2);
  }
}

function handleWeepingAngelMovement(ghost, playerX, playerY) {
  const dx = playerX - ghost.x;
  const dy = playerY - ghost.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < 500 && !player.isLookingAt(ghost)) {
    const angle = Math.atan2(dy, dx);
    ghost.dx = Math.cos(angle) * ghost.speed;
    ghost.dy = Math.sin(angle) * ghost.speed;
  } else {
    ghost.dx = 0;
    ghost.dy = 0;
  }
}

function handleChargerMovement(ghost, playerX, playerY) {
  const dx = playerX - ghost.x;
  const dy = playerY - ghost.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (!ghost.charging && distance < 500 && ghost.cooldown === 0) {
    ghost.charging = true;
    ghost.speed = ghost.originalSpeed * 2; // 속도 증가
  }

  if (ghost.charging) {
    const angle = Math.atan2(dy, dx);
    ghost.dx = Math.cos(angle) * ghost.speed;
    ghost.dy = Math.sin(angle) * ghost.speed;

    // 돌진 후 쿨다운 적용
    ghost.cooldown = 3000; // 3초 쿨다운
    ghost.charging = false;
  }

  if (ghost.cooldown > 0) {
    ghost.cooldown -= 16.67; // 약 60 FPS 기준 프레임당 감소
    if (ghost.cooldown < 0) ghost.cooldown = 0;
  }

  // 빗나갔을 때 처리
  if (distance > flashlight.maxDistance * 0.4 && ghost.speed > ghost.originalSpeed) {
    ghost.missCount += 1;
    ghost.speed = ghost.originalSpeed + ghost.missCount * ghost.speedIncrement; // 속도 증가
  }

  // 플레이어 시야에서 벗어나면 초기화
  if (!isGhostHitByRay(ghost)) {
    ghost.missCount = 0;
    ghost.speed = ghost.originalSpeed;
  }
}

function handleMazeBoundaries(ghost) {
  if (ghost.x < -maze.width / 2) ghost.x = maze.width / 2;
  if (ghost.x > maze.width / 2) ghost.x = -maze.width / 2;
  if (ghost.y < -maze.height / 2) ghost.y = maze.height / 2;
  if (ghost.y > maze.height / 2) ghost.y = -maze.height / 2;
}

function isWithinEffectiveRange(ghost) {
  const dx = ghost.x - player.x;
  const dy = ghost.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < flashlight.maxDistance * 0.4;
}

function createSpecialEffect(x, y, color) {
  const effect = document.createElement('div');
  effect.style.position = 'absolute';
  effect.style.left = `${x + mazeOffsetX}px`;
  effect.style.top = `${y + mazeOffsetY}px`;
  effect.style.width = '20px';
  effect.style.height = '20px';
  effect.style.backgroundColor = color; // 유령의 고유 색상으로 설정
  effect.style.borderRadius = '50%';
  effect.style.transition = 'transform 0.5s, opacity 0.5s';
  document.body.appendChild(effect);

  requestAnimationFrame(() => {
    effect.style.transform = 'scale(5)';
    effect.style.opacity = '0';
  });

  setTimeout(() => {
    document.body.removeChild(effect);
  }, 500);
}