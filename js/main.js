import { generateMaze, drawMaze } from './maze.js';
import { player, initializePlayer, drawPlayer } from './player.js';
import { flashlight, drawFlashlight, initializeWallGrid, flashlightSegments, isGhostHitByRay } from './flashlight.js';
import { ghosts, createGhosts, drawGhosts } from './createGhosts.js';
import { updateGhosts } from './updateGhosts.js';
import { keys, initializeInput, flashlightOn, debugMode, disableFlashlight, flashlightDisabledUntil, setFlashlightOn, flashlightWasOnBeforeDisable } from './input.js';

export const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

export const maze = {
  width: 7000,
  height: 7000,
  cellSize: 100,
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
    flashlight.rayCache.clear();
  }

  player.x = -mazeOffsetX + canvas.width / 2;
  player.y = -mazeOffsetY + canvas.height / 2;

  updateGhosts();

  drawMaze(ctx, flashlightOn);
  
  if (flashlightOn) drawFlashlight(ctx);

  if (!debugMode && !flashlightOn) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  drawPlayer(ctx);
  drawVisibleGhosts(ctx, mazeOffsetX, mazeOffsetY);

  checkPlayerGhostCollision();

  if (flashTime > 0) {
    ctx.fillStyle = flashColor.replace('0.7', (flashTime / 30).toString());
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashTime--;
  }

  // 전등 자동 재활성화
  if (!flashlightOn && Date.now() > flashlightDisabledUntil) {
    setFlashlightOn(flashlightWasOnBeforeDisable); // 이전 상태에 따라 전등 켜기
  }

  if (gameRunning) {
    setTimeout(() => {
      requestAnimationFrame(update);
    }, 1000 / 300);
  }
}

function drawVisibleGhosts(ctx, mazeOffsetX, mazeOffsetY) {
  ghosts.forEach((ghost) => {
    const dx = ghost.x - player.x;
    const dy = ghost.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // debugMode가 활성화 되어 있거나 전등이 켜져 있을 때만 유령이 보이도록 수정
    const isGhostVisible = debugMode 
      ? true 
      : (
          ghost.x + mazeOffsetX > 0 &&
          ghost.x + mazeOffsetX < canvas.width &&
          ghost.y + mazeOffsetY > 0 &&
          ghost.y + mazeOffsetY < canvas.height &&
          flashlightOn && isGhostHitByRay(ghost)
        );

    if (isGhostVisible) {
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

    // 경고 표시 조건 수정
    if (distance < maze.cellSize && !isGhostVisible) {
      ctx.fillStyle = ghost.color;
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', ghost.x + mazeOffsetX, ghost.y + mazeOffsetY);
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

function checkPlayerGhostCollision() {
  ghosts.forEach((ghost, index) => {
    const dxGhost = ghost.x - player.x;
    const dyGhost = ghost.y - player.y;
    const distance = Math.sqrt(dxGhost * dxGhost + dyGhost * dyGhost);
    if (distance < player.size + ghost.size) {
      flashColor = ghost.color;
      flashTime = 30;
      const ghostType = ghost.type;
      ghosts.splice(index, 1);
      createGhosts(1, ghostType);
      if (ghost.type === 'charger') disableFlashlight(3000); // 3초간 전등 사용 불가
    }
  });
}

function initializeGame() {
  let stuckInWall = true;

  while (stuckInWall) {
    maze.walls = [];
    generateMaze(1, 1, 3);
    initializeWallGrid();

    stuckInWall = checkCollision(player.x, player.y, player, maze);

    if (!stuckInWall) {
      stuckInWall =
      checkCollision(player.x - player.colliderSize, player.y, player, maze) &&
      checkCollision(player.x + player.colliderSize, player.y, player, maze) &&
      checkCollision(player.x, player.y - player.colliderSize, player, maze) &&
      checkCollision(player.x, player.y + player.colliderSize, player, maze);
    }
  }

  player.x = 0;
  player.y = 0;
  mazeOffsetX = canvas.width / 2;
  mazeOffsetY = canvas.height / 2;

  createGhosts();
  update();
}

initializeGame();