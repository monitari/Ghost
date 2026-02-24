/**
 * gameState.js — 게임 상태 중앙 관리 모듈
 *
 * 실행·일시정지·프레임 시간 등 전역 게임 상태를 한 곳에서 관리하여
 * 순환 의존성을 방지한다.
 */

// ═══════════════════════════════════════
//  상태 객체
// ═══════════════════════════════════════
export const gameState = {
  running:       false,
  paused:        false,
  startTime:     0,
  lastFrameTime: 0,
  deltaTime:     0,       // 프레임 간 경과 시간(초)
  nickname:      '',
};

// ═══════════════════════════════════════
//  게임 실행 상태
// ═══════════════════════════════════════
export function setGameRunning(value) { gameState.running = value; }
export function isGameRunning()       { return gameState.running && !gameState.paused; }
export function setGamePaused(value)  { gameState.paused = value; }

// ═══════════════════════════════════════
//  시작 시간 / 닉네임
// ═══════════════════════════════════════
export function setGameStartTime(time) { gameState.startTime = time; }
export function getGameStartTime()     { return gameState.startTime; }
export function setNickname(name)      { gameState.nickname = name; }
export function getNickname()          { return gameState.nickname; }

// ═══════════════════════════════════════
//  Delta-Time (프레임 독립 로직)
// ═══════════════════════════════════════
/**
 * 매 프레임 시작 시 호출하여 deltaTime(초)을 갱신한다.
 * 최대 100 ms 로 클램프하여 탭 비활성 후 복귀 시 튀는 것을 방지한다.
 * @returns {number} 이번 프레임의 deltaTime(초)
 */
export function updateDeltaTime() {
  const now = performance.now();
  if (gameState.lastFrameTime === 0) {
    gameState.lastFrameTime = now;
    gameState.deltaTime = 1 / 60;               // 첫 프레임: 60 fps 가정
  } else {
    gameState.deltaTime = Math.min((now - gameState.lastFrameTime) / 1000, 0.1);
    gameState.lastFrameTime = now;
  }
  return gameState.deltaTime;
}

/** 현재 deltaTime(초)을 반환한다. */
export function getDeltaTime() {
  return gameState.deltaTime;
}

// ═══════════════════════════════════════
//  리셋
// ═══════════════════════════════════════
/** 게임 상태를 초기값으로 되돌린다. */
export function resetGameState() {
  gameState.running       = false;
  gameState.paused        = false;
  gameState.startTime     = 0;
  gameState.lastFrameTime = 0;
  gameState.deltaTime     = 0;
}
