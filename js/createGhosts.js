import { maze, mazeOffsetX, mazeOffsetY, canvas } from './main.js';

export const ghosts = [];
export const ghostCount = 250;

const ghostTypes = [
  { type: 'follower', probability: 0.05, color: 'rgba(255, 0, 0, 0.7)', 
    speedMultiplier: 0.7, size: 20, health: 40, visionRange: 1000 },
  { type: 'random', probability: 0.2, color: 'rgba(0, 255, 0, 0.7)', 
    speedMultiplier: 1.0, size: 20, health: 50, visionRange: 300 },
  { type: 'teleporter', probability: 0.1, color: 'rgba(0, 0, 255, 0.7)', 
    speedMultiplier: 1.0, size: 20, health: 20, visionRange: 300 },
  { type: 'weepingAngel', probability: 0.1, color: 'rgba(255, 255, 0, 0.7)', 
    speedMultiplier: 1.5, size: 20, health: 50, visionRange: 500 },
  { type: 'charger', probability: 0.05, color: 'rgba(255, 0, 255, 0.7)', 
    speedMultiplier: 2.0, size: 20, health: 20, visionRange: 400 },
  { type: 'earthBound', probability: 0.5, color: 'rgba(100, 100, 100, 0.7)',
    speedMultiplier: 0, size: 20, health: 20, visionRange: 0 },
];

function spawnGhost(ghostType) {
  const { x, y } = getRandomPosition(ghostType);
  const angle = Math.random() * Math.PI * 2; // 랜덤 방향
  const speed = (Math.random() * 1.0 + 0.5) * ghostType.speedMultiplier;
  const ghost = {
    x,
    y,
    size: ghostType.size,
    dx: Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed,
    type: ghostType.type,
    color: ghostType.color,
    speed: speed,
    lastTeleport: 0,
    opacity: 1,
    fading: false,
    health: ghostType.health, // 기본 체력 설정
    charging: false, // 충전 상태 추가
    cooldown: 0,     // 쿨다운 시간 추가
    visionRange: ghostType.visionRange, // 유령의 시야 범위
    immobile: ghostType.type === 'earthBound', // 지박령은 움직이지 않음
  };
  if (ghostType.type === 'teleporter')
    ghost.teleportInterval = Math.random() * 8000 + 2000; // 2초 ~ 10초
  return ghost;
}

export function createGhosts(count = ghostCount, specificType = null) {
  for (let i = 0; i < count; i++) {
    const ghostType = specificType 
      ? ghostTypes.find(gt => gt.type === specificType) 
      : getRandomGhostType();
    ghosts.push(spawnGhost(ghostType));
  }
}

function getRandomGhostType() {
  const totalProbability = ghostTypes.reduce((acc, gt) => acc + gt.probability, 0);
  const rand = Math.random() * totalProbability;
  let cumulative = 0;
  for (const gt of ghostTypes) {
    cumulative += gt.probability;
    if (rand <= cumulative) return gt;
  }
  return ghostTypes[ghostTypes.length - 1];
}

function getRandomPosition(ghostType) {
  const playerX = -mazeOffsetX + canvas.width / 2;
  const playerY = -mazeOffsetY + canvas.height / 2;
  let x, y;

  do {
    x = Math.random() * maze.width - maze.width / 2;
    y = Math.random() * maze.height - maze.height / 2;
  } while (
    x > playerX - maze.cellSize * 3 && x < playerX + maze.cellSize * 3 &&
    y > playerY - maze.cellSize * 3 && y < playerY + maze.cellSize * 3
  );

  // 지박령은 미로 벽 안에서는 생성되지 않도록 함
  if (ghostType.type === 'earthBound') {
    while (maze.walls.some(wall => 
      x > wall.x && x < wall.x + wall.width &&
      y > wall.y && y < wall.y + wall.height
    )) {
      x = Math.random() * maze.width - maze.width / 2;
      y = Math.random() * maze.height - maze.height / 2;
    }
  }

  return { x, y };
}

export function drawGhosts(ctx, mazeOffsetX, mazeOffsetY) {
  ghosts.forEach((ghost) => {
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
  });
}
