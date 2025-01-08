import { generateMaze, drawMaze } from './maze.js';
import { player, initializePlayer, drawPlayer, checkPlayerGhostCollision } from './player.js';
import { flashlight, drawFlashlight, initializeWallGrid } from './flashlight.js';
import { ghosts, createGhosts, ghostCount, CELL } from './createGhosts.js';
import { updateGhosts, drawVisibleGhosts } from './updateGhosts.js';
import { keys, initializeInput, flashlightOn, debugMode, flashlightDisabledUntil, setFlashlightOn, flashlightWasOnBeforeDisable } from './input.js';
import { stats, loadStatsFromCookies, setCurrentNickname, updateGhostCountDisplay, updateGameTimer, updateDebuffDisplay, drawArrowToExit, showGameClearScreen, setGameStartTime, saveStatsToCookies } from './uistats.js';

console.log('main.js 로드됨');

let walkSound = null;
let currentNickname = ''; // 현재 플레이어 닉네임

export const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

export const maze = {
  width: 50 * CELL,
  height: 50 * CELL,
  cellSize: CELL,
  walls: [],
};

let gameRunning = false; // 게임 시작 전에는 false
window.gameRunning = gameRunning; // 전역 변수로 설정
let flashColor = null;
let flashTime = 0;

export let mazeOffsetX = canvas.width / 2;
export let mazeOffsetY = canvas.height / 2;

function playWalkSound() {
  if (!walkSound) {
    walkSound = new Audio('sounds/player/walk.mp3');
    walkSound.loop = true;
  }
  if (walkSound.paused) {
    walkSound.play().catch(error => {
      if (error.name !== 'AbortError') console.error('walkSound.play() 오류:', error);
    });
  }
}

function stopWalkSound() {
  if (walkSound && !walkSound.paused) {
    walkSound.pause();
    walkSound.currentTime = 0;
  }
}

export function startGame(nickname) {
  currentNickname = nickname;
  setCurrentNickname(nickname);
  console.log(`게임을 시작합니다, ${nickname}!`);
  loadStatsFromCookies(nickname);
  gameRunning = true;
  window.gameRunning = gameRunning;
  setGameStartTime(Date.now()); // 게임 시작 시간 설정
  initializeGame();
}

initializePlayer();
initializeInput(canvas);

function update() {
  if (!gameRunning) {
    console.log('게임이 실행 중이 아님. 업데이트 중지');
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 플레이어 이동 (미로 이동)
  let dx = 0;
  let dy = 0;
  if (!player.debuffs.some(debuff => debuff.type === 'immobilized')) {
    if (keys.w) dy = 2;
    if (keys.s) dy = -2;
    if (keys.a) dx = 2;
    if (keys.d) dx = -2;
  } else {
    dx = 0;
    dy = 0;
  }

  if (dx !== 0 || dy !== 0) playWalkSound();
  else stopWalkSound();

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
  drawMaze(ctx);
  
  // 플레이어와 출구 간 거리 계산
  let distanceToExit = Infinity;
  if (maze.exit) {
    const dx = player.x - (maze.exit.x + maze.cellSize / 2);
    const dy = player.y - (maze.exit.y + maze.cellSize / 2);
    distanceToExit = Math.sqrt(dx * dx + dy * dy);
  }

  if (flashlightOn) drawFlashlight(ctx);
  if (!debugMode && !flashlightOn && distanceToExit >= maze.cellSize) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  drawPlayer(ctx);
  drawVisibleGhosts(ctx, mazeOffsetX, mazeOffsetY);
  const collisionResult = checkPlayerGhostCollision(flashColor, flashTime);
  flashColor = collisionResult.flashColor;
  flashTime = collisionResult.flashTime;
  drawArrowToExit(ctx);

  // 미로 출구에 도달했는지 체크
  if (maze.exit) {
    const exitX = maze.exit.x;
    const exitY = maze.exit.y;
    const exitSize = maze.cellSize;
    const margin = 20; // 좁아진 경계의 마진

    if (
      player.x + player.size >= exitX + margin &&
      player.x - player.size <= exitX + exitSize - margin &&
      player.y + player.size >= exitY + margin &&
      player.y - player.size <= exitY + exitSize - margin
    ) {
      stats.clears++;
      showGameClearScreen();
      gameRunning = false;
      saveStatsToCookies(); // 클리어 횟수 저장
      return;
    }
  }

  // 디버프 상태 업데이트 및 전등 자동 조절
  player.debuffs.forEach(debuff => {
    if (Date.now() > debuff.expiresAt) {
      player.removeDebuff(debuff.type);
      if (debuff.type === 'flashlightDisabled') setFlashlightOn(flashlightWasOnBeforeDisable); // 이전 상태로 복원
    }
  });

  updateDebuffDisplay(); // 디버프 표시 업데이트
  updateGhostCountDisplay(); // 유령 개체수 표시 업데이트
  updateGameTimer(); // 게임 타이머 업데이트

  if (flashTime > 0) {
    ctx.fillStyle = flashColor.replace('0.7', (flashTime / 30).toString());
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashTime--;
  }

  // 전등 자동 재활성화
  if (!flashlightOn && Date.now() > flashlightDisabledUntil && player.debuffs.length === 0) {
    setFlashlightOn(flashlightWasOnBeforeDisable); // 이전 상태에 따라 전등 켜기
  }

  if (gameRunning) requestAnimationFrame(update); // setTimeout 제거
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

function initializeGame() {
  ghosts.length = 0; // 게임 시작 시 유령 배열 초기화
  player.x = 0;
  player.y = 0;
  mazeOffsetX = canvas.width / 2;
  mazeOffsetY = canvas.height / 2;
  createGhosts(100); // 유령 100마리 생성
  console.log('초기 유령 100마리 생성');

  const spawnInterval = setInterval(() => {
    if (ghosts.length >= ghostCount) {
      clearInterval(spawnInterval);
      return;
    }
    createGhosts(5);
    console.log('유령 5마리 생성');
  }, 10000); // 20초마다 유령 5마리 생성

  update();
}

function drawInitial() {
  generateMaze(1, 1, 3); // 미로 생성
  initializeWallGrid();   // 벽 그리드 초기화
  drawMaze(ctx, flashlightOn);
  drawFlashlight(ctx);    // 전등 그리기 추가
  drawPlayer(ctx);
}

document.addEventListener('DOMContentLoaded', () => {
  drawInitial(); // 초기 미로와 플레이어 그리기
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) loadingScreen.style.display = 'none';
});

export function playSound(src, duration = 1000, fadeOutDuration = 500, startTime = 0, volume = 1.0, interruptible = false) {
  const sound = new Audio(src);
  sound.volume = volume;
  sound.currentTime = startTime;
  sound.play();

  if (interruptible) {
    setTimeout(() => {
      const fadeOutStep = sound.volume / (fadeOutDuration / 50);
      const fadeOut = setInterval(() => {
        if (sound.volume > fadeOutStep) {
          sound.volume -= fadeOutStep;
        } else {
          sound.volume = 0;
          sound.pause();
          clearInterval(fadeOut);
        }
      }, 50);
    }, duration + fadeOutDuration);
  } else {
    setTimeout(() => {
      const fadeOutStep = sound.volume / (fadeOutDuration / 50);
      const fadeOut = setInterval(() => {
        if (sound.volume > fadeOutStep) {
          sound.volume -= fadeOutStep;
        } else {
          sound.volume = 0;
          sound.pause();
          clearInterval(fadeOut);
        }
      }, 50);
    }, duration + fadeOutDuration);
  }
}