/**
 * createGhosts.js — 유령 생성 및 분열 모듈
 *
 * 유령 타입 정의(확률·능력치), 초기 스폰, 분열(Splitter) 로직,
 * 가족 소멸 처리 등을 담당한다.
 */

import { maze, mazeOffsetX, mazeOffsetY, canvas, CELL } from './config.js';

export { CELL };

// ═══════════════════════════════════════
//  유령 목록 & 상수
// ═══════════════════════════════════════
export const ghosts     = [];
export const ghostCount = 1000;   // 최대 개체 수

// ═══════════════════════════════════════
//  유령 타입 정의
//  - 확률(probability)은 가중치 비율이다 (합계 = 1.0).
//  - 일반 → 중급 → 특수 순으로 희귀도가 높아진다.
// ═══════════════════════════════════════
const ghostTypes = [
  // ── 일반 (흔함) ──────────────────
  { type: 'random',      probability: 0.30,
    r: 0,   g: 255, b: 0,
    speed: 1.5, size: 20, health: 50,
    visionRange: 3 * CELL, warningRange: 2 * CELL },

  { type: 'earthBound',  probability: 0.20,
    r: 50,  g: 50,  b: 50,
    speed: 0,   size: 20, health: Infinity,
    visionRange: 0,        warningRange: 2 * CELL },

  // ── 중급 ─────────────────────────
  { type: 'teleporter',  probability: 0.15,
    r: 0,   g: 0,   b: 255,
    speed: 3.0, size: 20, health: 40,
    visionRange: 3 * CELL, warningRange: 2 * CELL },

  { type: 'weepingAngel', probability: 0.12,
    r: 255, g: 255, b: 0,
    speed: 2.5, size: 20, health: 30,
    visionRange: 5 * CELL, warningRange: 3 * CELL },

  { type: 'follower',    probability: 0.08,
    r: 255, g: 0,   b: 0,
    speed: 1.0, size: 20, health: 60,
    visionRange: Infinity, warningRange: 4 * CELL },

  // ── 특수 (희귀) ──────────────────
  { type: 'shadow',      probability: 0.06,
    r: 0,   g: 255, b: 255,
    speed: 5.0, size: 20, health: 50,
    visionRange: 5 * CELL, warningRange: 6 * CELL },

  { type: 'charger',     probability: 0.04,
    r: 255, g: 0,   b: 255,
    speed: 4.0, size: 20, health: 20,
    visionRange: 4 * CELL, warningRange: 4 * CELL },

  { type: 'phantom',     probability: 0.03,
    r: 200, g: 150, b: 255,
    speed: 1.5, size: 18, health: 35,
    visionRange: Infinity, warningRange: 6 * CELL, maxOpacity: 0.4 },

  { type: 'splitter',    probability: 16.0,
    r: 255, g: 128, b: 0,
    speed: 2.0, size: 22, health: 8,
    visionRange: 4 * CELL, warningRange: 3 * CELL },
];

// ═══════════════════════════════════════
//  유령 생성
// ═══════════════════════════════════════

/**
 * 유령 한 마리를 생성하여 반환한다.
 * 타입에 따라 추가 속성(텔레포터 간격, 환영 회전 등)을 부여한다.
 */
function spawnGhost(ghostType) {
  const { x, y } = getRandomPosition(ghostType);
  const angle = Math.random() * Math.PI * 2;
  const speed = ghostType.speed;

  const ghost = {
    // ─ 기본 ─
    x, y,
    size:  ghostType.size,
    dx:    Math.cos(angle) * speed,
    dy:    Math.sin(angle) * speed,
    type:  ghostType.type,

    // ─ 색상 (RGBA 분리) ─
    r: ghostType.r,
    g: ghostType.g,
    b: ghostType.b,

    // ─ 이동 ─
    speed,
    baseSpeed: ghostType.speed,

    // ─ 시각 ─
    opacity:    0,           // 비춰야 보임
    fading:     false,
    appearing:  false,
    stillShow:  false,
    stillShowExpiresAt: 0,

    // ─ 전투 ─
    health:       ghostType.health,
    charging:     false,
    cooldown:     0,
    visionRange:  ghostType.visionRange,
    warningRange: ghostType.warningRange,
    immobile:     ghostType.type === 'earthBound',

    // ─ 기타 ─
    lastTeleport: 0,
  };

  // 타입별 특수 초기화
  if (ghostType.type === 'teleporter') {
    ghost.teleportInterval = Math.random() * 6000 + 2000;
  }
  if (ghostType.type === 'phantom') {
    ghost.maxOpacity   = ghostType.maxOpacity || 0.4;
    ghost.spiralAngle  = Math.random() * Math.PI * 2;
    ghost.spiralSpeed  = 2.0;
  }
  if (ghostType.type === 'splitter') {
    ghost.splitLevel = 0;
    ghost.lifespan   = null;
    ghost.spawnTime  = Date.now();
    ghost.familyId   = Date.now() + Math.random();
  }

  return ghost;
}

/**
 * count 마리의 유령을 생성하여 ghosts 배열에 추가한다.
 * specificType 을 지정하면 해당 타입만 생성한다.
 */
export function createGhosts(count = ghostCount, specificType = null) {
  for (let i = 0; i < count; i++) {
    const ghostType = specificType
      ? ghostTypes.find(gt => gt.type === specificType)
      : getRandomGhostType();
    ghosts.push(spawnGhost(ghostType));
  }
}

// ═══════════════════════════════════════
//  분열(Splitter) 전용
// ═══════════════════════════════════════

/**
 * 부모 유령이 죽을 때 호출되어,
 * 플레이어 방향 부채꼴(±45°)로 splitCount 마리의 분열체를 발사한다.
 */
export function createSplitGhosts(parentGhost, splitCount = 4) {
  const playerX = -mazeOffsetX + canvas.width  / 2;
  const playerY = -mazeOffsetY + canvas.height / 2;
  const angleToPlayer = Math.atan2(playerY - parentGhost.y, playerX - parentGhost.x);

  const spreadAngle  = Math.PI / 2;                       // 90° 부채꼴
  const newSplitLevel = parentGhost.splitLevel + 1;
  const newSize       = Math.max(8, parentGhost.size * 0.65);
  const newSpeed      = parentGhost.baseSpeed * 3.0;
  const newHealth     = parentGhost.health * 2;
  const familyId      = parentGhost.familyId;

  for (let i = 0; i < splitCount; i++) {
    const angleOffset = (i - (splitCount - 1) / 2)
      * (spreadAngle / (splitCount - 1 || 1));
    const angle = angleToPlayer + angleOffset;

    ghosts.push({
      x: parentGhost.x,
      y: parentGhost.y,
      size: newSize,
      dx: Math.cos(angle) * newSpeed,
      dy: Math.sin(angle) * newSpeed,
      type: 'splitter',

      r: 255,
      g: Math.max(50, 128 - newSplitLevel * 30),   // 분열할수록 붉어짐
      b: 0,

      speed:     newSpeed,
      baseSpeed: newSpeed,
      opacity:   0.8,
      fading:    false,
      appearing: false,
      stillShow: true,
      stillShowExpiresAt: Date.now() + 5000,
      health:    newHealth,
      charging:  false,
      cooldown:  0,
      visionRange:  4 * CELL,
      warningRange: 3 * CELL,
      immobile:  false,
      lastTeleport: 0,

      // 분열 전용 속성
      splitLevel:         newSplitLevel,
      lifespan:           5000,                     // 5 초 수명
      spawnTime:          Date.now(),
      invincibleUntil:    Date.now() + 1500,        // 1.5 초 무적
      familyId:           familyId,
      keepDirectionUntil: Date.now() + 1000,        // 1 초간 직진 유지
    });
  }
}

/**
 * 같은 familyId 를 가진 모든 분열체를 서서히 소멸시킨다.
 * (플레이어가 분열체에 닿으면 가족 전체가 제거됨)
 */
export function fadeOutSplitterFamily(familyId) {
  for (const ghost of ghosts) {
    if (ghost.type === 'splitter' && ghost.familyId === familyId) {
      ghost.fading   = true;
      ghost.lifespan = 500;
      ghost.spawnTime = Date.now();
    }
  }
}

// ═══════════════════════════════════════
//  유틸리티 (내부)
// ═══════════════════════════════════════

/** 가중치 확률로 유령 타입을 선택한다. */
function getRandomGhostType() {
  const total = ghostTypes.reduce((acc, gt) => acc + gt.probability, 0);
  const rand  = Math.random() * total;
  let cumulative = 0;
  for (const gt of ghostTypes) {
    cumulative += gt.probability;
    if (rand <= cumulative) return gt;
  }
  return ghostTypes[ghostTypes.length - 1];
}

/**
 * 플레이어 주변 랜덤 빈 공간 좌표를 반환한다.
 * 벽 충돌 시 최대 30 회 재시도한다.
 */
function getRandomPosition(ghostType) {
  const playerX = -mazeOffsetX + canvas.width  / 2;
  const playerY = -mazeOffsetY + canvas.height / 2;

  const spawnRadius = maze.cellSize * 50;
  const minDistance  = maze.cellSize * 20;
  const maxAttempts  = 30;
  let attempts = 0;
  let x, y;

  do {
    const angle    = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * (spawnRadius - minDistance);
    x = playerX + Math.cos(angle) * distance;
    y = playerY + Math.sin(angle) * distance;
    attempts++;

    const inWall = maze.walls.some(wall =>
      x > wall.x && x < wall.x + wall.width &&
      y > wall.y && y < wall.y + wall.height
    );
    if (!inWall) break;
  } while (attempts < maxAttempts);

  return { x, y };
}
