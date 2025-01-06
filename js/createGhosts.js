import { maze, mazeOffsetX, mazeOffsetY, canvas } from './main.js';
import { player } from './player.js';

export const ghosts = [];
export const ghostCount = 200;

const ghostTypes = [
  { type: 'follower', probability: 0.1, color: 'rgba(255, 0, 0, 0.7)', speedMultiplier: 0.5 },
  { type: 'random', probability: 0.4, color: 'rgba(0, 255, 0, 0.7)', speedMultiplier: 1.0 },
  { type: 'teleporter', probability: 0.2, color: 'rgba(0, 0, 255, 0.7)', speedMultiplier: 1.0 },
  { type: 'weepingAngel', probability: 0.2, color: 'rgba(255, 255, 0, 0.7)', speedMultiplier: 1.0 },
  { type: 'charger', probability: 0.1, color: 'rgba(255, 0, 255, 0.7)', speedMultiplier: 2.0, health: 30 } // 체력 수정
];

export const originalSpeed = 2.0; // 기본 속도 설정
export const speedIncrement = 0.5; // 빗나갈 때마다 증가할 속도

function spawnGhost(ghostType) {
  const { x, y } = getRandomPosition();
  const ghost = {
    x,
    y,
    size: 20,
    dx: (Math.random() - 0.5) * 2,
    dy: (Math.random() - 0.5) * 2,
    type: ghostType.type,
    color: ghostType.color,
    speed: (Math.random() * 1.0 + 0.5) * ghostType.speedMultiplier,
    lastTeleport: 0,
    opacity: 1,
    fading: false,
    health: ghostType.health || 50, // 기본 체력 설정
    charging: false, // 충전 상태 추가
    cooldown: 0,     // 쿨다운 시간 추가
    missCount: 0, // 초기 빗나간 횟수
    originalSpeed: originalSpeed, // 기본 속도
    speedIncrement: speedIncrement, // 속도 증가량
    visionRange: ghostType.type === 'follower' ? Infinity : 500, // follower는 무한 시야
    visionAngle: Math.PI / 4 // 유령의 시야 각도
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
  const rand = Math.random();
  let cumulativeProbability = 0;
  for (const gt of ghostTypes) {
    cumulativeProbability += gt.probability;
    if (rand < cumulativeProbability) return gt;
  }
}

function getRandomPosition() {
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
