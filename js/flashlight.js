import { canvas, maze, mazeOffsetX, mazeOffsetY } from './main.js';

export const flashlight = {
  angle: 0,
  fov: Math.PI / 4,
  rayCount: 60,
  maxDistance: 800,
  rayCache: new Map(),
};

export const flashlightSegments = [];

// 그리드 기반 벽 검사 최적화
const wallGrid = new Map();

export function initializeWallGrid() {
  wallGrid.clear();
  maze.walls.forEach(wall => {
    const startGridX = Math.floor((wall.x + maze.width / 2) / maze.cellSize);
    const startGridY = Math.floor((wall.y + maze.height / 2) / maze.cellSize);
    const endGridX = Math.floor((wall.x + wall.width + maze.width / 2) / maze.cellSize);
    const endGridY = Math.floor((wall.y + wall.height + maze.height / 2) / maze.cellSize);
    
    for (let x = startGridX; x <= endGridX; x++) {
      for (let y = startGridY; y <= endGridY; y++) {
        const key = `${x},${y}`;
        if (!wallGrid.has(key)) wallGrid.set(key, []);
        wallGrid.get(key).push(wall);
      }
    }
  });
}

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

function castRayDDA(startX, startY, angle) {
  const rayDirX = Math.cos(angle);
  const rayDirY = Math.sin(angle);
  const endX = startX + rayDirX * flashlight.maxDistance;
  const endY = startY + rayDirY * flashlight.maxDistance;
  const playerGridX = Math.floor((startX - mazeOffsetX + maze.width / 2) / maze.cellSize);
  const playerGridY = Math.floor((startY - mazeOffsetY + maze.height / 2) / maze.cellSize);
  const searchRadius = Math.ceil(flashlight.maxDistance / maze.cellSize);
  const dirX = Math.sign(rayDirX);
  const dirY = Math.sign(rayDirY);
  const startSearchX = dirX >= 0 ? playerGridX : Math.max(0, playerGridX - searchRadius);
  const endSearchX = dirX >= 0 ? Math.min(playerGridX + searchRadius, Math.floor(maze.width / maze.cellSize)) : playerGridX;
  const startSearchY = dirY >= 0 ? playerGridY : Math.max(0, playerGridY - searchRadius);
  const endSearchY = dirY >= 0 ? Math.min(playerGridY + searchRadius, Math.floor(maze.height / maze.cellSize)) : playerGridY;

  let closestHit = null;
  let minDistance = flashlight.maxDistance;

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

export function drawFlashlight(ctx) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const fps = getFPS();
  flashlight.rayCount = Math.max(30, Math.min(60, Math.floor(fps / 2))); // 최소값을 30으로 조정
  flashlightSegments.length = 0;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
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
  ctx.globalCompositeOperation = 'source-over';
  points.forEach(point => {
    if (point.hit) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1, 0, Math.PI * 2); // 점의 크기를 1로 줄임
      ctx.fillStyle = 'rgba(255, 255, 150, 0.5)';
      ctx.fill();
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