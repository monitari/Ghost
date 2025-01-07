import { generateMaze, drawMaze } from './maze.js';
import { player, initializePlayer, drawPlayer } from './player.js';
import { flashlight, drawFlashlight, initializeWallGrid, isGhostHitByRay } from './flashlight.js';
import { ghosts, createGhosts, ghostCount } from './createGhosts.js';
import { updateGhosts } from './updateGhosts.js';
import { keys, initializeInput, flashlightOn, debugMode, disableFlashlight, flashlightDisabledUntil, setFlashlightOn, flashlightWasOnBeforeDisable } from './input.js';
import { stats, loadStatsFromCookies, saveStatsToCookies, setCurrentNickname, incrementKillCount, incrementHitCount, incrementDebuffCount, showPlayerStats } from './stats.js';

console.log('main.js 로드됨');

// 걷기 소리 재생 함수 추가
let walkSound = null;
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

// 현재 플레이어 닉네임
let currentNickname = '';

// 게임 시작 시 통계 로드
export function startGame(nickname) {
  currentNickname = nickname;
  setCurrentNickname(nickname);
  console.log(`게임을 시작합니다, ${nickname}!`);
  loadStatsFromCookies(nickname);
  gameRunning = true;
  window.gameRunning = gameRunning; // 전역 변수 업데이트
  initializeGame();
}

export const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

export const maze = {
  width: 5000,
  height: 5000,
  cellSize: 100,
  walls: [],
};

export let mazeOffsetX = canvas.width / 2;
export let mazeOffsetY = canvas.height / 2;

initializePlayer();
initializeInput(canvas);

let gameRunning = false; // 게임 시작 전에는 false
window.gameRunning = gameRunning; // 전역 변수로 설정
let flashColor = null;
let flashTime = 0;

function updateDebuffDisplay() {
  const debuffDisplay = document.getElementById('debuff-display');
  debuffDisplay.innerHTML = '';
  player.debuffs.forEach(debuff => {
    const debuffElement = document.createElement('div');
    debuffElement.className = 'debuff';
    debuffElement.innerText = getDebuffName(debuff.type);
    debuffDisplay.appendChild(debuffElement);
  });
}

function getDebuffName(debuffType) {
  switch (debuffType) {
    case 'immobilized':
      return '움직이지 못함';
    case 'flashlightDisabled':
      return '플래시라이트 사용 불가';
    case 'warningHidden':
      return '경고 표시 숨김';
    default:
      return '알 수 없음';
  }
}

// 업데이트 함수 수정: 프레임 속도 제한
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
  
  if (flashlightOn) drawFlashlight(ctx);
  if (!debugMode && !flashlightOn) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  drawPlayer(ctx);
  drawVisibleGhosts(ctx, mazeOffsetX, mazeOffsetY);
  checkPlayerGhostCollision();

  // 미로 출구에 도달했는지 체크
  if (maze.exit) {
    const exitX = maze.exit.x; // maze.cellSize 곱 제거
    const exitY = maze.exit.y; // maze.cellSize 곱 제거
    const exitSize = maze.cellSize;
    
    // 플레이어의 크기를 반영하여 조건 수정
    if (
      player.x + player.size > exitX - exitSize / 2 &&
      player.x - player.size < exitX + exitSize / 2 &&
      player.y + player.size > exitY - exitSize / 2 &&
      player.y - player.size < exitY + exitSize / 2
    ) {
      gameClear();
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

    if (isGhostVisible || ghost.type === 'earthBound') {
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
    if (distance < ghost.warningRange && !isGhostVisible && !player.debuffs.some(debuff => debuff.type === 'warningHidden')) {
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
    const dyGhost = player.y - ghost.y;
    const distance = Math.sqrt(dxGhost * dxGhost + dyGhost * dyGhost);
    if (distance < player.size + ghost.size) {
      flashColor = ghost.color;
      flashTime = 30;
      const ghostType = ghost.type;
      ghosts.splice(index, 1);
      createGhosts(1, ghostType);
      
      playSound('sounds/effect/hit.mp3', 1000, 500, 0, 1.0);
      // 유령 타입에 따라 다른 효과음 재생
      if (ghost.type === 'charger') {
        playSound('sounds/player/player-hit-long.mp3', 1000, 500, 0.8, 1.0);
        disableFlashlight(3000); // 3초간 전등 사용 불가
      } 
      else playSound('sounds/player/player-hit-short.mp3', 1000, 500, 0.8, 1.0);

      if (ghost.type === 'earthBound') {
        player.addDebuff({
          type: 'immobilized',
          expiresAt: Date.now() + 3000 // 3초간 움직이지 못하게 함
        });
      }

      if (ghost.type === 'shadow') {
        player.addDebuff({
          type: 'warningHidden',
          expiresAt: Date.now() + 3000 // 3초간 경고 표시 숨김
        });
      }

      incrementHitCount(ghostType); // 유령 타입별 닿은 횟수 증가
    }
  });
}

function initializeGame() {
  console.log('게임 초기화 시작');
  ghosts.length = 0; // 게임 시작 시 유령 배열 초기화

  player.x = 0;
  player.y = 0;
  mazeOffsetX = canvas.width / 2;
  mazeOffsetY = canvas.height / 2;
  console.log('게임 초기화 완료');

  // 30초 후부터 유령 생성 시작, 10초마다 5마리씩 생성
  setTimeout(() => {
    const spawnInterval = setInterval(() => {
      if (ghosts.length >= ghostCount) {
        clearInterval(spawnInterval);
        return;
      }
      createGhosts(5);
      console.log('유령 5마리 생성됨');
    }, 10000); // 10초마다 실행
  }, 30000); // 30초 후 시작

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
  
  // 로딩 화면 숨기기
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
  
  // 디버프 표시 요소 추가
  const debuffDisplay = document.createElement('div');
  debuffDisplay.id = 'debuff-display';
  debuffDisplay.style.position = 'absolute';
  debuffDisplay.style.top = '10px';
  debuffDisplay.style.left = '10px';
  debuffDisplay.style.color = 'white';
  debuffDisplay.style.fontFamily = 'Arial, sans-serif';
  debuffDisplay.style.fontSize = '16px';
  document.body.appendChild(debuffDisplay);
});

// 게임 클리어 함수 추가
function gameClear() {
  gameRunning = false;
  window.gameRunning = gameRunning; // 전역 변수 업데이트
  stats.clears++; // 클리어 횟수 증가
  saveStatsToCookies(); // 변경 시 저장
  showGameClearScreen(); // 게임 클리어 화면 표시
}

// 게임 클리어 화면 표시 함수 추가
function showGameClearScreen() {
  const overlay = document.getElementById('overlay');
  overlay.innerHTML = `
    <h1>게임 클리어!</h1>
    <p>축하합니다, ${currentNickname}님!</p>
    <p>클리어 횟수: ${stats.clears}</p>
    <button id="restart-button">다시 시작</button>
  `;
  overlay.style.display = 'flex';

  document.getElementById('restart-button').addEventListener('click', () => {
    location.reload();
  });
}

export function playSound(src, duration = 1000, fadeOutDuration = 500, startTime = 0, volume = 1.0) {
  const sound = new Audio(src);
  sound.volume = volume;
  sound.currentTime = startTime;
  sound.play();

  setTimeout(() => {
    const fadeOutInterval = 50;
    const fadeOutStep = sound.volume / (fadeOutDuration / fadeOutInterval);

    const fadeOut = setInterval(() => {
      if (sound.volume > fadeOutStep) {
        sound.volume -= fadeOutStep;
      } else {
        sound.volume = 0;
        sound.pause();
        clearInterval(fadeOut);
      }
    }, fadeOutInterval);
  }, duration);
}