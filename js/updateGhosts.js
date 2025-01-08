import { maze, mazeOffsetX, mazeOffsetY, canvas, playSound } from './main.js';
import { player } from './player.js';
import { flashlight, isGhostHitByRay } from './flashlight.js';
import { ghosts, createGhosts } from './createGhosts.js';
import { flashlightOn, flashlightWasOnBeforeDisable, setFlashlightOn, debugMode } from './input.js';
import { incrementKillCount } from './uistats.js';

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
const effectiveLightDistance = flashlight.maxDistance * 0.4;

function handleGhostDeath(ghost, index) {
  const ghostType = ghost.type;
  createSpecialEffect(ghost.x, ghost.y, ghost.color);
  ghosts.splice(index, 1);
  createGhosts(1, ghostType);
  const randomSound = ghostDeathSounds[Math.floor(Math.random() * ghostDeathSounds.length)];
  playSound(randomSound.src, 600, 500, randomSound.startTime, randomSound.volume, true); // 중단 가능하도록 설정
  incrementKillCount(ghostType);
}

function updateGhostOpacity(ghost) {
  if (ghost.fading) {
    ghost.opacity = Math.max(ghost.opacity - 0.05, 0);
    if (ghost.opacity <= 0) {
      ghost.opacity = 0;
      ghost.fading = false;
      relocateGhost(ghost);
      ghost.appearing = true;
    }
  } else if (ghost.appearing) {
    ghost.opacity = Math.min(ghost.opacity + 0.05, 1);
    if (ghost.opacity >= 1) {
      ghost.opacity = 1;
      ghost.appearing = false;
    }
  } else {
    if (flashlightOn && isGhostHitByRay(ghost)) {
      ghost.opacity = Math.min(ghost.opacity + 0.05, 1);
      ghost.stillShow = true;
      ghost.stillShowExpiresAt = Date.now() + 1000;
    } 
    else ghost.opacity = Math.max(ghost.opacity - 0.05, 0.2);
  }
  if (ghost.stillShow && Date.now() > ghost.stillShowExpiresAt) ghost.stillShow = false;
}

function relocateGhost(ghost) {
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
  ghost.fading = false;
}

function handleFollowerMovement(ghost) {
  const dx = player.x - ghost.x;
  const dy = player.y - ghost.y;
  const angle = Math.atan2(dy, dx);
  ghost.dx = Math.cos(angle) * ghost.speed;
  ghost.dy = Math.sin(angle) * ghost.speed;
}

function handleTeleporterMovement(ghost, currentTime) {
  if (currentTime - ghost.lastTeleport > ghost.teleportInterval) {
    ghost.lastTeleport = currentTime;
    ghost.fading = true;
  }
}

function handleWeepingAngelMovement(ghost, playerX, playerY) {
  const dx = playerX - ghost.x;
  const dy = playerY - ghost.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

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

    if (distance < player.size + ghost.size) {
      ghost.charging = false;
      ghost.cooldown = 2000;
    } else if (distance < effectiveLightDistance && !isGhostHitByRay(ghost)) {
      ghost.charging = false;
      ghost.cooldown = 2000;
      ghost.speed *= 0.5;
    }
  } else if (ghost.cooldown > 0) {
    ghost.cooldown -= 16.67;
    if (ghost.cooldown <= 0) {
      ghost.cooldown = 0;
      if (isGhostHitByRay(ghost)) {
        ghost.charging = true;
        ghost.speed *= 2;
      }
    }
  } else if (distance < ghost.visionRange) {
    ghost.charging = true;
    ghost.speed *= 2;
  }
}

function handleShadowMovement(ghost) {
  const dx = player.x - ghost.x;
  const dy = player.y - ghost.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const inSight = dist < ghost.visionRange;

  if (!inSight || flashlightOn) { // 평소 흔들리며 발작
    const angle = Math.random() * Math.PI * 2;
    ghost.dx = Math.cos(angle) * ghost.speed;
    ghost.dy = Math.sin(angle) * ghost.speed;
  } else { // 플레이어 쪽으로 접근 또는 돌진
    const angle = Math.atan2(dy, dx);
    const speed = ghost.speed * 2.5; // 돌진 속도
    ghost.dx = Math.cos(angle) * speed;
    ghost.dy = Math.sin(angle) * speed;
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
  return distance < effectiveLightDistance;
}

export function updateGhosts() {
  if (!gameRunning) return;

  const currentTime = Date.now();
  const ghostTypeCounts = { 
    follower: 0, random: 0, teleporter: 0, weepingAngel: 0, charger: 0, earthBound: 0, shadow: 0
  };

  ghosts.forEach((ghost, index) => {
    ghostTypeCounts[ghost.type]++;
    ghost.x += ghost.dx;
    ghost.y += ghost.dy;
    handleMazeBoundaries(ghost);

    if (flashlightOn && isGhostHitByRay(ghost) && isWithinEffectiveRange(ghost)) {
      ghost.health -= 1;
      ghost.size += 0.1;
      if (ghost.health <= 0) handleGhostDeath(ghost, index);
    }
    updateGhostOpacity(ghost);

    if (ghost.type === 'follower') handleFollowerMovement(ghost);
    if (ghost.type === 'earthBound') ghost.opacity = debugMode ? 0.2 : 0;
    if (ghost.type === 'weepingAngel') handleWeepingAngelMovement(ghost, player.x, player.y);
    if (ghost.type === 'teleporter') handleTeleporterMovement(ghost, currentTime);
    if (ghost.type === 'charger') handleChargerMovement(ghost, player.x, player.y);
    if (ghost.type === 'shadow') handleShadowMovement(ghost);
  });
  
  player.debuffs = player.debuffs.filter(debuff => {
    if (currentTime > debuff.expiresAt) {
      player.removeDebuff(debuff.type);
      return false;
    }
    return true;
  });

  const hasFlashlightDebuff = player.debuffs.some(debuff => debuff.type === 'flashlightDisabled');
  if (!hasFlashlightDebuff) setFlashlightOn(flashlightWasOnBeforeDisable);
}

function createSpecialEffect(x, y, color) {
  const effect = document.createElement('div');
  effect.style.position = 'absolute';
  effect.style.left = `${x + mazeOffsetX}px`;
  effect.style.top = `${y + mazeOffsetY}px`;
  effect.style.width = '20px';
  effect.style.height = '20px';
  effect.style.backgroundColor = color;
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

export function drawVisibleGhosts(ctx, mazeOffsetX, mazeOffsetY) {
  ghosts.forEach((ghost) => {
    const dx = ghost.x - player.x;
    const dy = ghost.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // debugMode가 활성화 되어 있거나 전등이 켜져 있을 때만 유령이 보이도록 수정
    const isGhostVisible = debugMode 
      ? true 
      : (
          ghost.x + mazeOffsetX > 0 &&
          ghost.x + mazeOffsetX < canvas.width &&
          ghost.y + mazeOffsetY > 0 &&
          ghost.y + mazeOffsetY < canvas.height &&
          flashlightOn && (isGhostHitByRay(ghost) || ghost.stillShow)
        );

    if (isGhostVisible || ghost.type === 'earthBound') {
      ctx.fillStyle = ghost.color.replace('0.7', ghost.opacity.toString());
      ctx.beginPath();
      ctx.arc(
        ghost.x + mazeOffsetX,
        ghost.y + mazeOffsetY,
        ghost.size,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // 경고 표시 조건 수정
    if (distance < ghost.warningRange && !isGhostVisible && !player.debuffs.some(debuff => debuff.type === 'warningHidden')) {
      ctx.fillStyle = ghost.color;
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', ghost.x + mazeOffsetX, ghost.y + mazeOffsetY);
    }
  });
}