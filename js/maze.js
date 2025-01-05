import { canvas, maze, mazeOffsetX, mazeOffsetY } from './main.js';

export function generateMaze(playerStartCol, playerStartRow, safeZoneRadius) {
  const cols = Math.floor(maze.width / maze.cellSize);
  const rows = Math.floor(maze.height / maze.cellSize);
  const mazeGrid = Array.from({ length: cols }, () => Array(rows).fill(false));
  maze.walls = [];
  maze.exitPath = [];

  // DFS를 사용한 미로 생성
  function dfs(x, y) {
    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];
    
    // 방향을 랜덤하게 섞음
    for (let i = directions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    mazeGrid[x][y] = true;

    for (const [dx, dy] of directions) {
      const newX = x + dx * 2;
      const newY = y + dy * 2;

      if (
        newX > 0 && newX < cols - 1 &&
        newY > 0 && newY < rows - 1 &&
        !mazeGrid[newX][newY]
      ) {
        mazeGrid[x + dx][y + dy] = true;
        dfs(newX, newY);
      }
    }
  }

  // 시작점 설정 (플레이어 위치 근처)
  const startX = Math.floor(cols / 2 + playerStartCol);
  const startY = Math.floor(rows / 2 + playerStartRow);
  
  // 미로 생성 시작
  dfs(startX, startY);

  // 랜덤 크기의 방을 랜덤 개수만큼 생성 (최외각 침범 금지)
  const numberOfRooms = Math.floor(Math.random() * 8) + 3; // 3~10개
  for (let i = 0; i < numberOfRooms; i++) {
    const roomWidth = Math.floor(Math.random() * 3) + 3; // 3~5 셀 너비
    const roomHeight = Math.floor(Math.random() * 3) + 3; // 3~5 셀 높이
    const roomX = Math.floor(Math.random() * (cols - roomWidth - 2)) + 1;
    const roomY = Math.floor(Math.random() * (rows - roomHeight - 2)) + 1;

    // 방이 최외각을 침범하지 않도록 설정
    for (let x = roomX; x < roomX + roomWidth; x++) {
      for (let y = roomY; y < roomY + roomHeight; y++) {
        mazeGrid[x][y] = true;
      }
    }
  }

  // 최외각 벽 설정
  for (let x = 0; x < cols; x++) {
    mazeGrid[x][0] = false;
    mazeGrid[x][rows - 1] = false;
  }
  for (let y = 0; y < rows; y++) {
    mazeGrid[0][y] = false;
    mazeGrid[cols - 1][y] = false;
  }

  // 플레이어 주변 안전 구역 설정
  const safeX = Math.floor(cols / 2);
  const safeY = Math.floor(rows / 2);
  for (let dx = -safeZoneRadius; dx <= safeZoneRadius; dx++) {
    for (let dy = -safeZoneRadius; dy <= safeZoneRadius; dy++) {
      const x = safeX + dx;
      const y = safeY + dy;
      if (x > 0 && x < cols - 1 && y > 0 && y < rows - 1) {
        mazeGrid[x][y] = true;
      }
    }
  }

  // 출구 생성
  let exitX, exitY;
  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);
  do {
    exitX = Math.floor(Math.random() * cols);
    exitY = Math.floor(Math.random() * rows);
  } while (
    !mazeGrid[exitX][exitY] ||
    (exitX === startX && exitY === startY) ||
    (Math.abs(exitX - centerX) < 10 && Math.abs(exitY - centerY) < 10) 
  );

  maze.exit = { x: exitX, y: exitY };

  // 출구 경로 생성
  function carveExitPath(x, y) {
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
        if (carveExitPath(newX, newY)) return true;
        maze.exitPath.pop();
      }
    }
    return false;
  }

  carveExitPath(startX, startY);

  // mazeGrid를 기반으로 walls 배열 생성
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

export function drawMaze(ctx, flashlightOn) { // flashlightOn 변수를 인자로 받음
  ctx.fillStyle = "white";
  maze.walls.forEach((wall) => {
    ctx.fillRect(
      wall.x + mazeOffsetX,
      wall.y + mazeOffsetY,
      wall.width,
      wall.height
    );
  });

  // 출구 경로 그리기
  if (!flashlightOn) {
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

  // 출구 그리기
  if (maze.exit) {
    ctx.fillStyle = "green";
    ctx.fillRect(
      (maze.exit.x - Math.floor(maze.width / maze.cellSize / 2)) * maze.cellSize + mazeOffsetX,
      (maze.exit.y - Math.floor(maze.height / maze.cellSize / 2)) * maze.cellSize + mazeOffsetY,
      maze.cellSize,
      maze.cellSize
    );
  }
}
