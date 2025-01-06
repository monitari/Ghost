import { maze, mazeOffsetX, mazeOffsetY, canvas } from './main.js';
import { player } from './player.js';
import { flashlight, isGhostHitByRay } from './flashlight.js';
import { ghosts, createGhosts, ghostCount } from './createGhosts.js';
import { flashlightOn, flashlightWasOnBeforeDisable, setFlashlightOn, debugMode } from './input.js';
import { playSound } from './sound.js'; // 추가
import { incrementKillCount } from './stats.js'; // 추가

const ghostDeathSounds = [
  { src: 'sounds/ghost/ghost-death1.mp3', startTime: 0, volume: 0.5 },
  { src: 'sounds/ghost/ghost-death2.mp3', startTime: 0.2, volume: 1.0 },
  { src: 'sounds/ghost/ghost-death3.mp3', startTime: 0.3, volume: 0.7 },
  { src: 'sounds/ghost/ghost-death4.mp3', startTime: 0.4, volume: 0.8 },
  { src: 'sounds/ghost/ghost-death5.mp3', startTime: 1.1, volume: 0.8 },
  { src: 'sounds/ghost/ghost-death6.mp3', startTime: 0.0, volume: 0.2 },
  { src: 'sounds/ghost/ghost-death7.mp3', startTime: 1.5, volume: 0.5 },
  { src: 'sounds/ghost/ghost-death8.mp3', startTime: 0.0, volume: 0.4 },
  { src: 'sounds/ghost/ghost-death9.mp3', startTime: 0.0, volume: 0.6 },
  { src: 'sounds/ghost/ghost-death10.mp3', startTime: 0.0, volume: 1.0 },
];

function handleGhostDeath(ghost, index) {
  const ghostType = ghost.type;
  createSpecialEffect(ghost.x, ghost.y, ghost.color);
  ghosts.splice(index, 1);
  createGhosts(1, ghostType);
  const randomSound = ghostDeathSounds[Math.floor(Math.random() * ghostDeathSounds.length)];
  playSound(randomSound.src, 600, 500, randomSound.startTime, randomSound.volume);
  
  // 유령 타입 별 처치 횟수 증가
  incrementKillCount(ghostType);
  
  if (ghost.type === 'earthBound') {
    player.addDebuff({
      type: 'immobilized',
      expiresAt: Date.now() + 3000 // 3초간 움직이지 못하게 함
    });
  }
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
  if (!gameRunning) return; // 게임이 시작되지 않았으면 유령 업데이트 중지

  const currentTime = Date.now();
  const ghostTypeCounts = { 
    follower: 0, random: 0, teleporter: 0, weepingAngel: 0, charger: 0, earthBound: 0 
  };

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
    if (flashlightOn && isGhostHitByRay(ghost)) ghost.opacity = Math.min(ghost.opacity + 0.05, 1);
    else if (flashlightOn) ghost.opacity = Math.max(ghost.opacity - 0.05, 0.2);
    else { // 플래시라이트가 꺼져 있을 때 모든 유령의 투명도를 0.2로 유지
      ghost.opacity = Math.max(ghost.opacity - 0.05, 0.2);
    }

    if (ghost.type === 'charger') handleChargerMovement(ghost, player.x, player.y);
    else handleGhostFading(ghost);

    if (ghost.type === 'earthBound') { // 지박령은 항상 안보이고, 경고등으로만 위치를 파악할 수 있음
      ghost.opacity = debugMode ? 0.2 : 0;
    }
  });

  while (ghosts.length < ghostCount && !summonedAllFirstGhosts(ghostTypeCounts)) 
    createGhosts(1);
  
  // 디버프 만료 확인 및 전등 상태 재조정
  player.debuffs = player.debuffs.filter(debuff => {
    if (currentTime > debuff.expiresAt) {
      player.removeDebuff(debuff.type);
      return false; // 제거
    }
    return true; // 유지
  });

  // 활성화된 'flashlightDisabled' 디버프가 있는지 확인
  const hasFlashlightDebuff = player.debuffs.some(debuff => debuff.type === 'flashlightDisabled');

  if (!hasFlashlightDebuff) setFlashlightOn(flashlightWasOnBeforeDisable); // 이전 상태로 복원
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
    handleWeepingAngelMovement(ghost, playerX, playerY);
  }
  else if (ghost.type === 'charger') {
    if (distance < ghost.visionRange) {
      handleChargerMovement(ghost, playerX, playerY);
    }
  }
}

function handleTeleporterMovement(ghost, currentTime, playerX, playerY) {
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

  // 플레이어가 유령의 시야 범위 내에 있을 때 + 플레이어가 유령을 바라보고 있지 않을 때
  if (distance < ghost.visionRange && !player.isLookingAt(ghost)) {
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

  if (ghost.charging) {
    const angle = Math.atan2(dy, dx);
    ghost.dx = Math.cos(angle) * ghost.speed;
    ghost.dy = Math.sin(angle) * ghost.speed;

    // 플레이어와 충돌 시 디버프 적용
    if (distance < player.size + ghost.size) {
      ghost.charging = false;
      ghost.cooldown = 3000; // 3초 쿨타임
    } else if (distance < flashlight.maxDistance * 0.4 && !isGhostHitByRay(ghost)) {
      // 돌진을 놓쳤을 때
      ghost.charging = false;
      ghost.cooldown = 3000; // 3초 쿨타임
      ghost.speed *= 0.5; // 속도 감소
    }
  } else if (ghost.cooldown > 0) {
    ghost.cooldown -= 16.67; // 약 60 FPS 기준 프레임당 감소
    if (ghost.cooldown <= 0) {
      ghost.cooldown = 0;
      if (isGhostHitByRay(ghost)) {
        ghost.charging = true;
        ghost.speed *= 2; // 속도 2배 증가
      }
    }
  } else {
    // 플레이어가 충전 범위에 들어왔을 때
    if (distance < ghost.visionRange) {
      ghost.charging = true;
      ghost.speed *= 2; // 속도 2배 증가
    }
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