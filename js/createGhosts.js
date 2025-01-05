import { maze, mazeOffsetX, mazeOffsetY, canvas } from './main.js';
import { player } from './player.js';

export const ghosts = [];
export const ghostCount = 100;

export function createGhosts(count = ghostCount) {
  for (let i = 0; i < count; i++) {
    const type = Math.random();
    let ghostType;
    let color;
    let speed = Math.random() * 1.0 + 0.5; // 0.5에서 1.5 사이의 랜덤 스피드
    let x, y;

    const playerX = -mazeOffsetX + canvas.width / 2;
    const playerY = -mazeOffsetY + canvas.height / 2;

    // 플레이어 위치를 중심으로 500px 이내에 생성하지 않도록 함
    do {
      x = Math.random() * maze.width - maze.width / 2;
      y = Math.random() * maze.height - maze.height / 2;
    } while (
      x > playerX - 250 && x < playerX + 250 &&
      y > playerY - 250 && y < playerY + 250
    );

    if (type < 0.1) {
      ghostType = 'follower';
      color = 'rgba(255, 0, 0, 0.7)'; // 빨간색
      // 기본 dx, dy를 0으로 설정
      ghosts.push({
        x: x,
        y: y,
        size: 20,
        dx: 0,
        dy: 0,
        type: ghostType,
        color: color, 
        speed: speed / 2, // follower는 느리게 움직임
        lastTeleport: 0,
        opacity: 1,
        fading: false,
        health: 50,
      });
    } else if (type < 0.6) {
      ghostType = 'random';
      color = 'rgba(0, 255, 0, 0.7)'; // 초록색
      ghosts.push({
        x: x,
        y: y,
        size: 20,
        dx: (Math.random() - 0.5) * 2,
        dy: (Math.random() - 0.5) * 2,
        type: ghostType,
        color: color,
        speed: speed,
        lastTeleport: 0,
        opacity: 1,
        fading: false,
        health: 50,
      });
    } else if (type < 0.8) {
      ghostType = 'teleporter';
      color = 'rgba(0, 0, 255, 0.7)'; // 파란색
      ghosts.push({
        x: x,
        y: y,
        size: 20,
        dx: (Math.random() - 0.5) * 2,
        dy: (Math.random() - 0.5) * 2,
        type: ghostType,
        color: color,
        speed: speed,
        lastTeleport: 0,
        opacity: 1,
        fading: false,
        health: 50,
        teleportInterval: Math.random() * 58000 + 2000, // 2초에서 1분 사이의 랜덤 텔레포트 간격
      });
    } else {
      ghostType = 'weepingAngel';
      color = 'rgba(255, 255, 0, 0.7)'; // 노란색
      ghosts.push({
        x: x,
        y: y,
        size: 20,
        dx: (Math.random() - 0.5) * 2,
        dy: (Math.random() - 0.5) * 2,
        type: ghostType,
        color: color,
        speed: speed,
        lastTeleport: 0,
        opacity: 1,
        fading: false,
        health: 50,
      });
    }
  }
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
