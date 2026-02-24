/**
 * updateGhosts.js — 유령 AI · 렌더링 · 사망 처리 모듈
 *
 * 유령 타입별 이동 로직, 손전등 피해비, 투명도 업데이트,
 * 경고 표시, 파티클 이펙트 등을 담당한다.
 */

import { maze, mazeOffsetX, mazeOffsetY, canvas } from './config.js';
import { playSound } from './audio.js';
import { player } from './player.js';
import { flashlight, isGhostHitByRay, isPointInBaseVision } from './flashlight.js';
import { ghosts, createGhosts, createSplitGhosts } from './createGhosts.js';
import { flashlightOn, debugMode } from './input.js';
import { rechargeBattery } from './input.js';
import { incrementKillCount } from './uistats.js';
import { isGameRunning, getDeltaTime } from './gameState.js';

// ═══════════════════════════════════════
//  상수 & 파티클 시스템
// ═══════════════════════════════════════
const particles = [];
const MAX_PARTICLES = 50;

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
/** 손전등 유효 사거리 (에프펙티브 데미지 범위) */
const effectiveLightDistance = flashlight.maxDistance * 0.4;

// ═══════════════════════════════════════
//  유령 사망 처리
// ═══════════════════════════════════════

/**
 * 유령이 손전등에 의해 피해 0 이하로 떨어졌을 때 호출.
 * 파티클 이펙트 + 처치 통계 + 리스폰/분열 처리.
 */
function handleGhostDeath(ghost, index) {
  const ghostType = ghost.type;
  createParticleEffect(ghost.x, ghost.y, ghost.r, ghost.g, ghost.b);
  ghosts.splice(index, 1);
  
  // 분열 유령: 사망 시 분열 (splitLevel < 1 이면 한 번만)
  if (ghostType === 'splitter' && ghost.splitLevel < 1) {
    createSplitGhosts(ghost, 7);
    playSound('sounds/effect/split.mp3', 400, 200, 0, 0.6);
  }
  // 모체·일반 유령 모두 즉시 리스폰 (개체수 유지)
  if (ghost.splitLevel === 0 || ghost.splitLevel == null) {
    createGhosts(1, ghostType);
  }
  
  const randomSound = ghostDeathSounds[Math.floor(Math.random() * ghostDeathSounds.length)];
  playSound(randomSound.src, 600, 500, randomSound.startTime, randomSound.volume);
  incrementKillCount(ghostType);

  // 처치 보상: 배터리 소량 충전 + 플래시 효과
  rechargeBattery(5);
  const fill = document.querySelector('.battery-fill');
  if (fill) {
    fill.classList.add('battery-flash');
    setTimeout(() => fill.classList.remove('battery-flash'), 300);
  }
}

// ═══════════════════════════════════════
//  투명도 (opacity) 관리
// ═══════════════════════════════════════

/** 유령의 페이드인/아웃 및 손전등 조명 반응을 처리한다. */
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
    // 기본 시야 내에 있는지 체크
    const inBaseVision = isPointInBaseVision(ghost.x, ghost.y, ghost.size);
    // 손전등에 비춰지고 있는지 체크
    const hitByRay = flashlightOn && isGhostHitByRay(ghost);
    
    if (hitByRay || inBaseVision) {
      ghost.opacity = Math.min(ghost.opacity + 0.08, 1);
      ghost.stillShow = true;
      ghost.stillShowExpiresAt = Date.now() + 1000;
    } 
    else if (Date.now() < ghost.stillShowExpiresAt) {
      // 비춰진 후 잠시 유지 중 천천히 페이드아웃
      ghost.opacity = Math.max(ghost.opacity - 0.02, 0.3);
    }
    else {
      ghost.opacity = Math.max(ghost.opacity - 0.03, 0);
    }
  }
  if (ghost.stillShow && Date.now() > ghost.stillShowExpiresAt) ghost.stillShow = false;
}

// ═══════════════════════════════════════
//  리스폰 (멀리 간 유령 재배치)
// ═══════════════════════════════════════

/** 페이드아웃 완료된 유령을 플레이어 주변 복도에 다시 배치한다. */
function relocateGhost(ghost) {
  let newX, newY;
  const playerX = -mazeOffsetX + canvas.width / 2;
  const playerY = -mazeOffsetY + canvas.height / 2;
  const spawnRadius = maze.cellSize * 50;
  const minDistance = maze.cellSize * 20;
  
  // 플레이어 기준 상대 위치로 리스폰 (무한 미로 대응)
  let attempts = 0;
  do {
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * (spawnRadius - minDistance);
    newX = playerX + Math.cos(angle) * distance;
    newY = playerY + Math.sin(angle) * distance;
    attempts++;
  } while (
    attempts < 20 &&
    maze.walls.some(wall => 
      newX > wall.x && newX < wall.x + wall.width &&
      newY > wall.y && newY < wall.y + wall.height
    )
  );
  
  ghost.x = newX;
  ghost.y = newY;
  ghost.fading = false;
}

// ═══════════════════════════════════════
//  유령 타입별 이동 AI
// ═══════════════════════════════════════

/** Follower: 놐 플레이어를 곧장 추적한다. */
function handleFollowerMovement(ghost) {
  const dx = player.x - ghost.x;
  const dy = player.y - ghost.y;
  const angle = Math.atan2(dy, dx);
  ghost.dx = Math.cos(angle) * ghost.speed;
  ghost.dy = Math.sin(angle) * ghost.speed;
}

/** Teleporter: 일정 간격으로 랜덤 위치로 순간이동한다. */
function handleTeleporterMovement(ghost, currentTime) {
  if (currentTime - ghost.lastTeleport > ghost.teleportInterval) {
    ghost.lastTeleport = currentTime;
    ghost.fading = true;
  }
}

/** Weeping Angel: 플레이어가 바라보지 않을 때만 접근한다. */
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

/** Charger: 발견 시 돌진 → 재사용 대기 순환을 반복한다. */
function handleChargerMovement(ghost, playerX, playerY) {
  const dx = playerX - ghost.x;
  const dy = playerY - ghost.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (ghost.charging) {
    const chargeSpeed = ghost.baseSpeed * 2; // 원래 속도 기준으로 계산
    const angle = Math.atan2(dy, dx);
    ghost.dx = Math.cos(angle) * chargeSpeed;
    ghost.dy = Math.sin(angle) * chargeSpeed;

    if (distance < player.size + ghost.size) {
      ghost.charging = false;
      ghost.cooldown = 2000;
      ghost.speed = ghost.baseSpeed; // 원래 속도로 복원
    } else if (distance < effectiveLightDistance && !isGhostHitByRay(ghost)) {
      ghost.charging = false;
      ghost.cooldown = 2000;
      ghost.speed = ghost.baseSpeed; // 원래 속도로 복원
    }
  } else if (ghost.cooldown > 0) {
    ghost.cooldown -= getDeltaTime() * 1000;
    if (ghost.cooldown <= 0) {
      ghost.cooldown = 0;
      if (isGhostHitByRay(ghost)) {
        ghost.charging = true;
      }
    }
  } else if (distance < ghost.visionRange) {
    ghost.charging = true;
  }
}

/** Shadow: 평소 발작적 이동, 손전등 OFF + 시야 내일 때 돌진한다. */
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

/**
 * Phantom(환영): 회오리 패턴으로 접근하며,
 * 플레이어가 멈춤면 4× 빠르게 돌진한다.
 */
function handlePhantomMovement(ghost, deltaTime) {
  const dx = player.x - ghost.x;
  const dy = player.y - ghost.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angleToPlayer = Math.atan2(dy, dx);

  // 플레이어가 멈춰있으면 압도적으로 빠름, 움직이면 평범
  const speedMultiplier = player.isMoving ? 1.0 : 4.0;
  const currentSpeed = ghost.baseSpeed * speedMultiplier;
  
  // 회오리 각도 업데이트 (플레이어가 멈추면 더 빠르게 회전)
  const rotationSpeed = player.isMoving ? ghost.spiralSpeed : ghost.spiralSpeed * 2.5;
  ghost.spiralAngle += rotationSpeed * deltaTime;
  
  // 회오리 패턴: 플레이어 주위를 돌면서 접근
  // 접근 속도 (플레이어가 멈추면 더 빠르게 접근)
  const approachSpeed = player.isMoving ? currentSpeed * 0.3 : currentSpeed * 0.6;
  
  // 회오리 방향 (플레이어 기준 원형 + 접근)
  const spiralOffsetX = Math.cos(ghost.spiralAngle) * currentSpeed;
  const spiralOffsetY = Math.sin(ghost.spiralAngle) * currentSpeed;
  
  // 플레이어 방향으로 접근
  const approachX = Math.cos(angleToPlayer) * approachSpeed;
  const approachY = Math.sin(angleToPlayer) * approachSpeed;
  
  // 회오리 + 접근 합성
  ghost.dx = spiralOffsetX + approachX;
  ghost.dy = spiralOffsetY + approachY;
}

/**
 * Splitter(분열체): 모체(splitLevel 0)는 플레이어 추적,
 * 분열된 개체(splitLevel > 0)는 초기 벡터 그대로 직진한다.
 */
function handleSplitterMovement(ghost) {
  // 분열된 개체(splitLevel > 0)는 방향 변경 없이 직진
  if (ghost.splitLevel > 0) {
    return;
  }
  
  const dx = player.x - ghost.x;
  const dy = player.y - ghost.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // 모체만 플레이어를 향해 이동
  if (dist < ghost.visionRange) {
    const angle = Math.atan2(dy, dx);
    ghost.dx = Math.cos(angle) * ghost.speed;
    ghost.dy = Math.sin(angle) * ghost.speed;
  } else {
    if (Math.random() < 0.02) {
      const angle = Math.random() * Math.PI * 2;
      ghost.dx = Math.cos(angle) * ghost.speed * 0.5;
      ghost.dy = Math.sin(angle) * ghost.speed * 0.5;
    }
  }
}

// ═══════════════════════════════════════
//  범위 & 유틸리티
// ═══════════════════════════════════════

/** 무한 미로에서 플레이어와 너무 멀어진 유령을 근처로 리스폰한다. */
function handleMazeBoundaries(ghost) {
  const dx = ghost.x - player.x;
  const dy = ghost.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxDistance = maze.cellSize * 50; // 최대 거리
  
  if (distance > maxDistance) {
    // 플레이어 주변으로 리스폰
    const angle = Math.random() * Math.PI * 2;
    const spawnDist = maze.cellSize * 20 + Math.random() * maze.cellSize * 30;
    ghost.x = player.x + Math.cos(angle) * spawnDist;
    ghost.y = player.y + Math.sin(angle) * spawnDist;
  }
}

/** 유령이 손전등 유효 데미지 범위 내인지 판정한다. */
function isWithinEffectiveRange(ghost) {
  const dx = ghost.x - player.x;
  const dy = ghost.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < effectiveLightDistance;
}

// ═══════════════════════════════════════
//  메인 업데이트 루프
// ═══════════════════════════════════════

/** 매 프레임 호출 — 모든 유령의 이동·투명도·전투·수명을 갱신한다. */
export function updateGhosts() {
  if (!isGameRunning()) return;

  const currentTime = Date.now();
  const deltaTime = getDeltaTime();
  const ghostTypeCounts = { 
    follower: 0, random: 0, teleporter: 0, weepingAngel: 0, charger: 0, earthBound: 0, shadow: 0, phantom: 0, splitter: 0
  };

  // 역순으로 순회하여 splice 시 인덱스 문제 방지
  for (let index = ghosts.length - 1; index >= 0; index--) {
    const ghost = ghosts[index];
    ghostTypeCounts[ghost.type]++;
    
    // ── deltaTime 기반 이동 ──
    ghost.x += ghost.dx * deltaTime * 60;
    ghost.y += ghost.dy * deltaTime * 60;
    handleMazeBoundaries(ghost);

    // ── 손전등 피해 (earthBound · 무적 제외) ──
    const isInvincible = ghost.invincibleUntil && currentTime < ghost.invincibleUntil;
    
    if (flashlightOn && isGhostHitByRay(ghost) && isWithinEffectiveRange(ghost) && ghost.type !== 'earthBound' && !isInvincible) {
      ghost.health -= 1;
      ghost.size += 0.1;
      if (ghost.health <= 0) handleGhostDeath(ghost, index);
    }
    updateGhostOpacity(ghost);

    // ── 타입별 AI 처리 ──
    if (ghost.type === 'follower')     handleFollowerMovement(ghost);
    if (ghost.type === 'earthBound')   ghost.opacity = debugMode ? 0.2 : 0;
    if (ghost.type === 'weepingAngel') handleWeepingAngelMovement(ghost, player.x, player.y);
    if (ghost.type === 'teleporter')   handleTeleporterMovement(ghost, currentTime);
    if (ghost.type === 'charger')      handleChargerMovement(ghost, player.x, player.y);
    if (ghost.type === 'shadow')       handleShadowMovement(ghost);
    if (ghost.type === 'phantom') {
      handlePhantomMovement(ghost, deltaTime);
      ghost.opacity = Math.min(ghost.opacity, ghost.maxOpacity || 0.4);  // 환영 투명도 상한
    }

    // ── 분열체: 이동 + 수명 관리 ──
    if (ghost.type === 'splitter') {
      handleSplitterMovement(ghost);
      // 수명이 있는 분열된 유령 제거
      if (ghost.lifespan !== null) {
        const elapsed = Date.now() - ghost.spawnTime;
        if (elapsed > ghost.lifespan) {
          // fading 중이면 파티클 없이 조용히 제거
          if (!ghost.fading) {
            createParticleEffect(ghost.x, ghost.y, ghost.r, ghost.g, ghost.b);
          }
          ghosts.splice(index, 1);
        } else {
          // 수명이 끝나갈수록 투명해짐
          ghost.opacity = Math.max(0.1, 1 - (elapsed / ghost.lifespan));
        }
      }
    }
  }
  
  // 디버프 만료 처리는 main.js 게임 루프에서 수행
}

// ═══════════════════════════════════════
//  파티클 이펙트
// ═══════════════════════════════════════

/** 유령 사망/페이드 위치에 방사형 파티클 8개를 생성한다. */
function createParticleEffect(x, y, r, g, b) {
  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    if (particles.length >= MAX_PARTICLES) {
      particles.shift(); // 오래된 파티클 제거
    }
    const angle = (Math.PI * 2 * i) / particleCount;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * 3,
      vy: Math.sin(angle) * 3,
      r, g, b,
      life: 1.0,
      size: 8,
    });
  }
}

/** 파티클 업데이트 및 렌더링 (deltaTime 기반). */
export function updateAndDrawParticles(ctx, offsetX, offsetY) {
  const deltaTime = getDeltaTime();
  
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * deltaTime * 60;
    p.y += p.vy * deltaTime * 60;
    p.life -= deltaTime * 2;
    p.size *= 0.98;
    
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    
    // 렌더링
    ctx.beginPath();
    ctx.arc(p.x + offsetX, p.y + offsetY, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.life})`;
    ctx.fill();
  }
}

// ═══════════════════════════════════════
//  유령 렌더링
// ═══════════════════════════════════════

/** 화면에 보이는 유령들과 경고 표시(!)를 렌더링한다. */
export function drawVisibleGhosts(ctx, mazeOffsetX, mazeOffsetY) {
  updateAndDrawParticles(ctx, mazeOffsetX, mazeOffsetY);
  
  ghosts.forEach((ghost) => {
    const dx = ghost.x - player.x;
    const dy = ghost.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 기본 시야 내에 있는지 체크
    const inBaseVision = isPointInBaseVision(ghost.x, ghost.y, ghost.size);
    
    const isGhostVisible = debugMode
      ? true
      : (
          ghost.x + mazeOffsetX > 0 &&
          ghost.x + mazeOffsetX < canvas.width &&
          ghost.y + mazeOffsetY > 0 &&
          ghost.y + mazeOffsetY < canvas.height &&
          (inBaseVision || (flashlightOn && (isGhostHitByRay(ghost) || ghost.stillShow)))
        );

    if ((isGhostVisible || ghost.type === 'earthBound') && ghost.opacity > 0) {
      // RGB + opacity 조합
      ctx.fillStyle = `rgba(${ghost.r}, ${ghost.g}, ${ghost.b}, ${ghost.opacity})`;
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

    // ── 경고 표시(!): 시야 밖 + 일정 거리 내 + warningHidden 디버프 미적용 ──
    const showWarning = distance < ghost.warningRange
      && (ghost.type === 'earthBound' || !isGhostVisible)
      && !player.debuffs.some(debuff => debuff.type === 'warningHidden');
    if (showWarning) {
      ctx.fillStyle = `rgba(${ghost.r}, ${ghost.g}, ${ghost.b}, 1)`;
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', ghost.x + mazeOffsetX, ghost.y + mazeOffsetY);
    }
  });
}