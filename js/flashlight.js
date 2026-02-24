/**
 * flashlight.js — 손전등 · 시야 렌더링 모듈
 *
 * 레이캐스팅, 간접광, 글로우, 기본 시야 마스크,
 * 유령/아이템 조명 판정 등을 담당한다.
 */

import { canvas, maze, mazeOffsetX, mazeOffsetY } from './config.js';

// ═══════════════════════════════════════
//  손전등 설정
// ═══════════════════════════════════════
export const flashlight = {
  angle:       0,
  fov:         Math.PI / 4,   // 시야각 45°
  rayCount:    60,
  maxDistance: 800,
  rayCache:    new Map(),
};

/** 손전등 OFF 시 플레이어 주위 기본 시야 반경(px) */
export const BASE_VISION_RADIUS = 80;

/** 각 프레임 레이캐스팅 결과 세그먼트를 저장한다. */
export const flashlightSegments = [];

// ═══════════════════════════════════════
//  번 그리드 (공간 해싱 충돌 검사)
// ═══════════════════════════════════════
const wallGrid = new Map();
let lastWallCount = 0;

/**
 * 벽 그리드를 재빌드한다. 청크 변경 시만 실행됨.
 * drawFlashlight() 시작 시 자동 호출된다.
 */
export function initializeWallGrid() {
  // 벽 개수가 변경되었는지 확인 (청크 업데이트 감지)
  if (maze.walls.length === lastWallCount && !maze.wallGridNeedsUpdate) {
    return; // 변경 없으면 스킵
  }
  
  lastWallCount = maze.walls.length;
  maze.wallGridNeedsUpdate = false;
  
  wallGrid.clear();
  maze.walls.forEach(wall => {
    // 무한 미로: 벽 좌표가 이미 월드 좌표이므로 오프셋 불필요
    const startGridX = Math.floor(wall.x / maze.cellSize);
    const startGridY = Math.floor(wall.y / maze.cellSize);
    const endGridX = Math.floor((wall.x + wall.width) / maze.cellSize);
    const endGridY = Math.floor((wall.y + wall.height) / maze.cellSize);
    
    for (let x = startGridX; x <= endGridX; x++) {
      for (let y = startGridY; y <= endGridY; y++) {
        const key = `${x},${y}`;
        if (!wallGrid.has(key)) wallGrid.set(key, []);
        wallGrid.get(key).push(wall);
      }
    }
  });
}

// ═══════════════════════════════════════
//  레이캐스팅 (DDA + 벽 교차 검사)
// ═══════════════════════════════════════

/** 레이와 벽 AABB의 교차 지점을 반환한다. */
function checkWallCollision(x1, y1, x2, y2, wall) {
  const wallX = wall.x + mazeOffsetX;
  const wallY = wall.y + mazeOffsetY;
  const rayDirX = x2 - x1;
  const rayDirY = y2 - y1;
  const intersections = [];

  if (rayDirY > 0) {
    const hit = lineSegmentIntersection(x1, y1, x2, y2, wallX, wallY, wallX + wall.width, wallY);
    if (hit) intersections.push(hit);
  }
  if (rayDirX < 0) {
    const hit = lineSegmentIntersection(x1, y1, x2, y2, wallX + wall.width, wallY, wallX + wall.width, wallY + wall.height);
    if (hit) intersections.push(hit);
  }
  if (rayDirY < 0) {
    const hit = lineSegmentIntersection(x1, y1, x2, y2, wallX, wallY + wall.height, wallX + wall.width, wallY + wall.height);
    if (hit) intersections.push(hit);
  }
  if (rayDirX > 0) {
    const hit = lineSegmentIntersection(x1, y1, x2, y2, wallX, wallY, wallX, wallY + wall.height);
    if (hit) intersections.push(hit);
  }

  if (intersections.length > 0)
    return intersections.reduce((closest, current) => (current.distance < closest.distance ? current : closest));

  return null;
}

/** 두 선분의 교차점을 계산한다 (null = 교차 없음). */
function lineSegmentIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 0.0001) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
      distance: t * Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
      hit: true
    };
  }

  return null;
}

/** DDA 방식으로 레이를 발사하여 가장 가까운 벽 히트를 반환한다. */
function castRayDDA(startX, startY, angle) {
  const rayDirX = Math.cos(angle);
  const rayDirY = Math.sin(angle);
  const endX = startX + rayDirX * flashlight.maxDistance;
  const endY = startY + rayDirY * flashlight.maxDistance;
  
  // 무한 미로: 월드 좌표를 직접 그리드 좌표로 변환
  const worldX = startX - mazeOffsetX;
  const worldY = startY - mazeOffsetY;
  const playerGridX = Math.floor(worldX / maze.cellSize);
  const playerGridY = Math.floor(worldY / maze.cellSize);
  const searchRadius = Math.ceil(flashlight.maxDistance / maze.cellSize);

  let closestHit = null;
  let minDistance = flashlight.maxDistance;

  // 무한 미로: 제한 없이 검색 범위 순회
  for (let gridX = playerGridX - searchRadius; gridX <= playerGridX + searchRadius; gridX++) {
    for (let gridY = playerGridY - searchRadius; gridY <= playerGridY + searchRadius; gridY++) {
      const key = `${gridX},${gridY}`;
      const walls = wallGrid.get(key);
      
      if (walls) {
        for (const wall of walls) {
          const hit = checkWallCollision(startX, startY, endX, endY, wall);
          if (hit && hit.distance < minDistance) {
            minDistance = hit.distance;
            closestHit = hit;
          }
        }
      }
    }
  }

  return closestHit || {
    x: endX,
    y: endY,
    distance: flashlight.maxDistance,
    hit: false
  };
}

// ═══════════════════════════════════════
//  손전등 렌더링
// ═══════════════════════════════════════

/**
 * 손전등 콘을 렌더링한다.
 * 레이캐스팅 → 광원 콘 → 간접광 → 반사 광 → 그레이디언트 순서.
 */
export function drawFlashlight(ctx) {
  initializeWallGrid();   // 청크 업데이트 감지 → 벽 그리드 자동 갱신
  
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const fps = getFPS();
  flashlight.rayCount = Math.max(30, Math.min(60, Math.floor(fps / 2))); // 최소값을 30으로 조정
  flashlightSegments.length = 0;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 1.0)'; // 완전 불투명 - 손전등 밖 벽 완전 숨김
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);

  const angleStep = flashlight.fov / flashlight.rayCount;
  const startAngle = flashlight.angle - flashlight.fov / 2;
  let points = [];

  for (let i = 0; i <= flashlight.rayCount; i++) {
    const rayAngle = startAngle + angleStep * i;
    const cacheKey = `${Math.round(rayAngle * 100)}`;
    let rayResult;

    if (flashlight.rayCache.has(cacheKey)) rayResult = flashlight.rayCache.get(cacheKey);
    else {
      rayResult = castRayDDA(centerX, centerY, rayAngle);
      flashlight.rayCache.set(cacheKey, rayResult);
    }

    flashlightSegments.push({
      startX: centerX,
      startY: centerY,
      endX: rayResult.x,
      endY: rayResult.y,
      distance: rayResult.distance,
      hit: rayResult.hit
    });

    points.push(rayResult);
    ctx.lineTo(rayResult.x, rayResult.y);
  }

  ctx.lineTo(centerX, centerY);
  ctx.fill();

  // ── 간접광 (indirect light): 벽 히트 지점에서 주변으로 빛 확산 ──
  const INDIRECT_LIGHT_RADIUS    = 60;
  const INDIRECT_LIGHT_INTENSITY = 0.7;
  
  points.forEach((point, index) => {
    if (point.hit && point.distance < flashlight.maxDistance * 0.9) {
      // 거리에 따른 간접광 감쇠
      const distanceFactor  = 1 - (point.distance / flashlight.maxDistance);
      const indirectRadius  = INDIRECT_LIGHT_RADIUS * distanceFactor;
      
      if (indirectRadius > 5) {
        // 입사 방향 계산
        const incomingDirX = (point.x - centerX) / point.distance;
        const incomingDirY = (point.y - centerY) / point.distance;
        
        // 반사 방향 계산 (간단히 입사 방향의 반대 + 측면 확산)
        // 벽 법선을 정확히 계산하기 어려우므로 방사형 확산 사용
        const indirectGrad = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, indirectRadius
        );
        indirectGrad.addColorStop(0, `rgba(0, 0, 0, ${INDIRECT_LIGHT_INTENSITY * distanceFactor})`);
        indirectGrad.addColorStop(0.4, `rgba(0, 0, 0, ${INDIRECT_LIGHT_INTENSITY * distanceFactor * 0.5})`);
        indirectGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(point.x, point.y, indirectRadius, 0, Math.PI * 2);
        ctx.fillStyle = indirectGrad;
        ctx.fill();
      }
    }
  });

  // ── 라이트 ON 시에도 플레이어 주변 기본 시야 추가 ──
  const baseGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, BASE_VISION_RADIUS);
  baseGrad.addColorStop(0.6, 'rgba(0, 0, 0, 1)');
  baseGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.beginPath();
  ctx.arc(centerX, centerY, BASE_VISION_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = baseGrad;
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
  
  // ── 벽 히트 지점 빛 반사 효과 ──
  points.forEach((point, index) => {
    if (point.hit) {
      // 거리에 따른 밝기 감소
      const brightness = Math.max(0.3, 1 - point.distance / flashlight.maxDistance);
      const glowSize = 4 + (1 - point.distance / flashlight.maxDistance) * 6;
      
      // 외부 글로우
      const glowGrad = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowSize * 2);
      glowGrad.addColorStop(0, `rgba(255, 255, 200, ${brightness * 0.3})`);
      glowGrad.addColorStop(0.5, `rgba(255, 255, 150, ${brightness * 0.15})`);
      glowGrad.addColorStop(1, 'rgba(255, 255, 150, 0)');
      
      ctx.beginPath();
      ctx.arc(point.x, point.y, glowSize * 2, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();
      
      // 중심 밝은 점
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 220, ${brightness * 0.4})`;
      ctx.fill();
      
      // ── 간접광 시각 효과 (따뜻한 반사광) ──
      const distanceFactor = 1 - (point.distance / flashlight.maxDistance);
      const indirectVisualRadius = 50 * distanceFactor;
      
      if (indirectVisualRadius > 10) {
        const indirectColorGrad = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, indirectVisualRadius
        );
        indirectColorGrad.addColorStop(0, `rgba(255, 240, 180, ${brightness * 0.08})`);
        indirectColorGrad.addColorStop(0.5, `rgba(255, 230, 150, ${brightness * 0.04})`);
        indirectColorGrad.addColorStop(1, 'rgba(255, 220, 120, 0)');
        
        ctx.beginPath();
        ctx.arc(point.x, point.y, indirectVisualRadius, 0, Math.PI * 2);
        ctx.fillStyle = indirectColorGrad;
        ctx.fill();
      }
    }
  });

  ctx.globalCompositeOperation = 'lighter';
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, flashlight.maxDistance);
  gradient.addColorStop(0, 'rgba(255, 255, 150, 0.3)');
  gradient.addColorStop(1, 'rgba(255, 255, 150, 0)');

  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  points.forEach(point => ctx.lineTo(point.x, point.y));
  ctx.lineTo(centerX, centerY);

  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  if (flashlight.rayCache.size > 1000) flashlight.rayCache.clear();
}

// ═══════════════════════════════════════
//  조명 판정 (유령 · 아이템 · 시야)
// ═══════════════════════════════════════

/** 유령이 손전등 레이에 맞고 있는지 판정한다. */
export function isGhostHitByRay(ghost) {
  const ghostWorldX = ghost.x + mazeOffsetX;
  const ghostWorldY = ghost.y + mazeOffsetY;
  for (const segment of flashlightSegments) {
    const dx = ghostWorldX - segment.startX;
    const dy = ghostWorldY - segment.startY;
    const segmentLength = Math.sqrt(
      (segment.endX - segment.startX) ** 2 + 
      (segment.endY - segment.startY) ** 2
    );
    const rayDirX = (segment.endX - segment.startX) / segmentLength;
    const rayDirY = (segment.endY - segment.startY) / segmentLength;
    const projLength = dx * rayDirX + dy * rayDirY;
    if (projLength < 0 || projLength > segmentLength) continue;
    const perpDist = Math.abs(dx * rayDirY - dy * rayDirX);
    if (perpDist < ghost.size) return true;
  }
  return false;
}

/** 월드 좌표의 포인트가 손전등 레이에 맞는지 판정한다 (아이템용). */
export function isPointHitByRay(worldX, worldY, hitRadius = 20) {
  const pointScreenX = worldX + mazeOffsetX;
  const pointScreenY = worldY + mazeOffsetY;
  
  for (const segment of flashlightSegments) {
    const dx = pointScreenX - segment.startX;
    const dy = pointScreenY - segment.startY;
    const segmentLength = Math.sqrt(
      (segment.endX - segment.startX) ** 2 + 
      (segment.endY - segment.startY) ** 2
    );
    if (segmentLength === 0) continue;
    const rayDirX = (segment.endX - segment.startX) / segmentLength;
    const rayDirY = (segment.endY - segment.startY) / segmentLength;
    const projLength = dx * rayDirX + dy * rayDirY;
    if (projLength < 0 || projLength > segmentLength) continue;
    const perpDist = Math.abs(dx * rayDirY - dy * rayDirX);
    if (perpDist < hitRadius) return true;
  }
  return false;
}

/** 월드 좌표의 포인트가 기본 원형 시야 내에 있는지 판정한다. */
export function isPointInBaseVision(worldX, worldY, radius = 0) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const pointScreenX = worldX + mazeOffsetX;
  const pointScreenY = worldY + mazeOffsetY;
  const dx = pointScreenX - centerX;
  const dy = pointScreenY - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < BASE_VISION_RADIUS + radius;
}

// ═══════════════════════════════════════
//  시야 마스크 (손전등 OFF)
// ═══════════════════════════════════════

/** 손전등 OFF 시 플레이어 주변 원형 시야만 보이게 마스크를 그린다. */
export function drawVisionMask(ctx) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  ctx.save();

  // 화면 전체 불투명 (시야 밖 완전 어둠)
  ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // destination-out: 현재 그리는 영역이 “지워져” 원본 스크린이 보이게 된다
  ctx.globalCompositeOperation = 'destination-out';

  // 부드럽게 페이드되는 원형 시야
  const grad = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, BASE_VISION_RADIUS
  );
  grad.addColorStop(0,   'rgba(0, 0, 0, 1)');  // 중심: 완전 보임
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 1)');  // 60% 까지 선명
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');  // 가장자리: 어둡게 페이드

  ctx.beginPath();
  ctx.arc(centerX, centerY, BASE_VISION_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();
}

// ═══════════════════════════════════════
//  FPS 측정 & wallGrid 내보내기
// ═══════════════════════════════════════

let lastTime   = performance.now();
let frameCount = 0;
let currentFPS = 60;

/** 레이 수 동적 조절용 FPS 측정 */
function getFPS() {
  const now = performance.now();
  frameCount++;
  
  if (now - lastTime >= 1000) {
    currentFPS = frameCount;
    frameCount = 0;
    lastTime = now;
  }
  
  return currentFPS;
}

/** wallGrid 를 외부(충돌 검사)에서 사용할 수 있도록 반환한다. */
export function getWallGrid() {
  return wallGrid;
}