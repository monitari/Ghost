/**
 * items.js — 아이템(배터리) 스폰·획득·렌더링 모듈
 *
 * 필드에 배터리 아이템을 생성하고,
 * 손전등 조명 시 가시화, 플레이어 접촉 시 획득을 처리한다.
 */

import { maze, mazeOffsetX, mazeOffsetY, canvas } from './config.js';
import { player } from './player.js';
import { rechargeBattery } from './input.js';
import { playSound } from './audio.js';
import { isPointHitByRay, isPointInBaseVision } from './flashlight.js';
import { flashlightOn, debugMode } from './input.js';

// ═══════════════════════════════════════
//  아이템 목록 & 상수
// ═══════════════════════════════════════
export const items = [];

const ITEM_FADE_IN_SPEED  = 0.08;
const ITEM_FADE_OUT_SPEED = 0.03;

/** 아이템 타입 정의 */
const itemTypes = {
  battery: {
    type: 'battery',
    color: '#ffdd00',
    size: 15,
    chargeAmount: 40,     // max 200 기준
    emoji: '🔋',
  },
  batteryLarge: {
    type: 'batteryLarge',
    color: '#00ff88',
    size: 18,
    chargeAmount: 80,     // 대형 배터리
    emoji: '⚡',
  }
};

// ═══════════════════════════════════════
//  아이템 생성
// ═══════════════════════════════════════

/** 아이템을 생성하여 items 배열에 추가한다. */
export function createItem(type, x, y) {
  const itemType = itemTypes[type];
  if (!itemType) return null;
  
  const item = {
    ...itemType,
    x,
    y,
    collected: false,
    spawnTime: Date.now(),
    opacity: 0, // 처음에는 보이지 않음
    isLit: false, // 현재 손전등에 비춰지고 있는지
    wasLit: false, // 한 번이라도 비춰졌는지
    litExpiresAt: 0, // 비춰진 후 유지 시간
  };
  
  items.push(item);
  return item;
}

/** 플레이어 주변에 배터리 아이템을 count 개 랜덤 스폰한다. */
export function spawnBatteryItems(count = 10) {
  const spawnRadius = maze.cellSize * 30; // 플레이어 중심 반경
  
  for (let i = 0; i < count; i++) {
    // 플레이어 주변 랜덤 위치
    const angle = Math.random() * Math.PI * 2;
    const distance = maze.cellSize * 8 + Math.random() * (spawnRadius - maze.cellSize * 8);
    const x = player.x + Math.cos(angle) * distance;
    const y = player.y + Math.sin(angle) * distance;
    
    // 벽과 충돌하지 않는 위치인지 확인
    const isWall = maze.walls.some(wall => 
      x >= wall.x - 20 && x <= wall.x + wall.width + 20 &&
      y >= wall.y - 20 && y <= wall.y + wall.height + 20
    );
    
    if (!isWall) {
      // 기존 아이템과 너무 가까운지 확인
      const tooClose = items.some(item => {
        const dx = item.x - x;
        const dy = item.y - y;
        return Math.sqrt(dx * dx + dy * dy) < maze.cellSize * 2;
      });
      
      if (!tooClose) {
        const type = Math.random() < 0.8 ? 'battery' : 'batteryLarge';
        createItem(type, x, y);
      }
    }
  }
}

// ═══════════════════════════════════════
//  아이템 업데이트 (가시성 · 획득)
// ═══════════════════════════════════════

/** 손전등/기본시야에 의한 아이템 투명도 변화를 처리한다. */
function updateItemVisibility(item) {
  const inBaseVision = isPointInBaseVision(item.x, item.y, item.size);
  const hitByRay = flashlightOn && isPointHitByRay(item.x, item.y, item.size + 10);
  
  // 현재 비춰지고 있는지 체크
  item.isLit = hitByRay || inBaseVision;
  
  if (item.isLit) {
    item.wasLit = true;
    item.litExpiresAt = Date.now() + 800; // 비춤 후 0.8초간 유지
    // 페이드 인
    item.opacity = Math.min(item.opacity + ITEM_FADE_IN_SPEED, 1);
  } else if (Date.now() < item.litExpiresAt) {
    // 비춤 유지 시간 중에는 천천히 페이드 아웃
    item.opacity = Math.max(item.opacity - ITEM_FADE_OUT_SPEED * 0.5, 0.3);
  } else {
    // 페이드 아웃
    item.opacity = Math.max(item.opacity - ITEM_FADE_OUT_SPEED, 0);
  }
  
  // 디버그 모드에서는 항상 보임
  if (debugMode) {
    item.opacity = Math.max(item.opacity, 0.3);
  }
}

/** 매 프레임 호출 — 아이템 가시성 + 플레이어 충돌을 처리한다. */
export function updateItems() {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    
    if (item.collected) {
      items.splice(i, 1);
      continue;
    }
    
    // 가시성 업데이트
    updateItemVisibility(item);
    
    // 플레이어와 충돌 체크
    const dx = item.x - player.x;
    const dy = item.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < player.size + item.size) {
      collectItem(item);
    }
  }
}

/** 아이템 획득 시 효과 적용 (배터리 충전 + 효과음). */
function collectItem(item) {
  if (item.type === 'battery' || item.type === 'batteryLarge') {
    rechargeBattery(item.chargeAmount);
    // 배터리 충전 효과음
    playSound('sounds/effect/recharge.mp3', 500, 200, 0, 0.8);
  }
  
  item.collected = true;
}

// ═══════════════════════════════════════
//  렌더링
// ═══════════════════════════════════════

/** 화면에 아이템을 발광 효과와 함께 그린다. */
export function drawItems(ctx, offsetX, offsetY) {
  items.forEach(item => {
    if (item.collected) return;
    
    // opacity가 0이면 그리지 않음
    if (item.opacity <= 0) return;
    
    const screenX = item.x + offsetX;
    const screenY = item.y + offsetY;
    
    // 화면 밖이면 그리지 않음
    if (screenX < -50 || screenX > canvas.width + 50 ||
        screenY < -50 || screenY > canvas.height + 50) {
      return;
    }
    
    // 아이템 그리기 (발광 효과)
    ctx.save();
    
    // 글로우 효과 (opacity에 따라 조절)
    ctx.shadowColor = item.color;
    ctx.shadowBlur = (15 + Math.sin(Date.now() / 200) * 5) * item.opacity;
    
    // 배경 원
    ctx.fillStyle = item.color;
    ctx.globalAlpha = (0.3 + Math.sin(Date.now() / 300) * 0.1) * item.opacity;
    ctx.beginPath();
    ctx.arc(screenX, screenY, item.size + 5, 0, Math.PI * 2);
    ctx.fill();
    
    // 중심 원
    ctx.globalAlpha = 0.9 * item.opacity;
    ctx.beginPath();
    ctx.arc(screenX, screenY, item.size, 0, Math.PI * 2);
    ctx.fill();
    
    // 이모지
    ctx.shadowBlur = 0;
    ctx.globalAlpha = item.opacity;
    ctx.font = `${item.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.emoji, screenX, screenY);
    
    ctx.restore();
  });
}

// ═══════════════════════════════════════
//  주기적 스폰
// ═══════════════════════════════════════

/** 45초마다 아이템 수를 확인하고 부족하면 추가 스폰한다. */
export function scheduleItemSpawn() {
  setInterval(() => {
    // 아이템 개수가 적으면 추가 스폰 (필드 배터리 감소)
    if (items.length < 6) {
      spawnBatteryItems(2);
    }
  }, 45000); // 45초마다 체크
}
