/**
 * maze.js — 청크 기반 무한 미로 생성·관리 모듈
 *
 * 시드 난수로 결정론적 청크를 생성하고,
 * 플레이어 위치에 따라 주변 청크를 동적 로드/해제한다.
 * 7가지 청크 타입: MAZE · ROOM · CORRIDOR_H/V · CROSS · ARENA · SPIRAL
 */

import { debugMode } from './input.js';
import { maze, mazeOffsetX, mazeOffsetY, canvas, CELL } from './config.js';
import { player } from './player.js';

// ═══════════════════════════════════════
//  상수 & 내부 상태
// ═══════════════════════════════════════
const CHUNK_SIZE      = 12;            // 청크 한 변의 셀 수 (12×12)
const RENDER_DISTANCE = 3;             // 렌더링 거리 (청크 단위)
const chunks          = new Map();     // key: "cx,cy" → chunk 객체
let lastPlayerChunkX  = null;
let lastPlayerChunkY  = null;

/** 청크 구조 타입 열거 */
const CHUNK_TYPES = {
  MAZE:       'maze',       // 일반 미로 (DFS)
  ROOM:       'room',       // 큰 방 + 장식 구조물
  CORRIDOR_H: 'corridorH',  // 가로 복도
  CORRIDOR_V: 'corridorV',  // 세로 복도
  CROSS:      'cross',      // 십자 교차로
  ARENA:      'arena',      // 넓은 아레나 (기둥)
  SPIRAL:     'spiral',     // 나선형 구조
};

// ═══════════════════════════════════════
//  시드 기반 난수 & 좌표 유틸
// ═══════════════════════════════════════

/** 시드 → 0~1 결정론적 난수 (청크 재생성 시 일관성 유지). */
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/** 청크 좌표 → 고유 시드 해시. */
function getChunkSeed(chunkX, chunkY) {
  return chunkX * 73856093 ^ chunkY * 19349663;
}

/** 월드 좌표 → 청크 좌표. */
function getChunkCoords(worldX, worldY) {
  const chunkX = Math.floor(worldX / (CHUNK_SIZE * maze.cellSize));
  const chunkY = Math.floor(worldY / (CHUNK_SIZE * maze.cellSize));
  return { chunkX, chunkY };
}

/**
 * 청크 타입 결정 (시드 기반).
 * - 시작 지점(±1) → ARENA
 * - 5칸 배수 교차 → ROOM
 * - 축선 → 복도
 * - 나머지 → 확률 분포
 */
function getChunkType(chunkX, chunkY, random) {
  if (Math.abs(chunkX) <= 1 && Math.abs(chunkY) <= 1) return CHUNK_TYPES.ARENA;

  const absX = Math.abs(chunkX);
  const absY = Math.abs(chunkY);

  // 5칸 격자 교차점 → 큰 방
  if (absX % 5 === 0 && absY % 5 === 0 && (absX > 1 || absY > 1)) return CHUNK_TYPES.ROOM;
  // 축선 → 복도
  if (absY % 5 === 0 && absX % 5 !== 0) return CHUNK_TYPES.CORRIDOR_H;
  if (absX % 5 === 0 && absY % 5 !== 0) return CHUNK_TYPES.CORRIDOR_V;

  // 나머지: 확률적 결정
  const roll = random();
  if (roll < 0.15) return CHUNK_TYPES.CROSS;
  if (roll < 0.25) return CHUNK_TYPES.ARENA;
  if (roll < 0.30) return CHUNK_TYPES.SPIRAL;
  return CHUNK_TYPES.MAZE;
}

// ═══════════════════════════════════════
//  청크 생성 파이프라인
// ═══════════════════════════════════════

/** 단일 청크 생성 후 캐시에 저장. 이미 있으면 캐시 반환. */
function generateChunk(chunkX, chunkY) {
  const key = `${chunkX},${chunkY}`;
  if (chunks.has(key)) return chunks.get(key);
  
  const seed = getChunkSeed(chunkX, chunkY);
  const chunk = {
    x: chunkX,
    y: chunkY,
    walls: [],
    generated: true
  };
  
  // 청크 내 미로 그리드 생성
  const grid = Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(false));
  
  // 기본 미로 구조 생성 (시드 기반)
  generateChunkMaze(grid, seed, chunkX, chunkY);
  
  // 벽 객체로 변환
  const baseX = chunkX * CHUNK_SIZE * maze.cellSize;
  const baseY = chunkY * CHUNK_SIZE * maze.cellSize;
  
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      if (!grid[x][y]) {
        chunk.walls.push({
          x: baseX + x * maze.cellSize,
          y: baseY + y * maze.cellSize,
          width: maze.cellSize,
          height: maze.cellSize,
        });
      }
    }
  }
  
  chunks.set(key, chunk);
  return chunk;
}

/** 청크 그리드를 시드 기반으로 채운다 (타입별 구조 + 경계 연결). */
function generateChunkMaze(grid, seed, chunkX, chunkY) {
  let randomIndex = 0;
  function random() {
    return seededRandom(seed + randomIndex++);
  }
  
  // 청크 타입 결정
  const chunkType = getChunkType(chunkX, chunkY, random);
  
  // 타입에 따라 생성
  switch (chunkType) {
    case CHUNK_TYPES.ROOM:
      createRoom(grid, random);
      break;
    case CHUNK_TYPES.CORRIDOR_H:
      createHorizontalCorridor(grid, random);
      break;
    case CHUNK_TYPES.CORRIDOR_V:
      createVerticalCorridor(grid, random);
      break;
    case CHUNK_TYPES.CROSS:
      createCrossroads(grid, random);
      break;
    case CHUNK_TYPES.ARENA:
      createArena(grid, random);
      break;
    case CHUNK_TYPES.SPIRAL:
      createSpiral(grid, random);
      break;
    case CHUNK_TYPES.MAZE:
    default:
      createMaze(grid, random);
      break;
  }
  
  // 모든 청크에 경계 통로 보장 (연결성 확보)
  ensureBoundaryConnections(grid, random);
}

// ═══════════════════════════════════════
//  구조물 생성 함수 (7종)
// ═══════════════════════════════════════

/** 1. 일반 미로 — Recursive Backtracker (DFS). */
function createMaze(grid, random) {
  const stack = [];
  const startX = Math.floor(random() * (CHUNK_SIZE - 4)) + 2;
  const startY = Math.floor(random() * (CHUNK_SIZE - 4)) + 2;
  
  grid[startX][startY] = true;
  stack.push([startX, startY]);
  
  const directions = [[-2, 0], [2, 0], [0, -2], [0, 2]];
  
  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const validDirs = [];
    
    const shuffled = [...directions].sort(() => random() - 0.5);
    
    for (const [dx, dy] of shuffled) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx > 0 && nx < CHUNK_SIZE - 1 && ny > 0 && ny < CHUNK_SIZE - 1 && !grid[nx][ny]) {
        validDirs.push([dx, dy, nx, ny]);
      }
    }
    
    if (validDirs.length > 0) {
      const [dx, dy, nx, ny] = validDirs[Math.floor(random() * validDirs.length)];
      grid[cx + Math.floor(dx/2)][cy + Math.floor(dy/2)] = true;
      grid[nx][ny] = true;
      stack.push([nx, ny]);
    } else {
      stack.pop();
    }
  }
  
  // 추가 통로 생성 (막힌 곳 방지)
  addExtraPassages(grid, random, 3);
}

/** 2. 큰 방 — 전체 오픈 + 장식용 구조물. */
function createRoom(grid, random) {
  // 전체를 빈 공간으로
  for (let x = 1; x < CHUNK_SIZE - 1; x++) {
    for (let y = 1; y < CHUNK_SIZE - 1; y++) {
      grid[x][y] = true;
    }
  }
  
  // 방 안에 장식용 구조물 추가
  const structures = Math.floor(random() * 3) + 1;
  for (let i = 0; i < structures; i++) {
    const sx = Math.floor(random() * (CHUNK_SIZE - 6)) + 3;
    const sy = Math.floor(random() * (CHUNK_SIZE - 6)) + 3;
    const sw = Math.floor(random() * 2) + 1;
    const sh = Math.floor(random() * 2) + 1;
    
    for (let x = sx; x < sx + sw && x < CHUNK_SIZE - 2; x++) {
      for (let y = sy; y < sy + sh && y < CHUNK_SIZE - 2; y++) {
        grid[x][y] = false; // 벽
      }
    }
  }
}

/** 3. 가로 복도 — 너비 2~3 + 측면 방 (확률). */
function createHorizontalCorridor(grid, random) {
  // 메인 복도 (가로 방향, 너비 2-3)
  const corridorY = Math.floor(CHUNK_SIZE / 2);
  const corridorWidth = Math.floor(random() * 2) + 2;
  
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let w = 0; w < corridorWidth; w++) {
      const y = corridorY - Math.floor(corridorWidth / 2) + w;
      if (y >= 0 && y < CHUNK_SIZE) {
        grid[x][y] = true;
      }
    }
  }
  
  // 측면 방 추가 (확률적)
  if (random() > 0.4) {
    const roomX = Math.floor(random() * (CHUNK_SIZE - 6)) + 2;
    const roomW = Math.floor(random() * 3) + 2;
    const roomH = Math.floor(random() * 2) + 2;
    const roomY = random() > 0.5 ? 1 : CHUNK_SIZE - roomH - 1;
    
    for (let x = roomX; x < roomX + roomW && x < CHUNK_SIZE - 1; x++) {
      for (let y = roomY; y < roomY + roomH; y++) {
        grid[x][y] = true;
      }
      // 복도와 연결
      for (let y = Math.min(roomY + roomH, corridorY); y <= Math.max(roomY, corridorY); y++) {
        grid[x][y] = true;
      }
    }
  }
}

/** 4. 세로 복도 — 너비 2~3 + 측면 방 (확률). */
function createVerticalCorridor(grid, random) {
  const corridorX = Math.floor(CHUNK_SIZE / 2);
  const corridorWidth = Math.floor(random() * 2) + 2;
  
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let w = 0; w < corridorWidth; w++) {
      const x = corridorX - Math.floor(corridorWidth / 2) + w;
      if (x >= 0 && x < CHUNK_SIZE) {
        grid[x][y] = true;
      }
    }
  }
  
  // 측면 방 추가
  if (random() > 0.4) {
    const roomY = Math.floor(random() * (CHUNK_SIZE - 6)) + 2;
    const roomH = Math.floor(random() * 3) + 2;
    const roomW = Math.floor(random() * 2) + 2;
    const roomX = random() > 0.5 ? 1 : CHUNK_SIZE - roomW - 1;
    
    for (let y = roomY; y < roomY + roomH && y < CHUNK_SIZE - 1; y++) {
      for (let x = roomX; x < roomX + roomW; x++) {
        grid[x][y] = true;
      }
      for (let x = Math.min(roomX + roomW, corridorX); x <= Math.max(roomX, corridorX); x++) {
        grid[x][y] = true;
      }
    }
  }
}

/** 5. 십자 교차로 — 가로·세로 통로 교차, 선택적 중앙 기둥. */
function createCrossroads(grid, random) {
  const centerX = Math.floor(CHUNK_SIZE / 2);
  const centerY = Math.floor(CHUNK_SIZE / 2);
  const width = Math.floor(random() * 2) + 2;
  
  // 가로 통로
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let w = -Math.floor(width/2); w <= Math.floor(width/2); w++) {
      if (centerY + w >= 0 && centerY + w < CHUNK_SIZE) {
        grid[x][centerY + w] = true;
      }
    }
  }
  
  // 세로 통로
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let w = -Math.floor(width/2); w <= Math.floor(width/2); w++) {
      if (centerX + w >= 0 && centerX + w < CHUNK_SIZE) {
        grid[centerX + w][y] = true;
      }
    }
  }
  
  // 중앙에 기둥 (선택적)
  if (random() > 0.6) {
    grid[centerX][centerY] = false;
  }
}

/** 6. 아레나 — 전체 오픈 + 그리드 형태 기둥 배치. */
function createArena(grid, random) {
  // 전체를 빈 공간으로
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      grid[x][y] = true;
    }
  }
  
  // 그리드 형태의 기둥 배치
  const pillarSpacing = Math.floor(random() * 2) + 3;
  for (let x = pillarSpacing; x < CHUNK_SIZE - 1; x += pillarSpacing) {
    for (let y = pillarSpacing; y < CHUNK_SIZE - 1; y += pillarSpacing) {
      if (random() > 0.3) {
        grid[x][y] = false;
      }
    }
  }
}

/** 7. 나선형 — 반경 확장 벽 패턴 + 4방향 출입구. */
function createSpiral(grid, random) {
  // 전체를 빈 공간으로
  for (let x = 1; x < CHUNK_SIZE - 1; x++) {
    for (let y = 1; y < CHUNK_SIZE - 1; y++) {
      grid[x][y] = true;
    }
  }
  
  // 나선형 벽 생성
  const centerX = Math.floor(CHUNK_SIZE / 2);
  const centerY = Math.floor(CHUNK_SIZE / 2);
  const direction = random() > 0.5 ? 1 : -1;
  
  // 간단한 나선 패턴
  let angle = 0;
  let radius = 1;
  while (radius < CHUNK_SIZE / 2 - 1) {
    const x = centerX + Math.floor(Math.cos(angle) * radius);
    const y = centerY + Math.floor(Math.sin(angle) * radius);
    
    if (x > 0 && x < CHUNK_SIZE - 1 && y > 0 && y < CHUNK_SIZE - 1) {
      if (random() > 0.3) {
        grid[x][y] = false;
      }
    }
    
    angle += direction * 0.5;
    radius += 0.15;
  }
  
  // 출입구 보장
  grid[1][centerY] = true;
  grid[CHUNK_SIZE - 2][centerY] = true;
  grid[centerX][1] = true;
  grid[centerX][CHUNK_SIZE - 2] = true;
}

// ═══════════════════════════════════════
//  유틸리티 (통로 보장 · 경계 연결)
// ═══════════════════════════════════════

/** 랜덤 위치에 count개 여분 통로를 뚫어 막힌 영역을 방지한다. */
function addExtraPassages(grid, random, count) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(random() * (CHUNK_SIZE - 4)) + 2;
    const y = Math.floor(random() * (CHUNK_SIZE - 4)) + 2;
    grid[x][y] = true;
    
    // 인접 셀도 열기
    if (random() > 0.5 && x + 1 < CHUNK_SIZE - 1) grid[x + 1][y] = true;
    if (random() > 0.5 && y + 1 < CHUNK_SIZE - 1) grid[x][y + 1] = true;
  }
}

/** 청크 4변에 최소 2개씩 경계 통로를 확보하고 내부와 연결한다. */
function ensureBoundaryConnections(grid, random) {
  const passageCount = 2;  // 각 변 최소 통로 수
  
  // 좌측 경계
  let leftPassages = 0;
  for (let y = 1; y < CHUNK_SIZE - 1; y++) {
    if (grid[0][y] && grid[1][y]) leftPassages++;
  }
  while (leftPassages < passageCount) {
    const y = Math.floor(random() * (CHUNK_SIZE - 4)) + 2;
    grid[0][y] = true;
    grid[1][y] = true;
    grid[2][y] = true; // 깊이 추가
    leftPassages++;
  }
  
  // 우측 경계
  let rightPassages = 0;
  for (let y = 1; y < CHUNK_SIZE - 1; y++) {
    if (grid[CHUNK_SIZE - 1][y] && grid[CHUNK_SIZE - 2][y]) rightPassages++;
  }
  while (rightPassages < passageCount) {
    const y = Math.floor(random() * (CHUNK_SIZE - 4)) + 2;
    grid[CHUNK_SIZE - 1][y] = true;
    grid[CHUNK_SIZE - 2][y] = true;
    grid[CHUNK_SIZE - 3][y] = true;
    rightPassages++;
  }
  
  // 상단 경계
  let topPassages = 0;
  for (let x = 1; x < CHUNK_SIZE - 1; x++) {
    if (grid[x][0] && grid[x][1]) topPassages++;
  }
  while (topPassages < passageCount) {
    const x = Math.floor(random() * (CHUNK_SIZE - 4)) + 2;
    grid[x][0] = true;
    grid[x][1] = true;
    grid[x][2] = true;
    topPassages++;
  }
  
  // 하단 경계
  let bottomPassages = 0;
  for (let x = 1; x < CHUNK_SIZE - 1; x++) {
    if (grid[x][CHUNK_SIZE - 1] && grid[x][CHUNK_SIZE - 2]) bottomPassages++;
  }
  while (bottomPassages < passageCount) {
    const x = Math.floor(random() * (CHUNK_SIZE - 4)) + 2;
    grid[x][CHUNK_SIZE - 1] = true;
    grid[x][CHUNK_SIZE - 2] = true;
    grid[x][CHUNK_SIZE - 3] = true;
    bottomPassages++;
  }
  
  connectBoundariesToInterior(grid, random);
}

/** 경계 통로 → 중앙까지 십자 경로를 뚫어 연결성을 보장한다. */
function connectBoundariesToInterior(grid, random) {
  const centerX = Math.floor(CHUNK_SIZE / 2);
  const centerY = Math.floor(CHUNK_SIZE / 2);

  // 좌측 → 중앙
  for (let x = 0; x < centerX; x++) {
    if (grid[x][centerY] === false) {
      grid[x][centerY] = true;
    }
  }
  
  // 우측 → 중앙
  for (let x = CHUNK_SIZE - 1; x > centerX; x--) {
    if (grid[x][centerY] === false) {
      grid[x][centerY] = true;
    }
  }
  
  // 상단 → 중앙
  for (let y = 0; y < centerY; y++) {
    if (grid[centerX][y] === false) {
      grid[centerX][y] = true;
    }
  }
  
  // 하단 → 중앙
  for (let y = CHUNK_SIZE - 1; y > centerY; y--) {
    if (grid[centerX][y] === false) {
      grid[centerX][y] = true;
    }
  }
  
  // 중앙 십자 확보
  grid[centerX][centerY]     = true;
  grid[centerX - 1][centerY] = true;
  grid[centerX + 1][centerY] = true;
  grid[centerX][centerY - 1] = true;
  grid[centerX][centerY + 1] = true;
}

// ═══════════════════════════════════════
//  청크 업데이트 & 벽 재구성
// ═══════════════════════════════════════

/** 플레이어 주변 청크를 로드/해제하고 maze.walls를 갱신한다. */
export function updateChunks() {
  const { chunkX, chunkY } = getChunkCoords(player.x, player.y);
  
  // 청크가 변경되지 않았으면 스킵
  if (chunkX === lastPlayerChunkX && chunkY === lastPlayerChunkY) return;
  
  lastPlayerChunkX = chunkX;
  lastPlayerChunkY = chunkY;
  
  // 주변 청크 생성
  const activeChunks = new Set();
  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    for (let dy = -RENDER_DISTANCE; dy <= RENDER_DISTANCE; dy++) {
      const cx = chunkX + dx;
      const cy = chunkY + dy;
      const key = `${cx},${cy}`;
      activeChunks.add(key);
      generateChunk(cx, cy);
    }
  }
  
  // 멀리 있는 청크 제거
  let chunksChanged = false;
  for (const key of chunks.keys()) {
    if (!activeChunks.has(key)) {
      chunks.delete(key);
      chunksChanged = true;
    }
  }
  
  // maze.walls 갱신
  rebuildWalls();
  
  // 벽 그리드 갱신 플래그 설정 (flashlight.js에서 처리)
  maze.wallGridNeedsUpdate = true;
}

/** 활성 청크의 벽 객체를 합쳐 maze.walls를 재구성한다. */
function rebuildWalls() {
  maze.walls = [];
  for (const chunk of chunks.values()) {
    maze.walls.push(...chunk.walls);
  }
}

// ═══════════════════════════════════════
//  공개 API
// ═══════════════════════════════════════

/** 게임 시작 시 호출 — 청크 캐시 초기화 후 초기 영역을 생성한다. */
export function generateMaze(playerStartCol, playerStartRow, safeZoneRadius) {
  // 청크 초기화
  chunks.clear();
  lastPlayerChunkX = null;
  lastPlayerChunkY = null;
  maze.walls = [];
  maze.exit = null; // 무한 모드에서는 출구 없음
  maze.exitPath = [];
  
  // 초기 청크 생성 (플레이어 주변)
  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    for (let dy = -RENDER_DISTANCE; dy <= RENDER_DISTANCE; dy++) {
      generateChunk(dx, dy);
    }
  }
  
  rebuildWalls();
}

/** 매 프레임 호출 — 청크 업데이트 후 화면에 보이는 벽만 렌더링한다. */
export function drawMaze(ctx) {
  updateChunks();

  // 뷰포트 밖 벽 스킵 (화면 최적화)
  const viewMargin = 100;
  const minX = -mazeOffsetX - viewMargin;
  const maxX = -mazeOffsetX + canvas.width + viewMargin;
  const minY = -mazeOffsetY - viewMargin;
  const maxY = -mazeOffsetY + canvas.height + viewMargin;
  
  ctx.fillStyle = "white";
  maze.walls.forEach((wall) => {
    // 화면 범위 체크
    if (wall.x + wall.width < minX || wall.x > maxX ||
        wall.y + wall.height < minY || wall.y > maxY) {
      return;
    }
    
    ctx.fillRect(
      wall.x + mazeOffsetX,
      wall.y + mazeOffsetY,
      wall.width,
      wall.height
    );
  });
}
