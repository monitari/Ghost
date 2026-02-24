/**
 * player.js — 플레이어 상태·렌더링·충돌 모듈
 *
 * 플레이어 위치/크기/디버프 관리, 유령과의 충돌 처리,
 * 화면 중앙에 플레이어 원을 그리는 기능을 제공한다.
 */

import { flashlight } from './flashlight.js';
import { canvas } from './config.js';
import { incrementDebuffCount, incrementHitCount } from './uistats.js';
import { ghosts, createGhosts, fadeOutSplitterFamily } from './createGhosts.js';
import { playSound } from './audio.js';
import { disableFlashlight, hideWarning, immobilizePlayer, confusePlayer, drainBattery } from './input.js';

// ═══════════════════════════════════════
//  플레이어 객체
// ═══════════════════════════════════════
export const player = {
  x: 0,
  y: 0,
  size:         10,
  colliderSize: 10,
  angle:        0,
  debuffs:      [],       // 활성 디버프 배열 [{type, expiresAt}, …]
  isMoving:     false,    // 이동 상태 (환영 유령 속도 계산에 사용)

  /** 유령이 플레이어의 시선(손전등 FOV) 안에 있는지 판정 */
  isLookingAt(ghost) {
    const dx = ghost.x - this.x;
    const dy = ghost.y - this.y;
    const angleToGhost   = Math.atan2(dy, dx);
    const angleDifference = Math.abs(this.angle - angleToGhost);
    return angleDifference < flashlight.fov;
  },
};

// ── 디버프 헬퍼 ──
/** 디버프를 추가하고 통계를 기록한다. */
player.addDebuff = function (debuff) {
  this.debuffs.push(debuff);
  incrementDebuffCount(debuff.type);
};

/** 지정한 타입의 디버프를 모두 제거한다. */
player.removeDebuff = function (debuffType) {
  this.debuffs = this.debuffs.filter(d => d.type !== debuffType);
};

// ═══════════════════════════════════════
//  초기화 · 렌더링
// ═══════════════════════════════════════
export function initializePlayer() {
  player.x = 0;
  player.y = 0;
}

/** 화면 중앙에 흰색 원으로 플레이어를 그린다. */
export function drawPlayer(ctx) {
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, player.size, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();
}

/** 마우스(또는 터치) 좌표로 플레이어 바라보는 각도를 갱신한다. */
export function updatePlayerAngle(mouseX, mouseY) {
  const dx = mouseX - canvas.width  / 2;
  const dy = mouseY - canvas.height / 2;
  player.angle = Math.atan2(dy, dx);
}

// ═══════════════════════════════════════
//  유령 충돌 처리
// ═══════════════════════════════════════

/** 유령 타입 → 디버프 적용 매핑 */
const GHOST_DEBUFF_MAP = {
  charger:    () => disableFlashlight(3000),
  earthBound: () => immobilizePlayer(3000),
  shadow:     () => hideWarning(3000),
  phantom:    () => confusePlayer(4000),
  splitter:   (ghost) => {
    drainBattery(3000);
    if (ghost.familyId) fadeOutSplitterFamily(ghost.familyId);
  },
};

/**
 * 매 프레임 호출 — 플레이어와 겹치는 유령을 감지하여
 * 피격 처리·디버프 적용·효과음 재생을 수행한다.
 * @returns {{ flashColor, flashTime }} 피격 플래시 상태
 */
export function checkPlayerGhostCollision(flashColor, flashTime) {
  // 역순 순회로 splice 시 인덱스 안전
  for (let i = ghosts.length - 1; i >= 0; i--) {
    const ghost = ghosts[i];
    const dx = ghost.x - player.x;
    const dy = player.y - ghost.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < player.size + ghost.size) {
      // ── 플래시 효과 ──
      flashColor = { r: ghost.r, g: ghost.g, b: ghost.b };
      flashTime  = 30;

      // ── 유령 제거 & 리스폰 ──
      const ghostType = ghost.type;
      ghosts.splice(i, 1);
      createGhosts(1, ghostType);

      // ── 효과음 ──
      playSound('sounds/effect/hit.mp3', 1000, 500, 0, 1.0);
      if (ghostType === 'charger' || ghostType === 'shadow') {
        playSound('sounds/player/player-hit-long.mp3', 1000, 500, 0.8, 1.0);
      } else {
        playSound('sounds/player/player-hit-short.mp3', 1000, 500, 0.8, 1.0);
      }

      // ── 디버프 적용 ──
      const applyDebuff = GHOST_DEBUFF_MAP[ghostType];
      if (applyDebuff) applyDebuff(ghost);

      incrementHitCount(ghostType);
    }
  }
  return { flashColor, flashTime };
}