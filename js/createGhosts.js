import { maze, mazeOffsetX, mazeOffsetY, canvas } from './main.js';

export const ghosts = [];
export const ghostCount = 500;
export const CELL = 100; // 미로 셀 크기 상수

const ghostTypes = [
  { type: 'follower', probability: 0.02, color: 'rgba(255, 0, 0, 0.7)', 
    speed: 1.0, size: 20, health: 60, visionRange: Infinity, warningRange: 1.5 * CELL },
  { type: 'random', probability: 0.5, color: 'rgba(0, 255, 0, 0.7)', 
    speed: 1.5, size: 20, health: 50, visionRange: 3 * CELL, warningRange: CELL },
  { type: 'teleporter', probability: 0.2, color: 'rgba(0, 0, 255, 0.7)', 
    speed: 3.0, size: 20, health: 40, visionRange: 3 * CELL, warningRange: CELL },
  { type: 'weepingAngel', probability: 0.15, color: 'rgba(255, 255, 0, 0.7)', 
    speed: 2.5, size: 20, health: 30, visionRange: 5 * CELL, warningRange: 1.5 * CELL },
  { type: 'charger', probability: 0.03, color: 'rgba(255, 0, 255, 0.7)', 
    speed: 4.0, size: 20, health: 20, visionRange: 4 * CELL, warningRange: 4 * CELL },
  { type: 'earthBound', probability: 0.3, color: 'rgba(50, 50, 50, 0.7)', 
    speed: 0, size: 20, health: Infinity, visionRange: 0, warningRange: 1.5 * CELL },
  { type: 'shadow', probability: 0.1, color: 'rgba(0, 255, 255, 0.7)', 
    speed: 5.0, size: 20, health: 50, visionRange: 5 * CELL, warningRange: 6 * CELL },
];

function spawnGhost(ghostType) {
  const { x, y } = getRandomPosition(ghostType);
  const angle = Math.random() * Math.PI * 2;
  const speed = ghostType.speed;
  const ghost = {
    x,
    y,
    size: ghostType.size,
    dx: Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed,
    type: ghostType.type,
    color: ghostType.color,
    speed,
    lastTeleport: 0,
    opacity: 1,
    fading: false,
    health: ghostType.health,
    charging: false,
    cooldown: 0,
    visionRange: ghostType.visionRange,
    warningRange: ghostType.warningRange,
    immobile: ghostType.type === 'earthBound',
  };
  if (ghostType.type === 'teleporter') ghost.teleportInterval = Math.random() * 6000 + 2000;
  return ghost;
}

export function createGhosts(count = ghostCount, specificType = null) {
  for (let i = 0; i < count; i++) {
    const ghostType = specificType ? ghostTypes.find(gt => gt.type === specificType) : getRandomGhostType();
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
    x > playerX - maze.cellSize * 5 && x < playerX + maze.cellSize * 5 &&
    y > playerY - maze.cellSize * 5 && y < playerY + maze.cellSize * 5
  );

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
