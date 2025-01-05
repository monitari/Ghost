import { canvas, maze, mazeOffsetX, mazeOffsetY } from './main.js';

export const flashlight = {
  angle: 0,
  fov: Math.PI / 4, // 각도를 줄임 (45도)
  rayCount: 150,
  maxDistance: 800, // 길이를 늘림
  cellSize: 100,
  rayCache: new Map(), // 레이 캐싱
};

export const flashlightSegments = [];

// 그리드 기반 벽 검사 최적화
const wallGrid = new Map();

// 벽 그리드 초기화 함수 수정
export function initializeWallGrid() {
  wallGrid.clear();
  const cols = Math.floor(maze.width / maze.cellSize);
  const rows = Math.floor(maze.height / maze.cellSize);
  
  maze.walls.forEach(wall => {
    // 벽의 그리드 좌표 계산 (여러 셀에 걸쳐있을 수 있음)
    const startGridX = Math.floor((wall.x + maze.width/2) / flashlight.cellSize);
    const startGridY = Math.floor((wall.y + maze.height/2) / flashlight.cellSize);
    const endGridX = Math.floor((wall.x + wall.width + maze.width/2) / flashlight.cellSize);
    const endGridY = Math.floor((wall.y + wall.height + maze.height/2) / flashlight.cellSize);
    
    // 벽이 걸쳐있는 모든 그리드 셀에 추가
    for (let x = startGridX; x <= endGridX; x++) {
      for (let y = startGridY; y <= endGridY; y++) {
        const key = `${x},${y}`;
        if (!wallGrid.has(key)) {
          wallGrid.set(key, []);
        }
        wallGrid.get(key).push(wall);
      }
    }
  });
}

// 벽과 광선의 충돌 검사 함수 추가
function checkWallCollision(x1, y1, x2, y2, wall) {
  // 실제 월드 좌표로 변환
  const wallX = wall.x + mazeOffsetX;
  const wallY = wall.y + mazeOffsetY;
  
  // 광선의 방향 벡터
  const rayDirX = x2 - x1;
  const rayDirY = y2 - y1;
  
  // 벽의 각 면과 광선의 교차 검사
  const intersections = [];
  
  // 면의 법선 벡터를 이용하여 광선이 닿을 수 있는 면만 검사
  // 상단 면
  if (rayDirY > 0) {
    const hit = lineSegmentIntersection(
      x1, y1, x2, y2,
      wallX, wallY,
      wallX + wall.width, wallY
    );
    if (hit) intersections.push(hit);
  }
  
  // 우측 면
  if (rayDirX < 0) {
    const hit = lineSegmentIntersection(
      x1, y1, x2, y2,
      wallX + wall.width, wallY,
      wallX + wall.width, wallY + wall.height
    );
    if (hit) intersections.push(hit);
  }
  
  // 하단 면
  if (rayDirY < 0) {
    const hit = lineSegmentIntersection(
      x1, y1, x2, y2,
      wallX, wallY + wall.height,
      wallX + wall.width, wallY + wall.height
    );
    if (hit) intersections.push(hit);
  }
  
  // 좌측 면
  if (rayDirX > 0) {
    const hit = lineSegmentIntersection(
      x1, y1, x2, y2,
      wallX, wallY,
      wallX, wallY + wall.height
    );
    if (hit) intersections.push(hit);
  }

  // 가장 가까운 교차점 반환
  if (intersections.length > 0) {
    return intersections.reduce((closest, current) => {
      return (current.distance < closest.distance) ? current : closest;
    });
  }

  return null;
}

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

// DDA 알고리즘 최적화
function castRayDDA(startX, startY, angle) {
  const rayDirX = Math.cos(angle);
  const rayDirY = Math.sin(angle);
  const endX = startX + rayDirX * flashlight.maxDistance;
  const endY = startY + rayDirY * flashlight.maxDistance;
  
  // 플레이어 위치 기준으로 검사할 그리드 범위 계산
  const playerGridX = Math.floor((startX - mazeOffsetX + maze.width/2) / maze.cellSize);
  const playerGridY = Math.floor((startY - mazeOffsetY + maze.height/2) / maze.cellSize);
  
  // 광선 방향에 따라 검사 범위 최적화
  const searchRadius = Math.ceil(flashlight.maxDistance / maze.cellSize);
  const dirX = Math.sign(rayDirX);
  const dirY = Math.sign(rayDirY);
  
  // 광선 방향에 따른 검사 범위 결정
  const startSearchX = dirX >= 0 ? playerGridX : Math.max(0, playerGridX - searchRadius);
  const endSearchX = dirX >= 0 ? Math.min(playerGridX + searchRadius, Math.floor(maze.width / maze.cellSize)) : playerGridX;
  const startSearchY = dirY >= 0 ? playerGridY : Math.max(0, playerGridY - searchRadius);
  const endSearchY = dirY >= 0 ? Math.min(playerGridY + searchRadius, Math.floor(maze.height / maze.cellSize)) : playerGridY;

  let closestHit = null;
  let minDistance = flashlight.maxDistance;

  // 광선 방향으로의 그리드 셀만 검사
  for (let gridX = startSearchX; gridX <= endSearchX; gridX++) {
    for (let gridY = startSearchY; gridY <= endSearchY; gridY++) {
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

// 성능 최적화된 플래시라이트 그리기
export function drawFlashlight(ctx) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // 동적 레이 개수 조정
  const fps = getFPS();
  flashlight.rayCount = Math.max(30, Math.min(60, Math.floor(fps / 2)));
  
  flashlightSegments.length = 0;
  
  ctx.save();
  
  // 어두운 배경 먼저 그리기
  ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 광선 영역을 마스크로 사용
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  
  const angleStep = flashlight.fov / flashlight.rayCount;
  const startAngle = flashlight.angle - flashlight.fov / 2;
  
  let points = [];
  
  for (let i = 0; i <= flashlight.rayCount; i++) {
    const rayAngle = startAngle + angleStep * i;
    
    // 레이 캐싱
    const cacheKey = `${Math.round(rayAngle * 100)}`;
    let rayResult;
    
    if (flashlight.rayCache.has(cacheKey)) {
      rayResult = flashlight.rayCache.get(cacheKey);
    } else {
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
  
  // 다각형 완성
  ctx.lineTo(centerX, centerY);
  ctx.fill();
  
  // 벽에 부딪힌 지점 표시
  ctx.globalCompositeOperation = 'source-over';
  points.forEach(point => {
    if (point.hit) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 150, 0.5)';
      ctx.fill();
    }
  });
  
  // 조명 효과
  ctx.globalCompositeOperation = 'lighter';
  const gradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, flashlight.maxDistance
  );
  gradient.addColorStop(0, 'rgba(255, 255, 150, 0.3)');
  gradient.addColorStop(1, 'rgba(255, 255, 150, 0)');
  
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  points.forEach(point => ctx.lineTo(point.x, point.y));
  ctx.lineTo(centerX, centerY);
  
  ctx.fillStyle = gradient;
  ctx.fill();
  
  ctx.restore();
  
  // 캐시 정리
  if (flashlight.rayCache.size > 1000) {
    flashlight.rayCache.clear();
  }
}

// FPS 모니터링
let lastTime = performance.now();
let frameCount = 0;
let currentFPS = 60;

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