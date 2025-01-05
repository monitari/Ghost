import { generateMaze, drawMaze } from './maze.js';
import { player, initializePlayer, drawPlayer } from './player.js';
import { flashlight, drawFlashlight, initializeWallGrid, flashlightSegments } from './flashlight.js'; // initializeWallGrid 추가
import { ghosts, createGhosts, drawGhosts } from './createGhosts.js';
import { updateGhosts } from './updateGhosts.js';
import { keys, initializeInput, flashlightOn } from './input.js';

export const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

export const maze = {
  width: 3500,
  height: 3500, // 3500px x 3500px 미로
  cellSize: 100, // 100px x 100px 셀
  walls: [],
};

export let mazeOffsetX = canvas.width / 2;
export let mazeOffsetY = canvas.height / 2;

initializePlayer();
initializeInput(canvas);

let gameRunning = true;
let flashColor = null;
let flashTime = 0;

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 플레이어 이동 (미로 이동)
  let dx = 0;
  let dy = 0;
  if (keys.w) dy = 2;
  if (keys.s) dy = -2;
  if (keys.a) dx = 2;
  if (keys.d) dx = -2;

  const nextX = -mazeOffsetX + canvas.width / 2 - dx;
  const nextY = -mazeOffsetY + canvas.height / 2 - dy;

  if (!checkCollision(nextX, nextY, player, maze)) {
    mazeOffsetX += dx;
    mazeOffsetY += dy;
    flashlight.rayCache.clear(); // 플레이어 이동 시 rayCache 초기화
  }
  
  // 플레이어 실제 좌표 갱신
  player.x = -mazeOffsetX + canvas.width / 2;
  player.y = -mazeOffsetY + canvas.height / 2;
  
  updateGhosts();
  
  // 그리기
  drawMaze(ctx, flashlightOn); // flashlightOn 변수를 전달
  drawPlayer(ctx);
  if (flashlightOn) {
    drawFlashlight(ctx); // player 매개변수 제거
  }
  drawVisibleGhosts(ctx, mazeOffsetX, mazeOffsetY);

  // 플레이어와 유령 충돌 체크
  ghosts.forEach((ghost, index) => {
    const dxGhost = ghost.x - player.x;
    const dyGhost = ghost.y - player.y;
    const distance = Math.sqrt(dxGhost * dxGhost + dyGhost * dyGhost);
    if (distance < player.size + ghost.size) {
      flashColor = ghost.color;
      flashTime = 30; // 화면이 번쩍이는 시간
      ghosts.splice(index, 1); // 유령 소멸
    }
  });

  // 화면 번쩍임 효과
  if (flashTime > 0) {
    ctx.fillStyle = flashColor.replace('0.7', (flashTime / 30).toString());
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashTime--;
  }
  
  if (gameRunning) {
    setTimeout(() => {
      requestAnimationFrame(update);
    }, 1000 / 300); // 300 FPS
  }
}

function drawVisibleGhosts(ctx, mazeOffsetX, mazeOffsetY) {
  ghosts.forEach((ghost) => {
    if (
      ghost.x + mazeOffsetX > 0 &&
      ghost.x + mazeOffsetX < canvas.width &&
      ghost.y + mazeOffsetY > 0 &&
      ghost.y + mazeOffsetY < canvas.height &&
      (flashlightOn ? isGhostHitByRay(ghost) : true) // flashlightOn이 false이면 모든 유령을 보이게 함
    ) {
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
  });
}

function checkCollision(x, y, player, maze) {
  return maze.walls.some((wall) => {
    return (
      x > wall.x - player.colliderSize &&
      x < wall.x + wall.width + player.colliderSize &&
      y > wall.y - player.colliderSize &&
      y < wall.y + wall.height + player.colliderSize
    );
  });
}

function isGhostHitByRay(ghost) {
  const ghostWorldX = ghost.x + mazeOffsetX;
  const ghostWorldY = ghost.y + mazeOffsetY;

  // 유령이 플래시라이트 범위 내에 있는지 검사
  for (const segment of flashlightSegments) {
    const dx = ghostWorldX - segment.startX;
    const dy = ghostWorldY - segment.startY;
    const segmentLength = Math.sqrt(
      (segment.endX - segment.startX) ** 2 + 
      (segment.endY - segment.startY) ** 2
    );
    
    // 광선 방향 벡터
    const rayDirX = (segment.endX - segment.startX) / segmentLength;
    const rayDirY = (segment.endY - segment.startY) / segmentLength;

    // 유령까지의 투영 거리
    const projLength = dx * rayDirX + dy * rayDirY;
    
    if (projLength < 0 || projLength > segmentLength) continue;

    // 광선에서 유령까지의 수직 거리
    const perpDist = Math.abs(dx * rayDirY - dy * rayDirX);
    
    if (perpDist < ghost.size) {
      return true;
    }
  }
  return false;
}

function initializeGame() {
  let stuckInWall = true;
  
  while (stuckInWall) {
    maze.walls = [];
    generateMaze(1, 1, 3);
    // 미로 생성 후 벽 그리드 초기화
    initializeWallGrid(); // 추가된 부분
    console.log("Regenerating maze...");
    
    // 플레이어 위치에서 움직임 테스트
    stuckInWall = checkCollision(player.x, player.y, player, maze);
    
    // WASD 이동 가능 여부 체크
    if (!stuckInWall) {
      stuckInWall =
      checkCollision(player.x - player.colliderSize, player.y, player, maze) &&
      checkCollision(player.x + player.colliderSize, player.y, player, maze) &&
      checkCollision(player.x, player.y - player.colliderSize, player, maze) &&
      checkCollision(player.x, player.y + player.colliderSize, player, maze);
    }
    console.log("1. player.x - player.colliderSize: ", player.x - player.colliderSize, "player.y: ", player.y, "player: ", player, "maze: ", maze);
    console.log("2. player.x + player.colliderSize: ", player.x + player.colliderSize, "player.y: ", player.y, "player: ", player, "maze: ", maze);
    console.log("3. player.x: ", player.x, "player.y - player.colliderSize: ", player.y - player.colliderSize, "player: ", player, "maze: ", maze);
    console.log("4. player.x: ", player.x, "player.y + player.colliderSize: ", player.y + player.colliderSize, "player: ", player, "maze: ", maze);
  }

  player.x = 0;
  player.y = 0;
  mazeOffsetX = canvas.width / 2;
  mazeOffsetY = canvas.height / 2;

  createGhosts();
  update();
}

initializeGame();