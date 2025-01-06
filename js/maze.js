import { debugMode } from './input.js';
import { maze, mazeOffsetX, mazeOffsetY } from './main.js';

export function generateMaze(playerStartCol, playerStartRow, safeZoneRadius) {
  const cols = Math.floor(maze.width / maze.cellSize);
  const rows = Math.floor(maze.height / maze.cellSize);
  const mazeGrid = Array.from({ length: cols }, () => Array(rows).fill(false));
  maze.walls = [];
  maze.exitPath = [];

  function dfs(x, y) {
    const directions = [ [-1, 0], [1, 0], [0, -1], [0, 1] ];
    
    // 방향을 랜덤하게 섞어 미로의 다양성 증대
    for (let i = directions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    mazeGrid[x][y] = true;

    for (const [dx, dy] of directions) {
      const newX = x + dx * 2;
      const newY = y + dy * 2;

      if (newX > 0 && newX < cols - 1 && newY > 0 && newY < rows - 1 
        && !mazeGrid[newX][newY]) {
        mazeGrid[x + dx][y + dy] = true;
        dfs(newX, newY); // 재귀 호출로 미로 확장
      }
    }
  }

  const startX = Math.floor(cols / 2 + playerStartCol);
  const startY = Math.floor(rows / 2 + playerStartRow);
  dfs(startX, startY);

  createRandomRooms(mazeGrid, cols, rows);
  createOuterWalls(mazeGrid, cols, rows);
  createSafeZone(mazeGrid, cols, rows, safeZoneRadius);
  createExit(mazeGrid, cols, rows, startX, startY);

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      if (!mazeGrid[x][y]) {
        maze.walls.push({
          x: (x - Math.floor(cols / 2)) * maze.cellSize,
          y: (y - Math.floor(rows / 2)) * maze.cellSize,
          width: maze.cellSize,
          height: maze.cellSize,
        });
      }
    }
  }
}

function createRandomRooms(mazeGrid, cols, rows) {
  const numberOfRooms = Math.floor(Math.random() * 8) + 3;
  for (let i = 0; i < numberOfRooms; i++) {
    const roomWidth = Math.floor(Math.random() * 3) + 3;
    const roomHeight = Math.floor(Math.random() * 3) + 3;
    const roomX = Math.floor(Math.random() * (cols - roomWidth - 2)) + 1;
    const roomY = Math.floor(Math.random() * (rows - roomHeight - 2)) + 1;

    for (let x = roomX; x < roomX + roomWidth; x++) {
      for (let y = roomY; y < roomY + roomHeight; y++) mazeGrid[x][y] = true;
    }
  }
}

function createOuterWalls(mazeGrid, cols, rows) {
  for (let x = 0; x < cols; x++) {
    mazeGrid[x][0] = false;
    mazeGrid[x][rows - 1] = false;
  }
  for (let y = 0; y < rows; y++) {
    mazeGrid[0][y] = false;
    mazeGrid[cols - 1][y] = false;
  }
}

function createSafeZone(mazeGrid, cols, rows, safeZoneRadius) {
  const safeX = Math.floor(cols / 2);
  const safeY = Math.floor(rows / 2);
  for (let dx = -safeZoneRadius; dx <= safeZoneRadius; dx++) {
    for (let dy = -safeZoneRadius; dy <= safeZoneRadius; dy++) {
      const x = safeX + dx;
      const y = safeY + dy;
      if (x > 0 && x < cols - 1 && y > 0 && y < rows - 1) mazeGrid[x][y] = true;
    }
  }
}

function createExit(mazeGrid, cols, rows, startX, startY) {
  let exitX, exitY;
  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);
  do {
    exitX = Math.floor(Math.random() * cols);
    exitY = Math.floor(Math.random() * rows);
  } 
  while (!mazeGrid[exitX][exitY] || (exitX === startX && exitY === startY) ||
    (Math.abs(exitX - centerX) < 10 && Math.abs(exitY - centerY) < 10));

  // 출구 좌표를 월드 좌표로 변환
  maze.exit = { 
    x: (exitX - Math.floor(cols / 2)) * maze.cellSize, 
    y: (exitY - Math.floor(rows / 2)) * maze.cellSize 
  };
  
  carveExitPath(mazeGrid, startX, startY, exitX, exitY, cols, rows);
}

function carveExitPath(mazeGrid, startX, startY, exitX, exitY, cols, rows) {
  function carve(x, y) {
    if (x === exitX && y === exitY) return true;

    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];

    for (const [dx, dy] of directions) {
      const newX = x + dx;
      const newY = y + dy;

      if (
        newX >= 0 && newX < cols &&
        newY >= 0 && newY < rows &&
        mazeGrid[newX][newY] &&
        !maze.exitPath.some(cell => cell.x === newX && cell.y === newY)
      ) {
        maze.exitPath.push({ x: newX, y: newY });
        if (carve(newX, newY)) return true;
        maze.exitPath.pop();
      }
    }
    return false;
  }

  carve(startX, startY);
}

export function drawMaze(ctx) {
  ctx.fillStyle = "white";
  maze.walls.forEach((wall) => {
    ctx.fillRect(
      wall.x + mazeOffsetX,
      wall.y + mazeOffsetY,
      wall.width,
      wall.height
    );
  });

  if (debugMode) {
    ctx.fillStyle = "gray";
    maze.exitPath.forEach((cell) => {
      ctx.fillRect(
        (cell.x - Math.floor(maze.width / maze.cellSize / 2)) * maze.cellSize + mazeOffsetX,
        (cell.y - Math.floor(maze.height / maze.cellSize / 2)) * maze.cellSize + mazeOffsetY,
        maze.cellSize,
        maze.cellSize
      );
    });
  }

  if (maze.exit) {
    ctx.fillStyle = "red";
    ctx.fillRect(
      maze.exit.x + mazeOffsetX,
      maze.exit.y + mazeOffsetY,
      maze.cellSize,
      maze.cellSize
    );
  }
}
