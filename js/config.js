/**
 * config.js — 게임 전역 설정 및 캔버스 모듈
 *
 * 캔버스, 미로 크기, 오프셋, 제한 시간 등
 * 게임 전반에서 공유되는 상수·유틸리티를 정의한다.
 */

// ═══════════════════════════════════════
//  캔버스
// ═══════════════════════════════════════
export const canvas = document.getElementById("game-canvas");
export const ctx    = canvas.getContext("2d");

canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

// ═══════════════════════════════════════
//  미로 설정
// ═══════════════════════════════════════
/** 미로 셀 한 변 크기(px) — 모든 거리 계산의 기본 단위 */
export const CELL = 100;

export const maze = {
  width:    100 * CELL,
  height:   100 * CELL,
  cellSize: CELL,
  walls:    [],
  wallGridNeedsUpdate: false,   // 청크 갱신 시 flashlight.js에서 재빌드
};

// ═══════════════════════════════════════
//  카메라 오프셋 (플레이어 중심 스크롤)
// ═══════════════════════════════════════
export let mazeOffsetX = canvas.width  / 2;
export let mazeOffsetY = canvas.height / 2;

/** 카메라(미로 오프셋) 위치를 설정한다. */
export function setMazeOffset(x, y) {
  mazeOffsetX = x;
  mazeOffsetY = y;
}

/** 현재 카메라 오프셋을 반환한다. */
export function getMazeOffset() {
  return { x: mazeOffsetX, y: mazeOffsetY };
}

// ═══════════════════════════════════════
//  게임 규칙
// ═══════════════════════════════════════
/** 생존 모드 제한 시간(초) — 5분 */
export const GAME_TIME_LIMIT = 300;

// ═══════════════════════════════════════
//  캔버스 리사이즈
// ═══════════════════════════════════════
/**
 * 브라우저 리사이즈 시 캔버스 크기를 다시 맞추고
 * 선택적 콜백(onResize)을 실행한다.
 */
export function setupCanvasResize(onResize) {
  window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    if (onResize) onResize();
  });
}
