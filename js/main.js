/**
 * main.js — 게임 루프 · 초기화 · 충돌 · 생존 종료
 *
 * requestAnimationFrame 기반 게임 루프(update)를 실행하고,
 * 플레이어 이동 · 충돌 · 디버프 · 배터리 · 렌더링을 오케스트레이션한다.
 */

import { generateMaze, drawMaze } from './maze.js';
import { player, initializePlayer, drawPlayer, checkPlayerGhostCollision } from './player.js';
import { flashlight, drawFlashlight, initializeWallGrid, drawVisionMask, getWallGrid } from './flashlight.js';
import { ghosts, createGhosts, ghostCount, CELL } from './createGhosts.js';
import { updateGhosts, drawVisibleGhosts } from './updateGhosts.js';
import { keys, initializeInput, flashlightOn, debugMode, setFlashlightOn, flashlightWasOnBeforeDisable, getJoystickValues, isMobile, updateBattery, battery, rechargeBattery } from './input.js';
import { stats, loadStatsFromCookies, setCurrentNickname, updateGhostCountDisplay, updateGameTimer, updateDebuffDisplay, showGameClearScreen, saveStatsToCookies, updateBatteryDisplay, showSurvivalEndScreen } from './uistats.js';
import { items, updateItems, drawItems, spawnBatteryItems, scheduleItemSpawn } from './items.js';
import { playWalkSound, stopWalkSound, preloadAllSounds } from './audio.js';
import { canvas, ctx, maze, mazeOffsetX, mazeOffsetY, setMazeOffset, GAME_TIME_LIMIT, setupCanvasResize } from './config.js';
import { gameState, setGameRunning, isGameRunning, setGameStartTime, updateDeltaTime, getDeltaTime, setNickname } from './gameState.js';

// re-export (HTML 인라인 스크립트용)
export { canvas, maze, mazeOffsetX, mazeOffsetY, GAME_TIME_LIMIT, CELL };

// ═══════════════════════════════════════
//  내부 상태 & 초기화
// ═══════════════════════════════════════

/** 피격 플래시 효과 */
let flashColor = null;
let flashTime  = 0;

// 캔버스 리사이즈 시 레이캐시 초기화
setupCanvasResize(() => {
  if (flashlight) flashlight.rayCache.clear();
});

/** 닉네임을 설정하고 게임을 시작한다. */
export function startGame(nickname) {
  setNickname(nickname);
  setCurrentNickname(nickname);
  loadStatsFromCookies(nickname);
  setGameRunning(true);
  setGameStartTime(Date.now());
  initializeGame();
}

// 로딩 화면 failsafe: 10초 후 강제 숨김
setTimeout(() => {
  const ls = document.getElementById('loading-screen');
  if (ls && ls.style.display !== 'none') {
    ls.style.opacity = '0';
    setTimeout(() => { ls.style.display = 'none'; }, 300);
  }
}, 10000);

try {
  initializePlayer();
} catch (error) {
  console.error('플레이어 초기화 중 오류:', error);
}

try {
  initializeInput();
} catch (error) {
  console.error('입력 초기화 중 오류:', error);
}

// ═══════════════════════════════════════
//  게임 루프
// ═══════════════════════════════════════

function update() {
  if (!isGameRunning()) return;

  const deltaTime = updateDeltaTime();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── 플레이어 이동 ──
  let dx = 0, dy = 0;
  const moveSpeed = 2 * deltaTime * 60;    // 60fps 기준 속도
  
  // [디버프] 혼란: 방향 반전
  const isConfused = player.debuffs.some(d => d.type === 'confusion');
  const dirMul     = isConfused ? -1 : 1;

  if (!player.debuffs.some(d => d.type === 'immobilized')) {
    if (isMobile()) {
      const joystick = getJoystickValues();
      dx = -joystick.dx * moveSpeed * dirMul;
      dy = -joystick.dy * moveSpeed * dirMul;
    } else {
      if (keys.w) dy =  moveSpeed * dirMul;
      if (keys.s) dy = -moveSpeed * dirMul;
      if (keys.a) dx =  moveSpeed * dirMul;
      if (keys.d) dx = -moveSpeed * dirMul;
    }
  }

  if (dx !== 0 || dy !== 0) playWalkSound(); else stopWalkSound();
  player.isMoving = (dx !== 0 || dy !== 0);  // 환영 유령용

  // ── 충돌 & 오프셋 갱신 ──
  let currentOffsetX = mazeOffsetX;
  let currentOffsetY = mazeOffsetY;
  
  const nextX = -currentOffsetX + canvas.width  / 2 - dx;
  const nextY = -currentOffsetY + canvas.height / 2 - dy;

  if (!checkCollisionOptimized(nextX, nextY, player)) {
    currentOffsetX += dx;
    currentOffsetY += dy;
    setMazeOffset(currentOffsetX, currentOffsetY);
    flashlight.rayCache.clear();
  }

  player.x = -currentOffsetX + canvas.width  / 2;
  player.y = -currentOffsetY + canvas.height / 2;

  // ── 유령 & 아이템 업데이트 ──
  updateGhosts();
  updateItems();

  // ── 렌더링 ──
  drawMaze(ctx);
  if (flashlightOn) drawFlashlight(ctx);
  if (!debugMode && !flashlightOn) drawVisionMask(ctx);
  drawPlayer(ctx);
  drawItems(ctx, currentOffsetX, currentOffsetY);
  drawVisibleGhosts(ctx, currentOffsetX, currentOffsetY);

  // 피격 플래시
  const collisionResult = checkPlayerGhostCollision(flashColor, flashTime);
  flashColor = collisionResult.flashColor;
  flashTime  = collisionResult.flashTime;

  // ── 시간 제한 체크 (생존 모드) ──
  const elapsedSeconds = Math.floor((Date.now() - gameState.startTime) / 1000);
  if (elapsedSeconds >= GAME_TIME_LIMIT) {
    endSurvivalGame();
    return;
  }

  // ── 디버프 만료 체크 ──
  player.debuffs = player.debuffs.filter(debuff => {
    if (Date.now() > debuff.expiresAt) {
      if (debuff.type === 'flashlightDisabled') setFlashlightOn(flashlightWasOnBeforeDisable);
      return false;
    }
    return true;
  });

  // ── 배터리 & UI 갱신 ──
  updateBattery();

  updateDebuffDisplay();
  updateGhostCountDisplay();
  updateGameTimer();
  updateBatteryDisplay();

  // 피격 플래시 오버레이
  if (flashTime > 0) {
    if (flashColor) {
      ctx.fillStyle = `rgba(${flashColor.r}, ${flashColor.g}, ${flashColor.b}, ${flashTime / 30})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    flashTime--;
  }

  if (isGameRunning()) requestAnimationFrame(update);
}

// ═══════════════════════════════════════
//  충돌 검사 (공간 해싱 최적화)
// ═══════════════════════════════════════

/** wallGrid 기반 3×3 셀 충돌 검사. 그리드 없으면 폴백(전체 벽 순회). */
function checkCollisionOptimized(x, y, player) {
  const wallGrid = getWallGrid();
  if (!wallGrid || wallGrid.size === 0) {
    // 폴백: 전체 벽 검사
    return maze.walls.some((wall) => {
      return (
        x > wall.x - player.colliderSize &&
        x < wall.x + wall.width + player.colliderSize &&
        y > wall.y - player.colliderSize &&
        y < wall.y + wall.height + player.colliderSize
      );
    });
  }
  
  // 그리드 좌표 계산 (무한 미로: 월드 좌표 직접 사용)
  const gridX = Math.floor(x / maze.cellSize);
  const gridY = Math.floor(y / maze.cellSize);
  
  // 주변 셀 검사 (3x3)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = `${gridX + dx},${gridY + dy}`;
      const walls = wallGrid.get(key);
      if (walls) {
        for (const wall of walls) {
          if (
            x > wall.x - player.colliderSize &&
            x < wall.x + wall.width + player.colliderSize &&
            y > wall.y - player.colliderSize &&
            y < wall.y + wall.height + player.colliderSize
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// ═══════════════════════════════════════
//  게임 초기화 & 생존 종료
// ═══════════════════════════════════════

/** 유령·아이템 초기화 후 점점 빨라지는 속도로 유령을 추가 스폰한다. */
function initializeGame() {
  ghosts.length = 0;
  items.length  = 0;
  player.x = 0;
  player.y = 0;
  setMazeOffset(canvas.width / 2, canvas.height / 2);
  createGhosts(100);      // 초기 유령 100체
  spawnBatteryItems(6);   // 초기 필드 배터리
  scheduleItemSpawn();    // 주기적 배터리 스폰

  // 동적 스폰: 처음에는 느리게, 점점 빨라짐 (지수함수)
  // 90% 시점까지 기본 곡선, 이후 극한 스폰
  const SPAWN_THRESHOLD_TIME = GAME_TIME_LIMIT * 0.9;  // 90% 시점
  const INITIAL_INTERVAL = 15000;  // 초기 간격: 15초
  const MIN_INTERVAL = 2000;       // 기본 최소 간격: 2초
  const FINAL_INTERVAL = 500;      // 90% 이후 최소 간격: 0.5초
  const BASE_SPAWN_AMOUNT = 10;    // 기본 스폰량: 10체
  const MAX_SPAWN_AMOUNT = 30;     // 90% 이후 최대 스폰량: 30체

  function scheduleNextSpawn() {
    if (ghosts.length >= ghostCount) return;
    if (!isGameRunning()) return;

    const elapsedSeconds = (Date.now() - gameState.startTime) / 1000;
    
    let currentInterval, spawnAmount;
    
    if (elapsedSeconds < SPAWN_THRESHOLD_TIME) {
      // 0~90%: 지수함수로 간격 감소
      const progress = elapsedSeconds / SPAWN_THRESHOLD_TIME;  // 0 → 1
      const exponentialFactor = 1 - Math.pow(progress, 3);
      currentInterval = MIN_INTERVAL + (INITIAL_INTERVAL - MIN_INTERVAL) * exponentialFactor;
      spawnAmount = BASE_SPAWN_AMOUNT;
    } else {
      // 90% 이후: 극한 스폰 (간격 최소화 + 스폰량 증가)
      const overProgress = (elapsedSeconds - SPAWN_THRESHOLD_TIME) / (GAME_TIME_LIMIT - SPAWN_THRESHOLD_TIME);
      currentInterval = Math.max(FINAL_INTERVAL, MIN_INTERVAL * (1 - overProgress));
      spawnAmount = Math.min(MAX_SPAWN_AMOUNT, BASE_SPAWN_AMOUNT + Math.floor(overProgress * (MAX_SPAWN_AMOUNT - BASE_SPAWN_AMOUNT)));
    }

    setTimeout(() => {
      if (!isGameRunning()) return;
      if (ghosts.length < ghostCount) {
        const actualSpawn = Math.min(spawnAmount, ghostCount - ghosts.length);
        createGhosts(actualSpawn);
      }
      scheduleNextSpawn();
    }, currentInterval);
  }

  scheduleNextSpawn();
  update();
}

/** 생존 모드 종료 — 점수 계산 후 결과 화면을 표시한다. */
function endSurvivalGame() {
  setGameRunning(false);
  stopWalkSound();
  
  const totalHits  = Object.values(stats.hits).reduce((a, b) => a + b, 0);
  const totalKills  = Object.values(stats.kills).reduce((a, b) => a + b, 0);
  const score       = totalKills * 10 - totalHits * 50;  // 처치 ×10 − 피격 ×50
  
  stats.clears++;  // 생존 완료 카운트
  saveStatsToCookies();
  showSurvivalEndScreen(totalHits, totalKills, score);
}

// ═══════════════════════════════════════
//  DOMContentLoaded — 사운드 프리로드 & 초기 렌더
// ═══════════════════════════════════════

/** 사운드 프리로드 후 미로 초기 렌더를 수행한다. */
function drawInitial() {
  generateMaze(1, 1, 3);
  initializeWallGrid();
  drawMaze(ctx, flashlightOn);
  drawFlashlight(ctx);
  drawPlayer(ctx);
}

document.addEventListener('DOMContentLoaded', async () => {
  const loadingScreen = document.getElementById('loading-screen');
  
  try {
    const loadPromise = preloadAllSounds();
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 5000));
    await Promise.race([loadPromise, timeoutPromise]);
  } catch (error) {
    // 사운드 로드 실패 - 무시하고 계속
  }
  
  try {
    drawInitial();
  } catch (error) {
    console.error('미로 초기화 중 오류:', error);
  }
  
  // 로딩 화면 숨기기
  if (loadingScreen) {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 300);
  }
});