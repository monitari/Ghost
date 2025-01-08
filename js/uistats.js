import { ghosts } from './createGhosts.js';
import { maze, mazeOffsetX, mazeOffsetY, canvas } from './main.js';
import { player } from './player.js';

export const stats = {
  kills: {
    follower: 0,
    random: 0,
    teleporter: 0,
    weepingAngel: 0,
    charger: 0,
    earthBound: 0,
    shadow: 0,
  },
  hits: { // 유령 타입별 닿은 횟수 추가
    follower: 0,
    random: 0,
    teleporter: 0,
    weepingAngel: 0,
    charger: 0,
    earthBound: 0,
    shadow: 0,
  },
  debuffs: { // 디버프 별 획득 횟수 추가
    immobilized: 0,
    flashlightDisabled: 0,
    warningHidden: 0, // 경고 표시 숨김 디버프 횟수 추가
    // 다른 디버프 타입도 여기에 추가
  },
  clears: 0, // 게임 클리어 횟수 추가
};

let currentNickname = '';
let gameStartTime = 0; // 게임 시작 시간

export function setGameStartTime(time) {
  gameStartTime = time;
}

// 쿠키에서 통계 로드 (닉네임 기반)
export function loadStatsFromCookies(nickname) {
  const key = `gameStats_${nickname}`;
  const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
    const [k, v] = cookie.split('=');
    acc[k] = decodeURIComponent(v);
    return acc;
  }, {});
  
  if (cookies[key]) {
    try {
      const savedStats = JSON.parse(cookies[key]);
      // 기존 통계에 저장된 통계를 누적
      Object.keys(savedStats).forEach(category => {
        if (typeof stats[category] === 'object') {
          Object.keys(savedStats[category]).forEach(subCategory => {
            if (stats[category].hasOwnProperty(subCategory)) {
              stats[category][subCategory] += savedStats[category][subCategory];
            } else {
              stats[category][subCategory] = savedStats[category][subCategory];
            }
          });
        } else {
          stats[category] += savedStats[category];
        }
      });
    } catch (e) {
      console.error('통계 로드 실패:', e);
    }
  }
}

// 쿠키에 통계 저장 (닉네임 기반)
export function saveStatsToCookies() {
  if (!currentNickname) return;
  const key = `gameStats_${currentNickname}`;
  const statsString = JSON.stringify(stats);
  document.cookie = `${key}=${encodeURIComponent(statsString)}; path=/; max-age=31536000`; // 1년 유효

  // 통계 업데이트 이벤트 발생
  const event = new Event('statsUpdated');
  window.dispatchEvent(event);
}

export function setCurrentNickname(nickname) {
  currentNickname = nickname;
}

export function incrementKillCount(ghostType) {
  if (stats.kills.hasOwnProperty(ghostType)) {
    stats.kills[ghostType]++;
    saveStatsToCookies(); // 변경 시 저장
    
    // 통계 업데이트 이벤트 발생
    const event = new Event('statsUpdated');
    window.dispatchEvent(event);
  }
}

export function incrementHitCount(ghostType) {
  if (stats.hits.hasOwnProperty(ghostType)) {
    stats.hits[ghostType]++;
    saveStatsToCookies(); // 변경 시 저장
    
    // 통계 업데이트 이벤트 발생
    const event = new Event('statsUpdated');
    window.dispatchEvent(event);
  }
}

// 디버프 횟수 증가 함수 추가
export function incrementDebuffCount(debuffType) {
  if (stats.debuffs.hasOwnProperty(debuffType)) {
    stats.debuffs[debuffType]++;
    saveStatsToCookies(); // 변경 시 저장
    
    // 통계 업데이트 이벤트 발생
    const event = new Event('statsUpdated');
    window.dispatchEvent(event);
  }
}

export function updatePlayerStats() {
  const statsList = document.getElementById('stats-list');
  statsList.innerHTML = `
    <li>킬 수: ${stats.kills.follower + stats.kills.random + stats.kills.teleporter + stats.kills.weepingAngel + stats.kills.charger + stats.kills.earthBound + stats.kills.shadow}</li>
    <li>팔로워 킬: ${stats.kills.follower}</li>
    <li>랜덤 킬: ${stats.kills.random}</li>
    <li>텔레포터 킬: ${stats.kills.teleporter}</li>
    <li>위핑 엔젤 킬: ${stats.kills.weepingAngel}</li>
    <li>차저 킬: ${stats.kills.charger}</li>
    <li>어스본드 킬: ${stats.kills.earthBound}</li>
    <li>그림자 킬: ${stats.kills.shadow}</li>
    <li>닿은 횟수: ${stats.hits.follower + stats.hits.random + stats.hits.teleporter + stats.hits.weepingAngel + stats.hits.charger + stats.hits.earthBound + stats.hits.shadow}</li>
      <ul>
        <li>팔로워: ${stats.hits.follower}</li>
        <li>랜덤: ${stats.hits.random}</li>
        <li>텔레포터: ${stats.hits.teleporter}</li>
        <li>위핑 엔젤: ${stats.hits.weepingAngel}</li>
        <li>차저: ${stats.hits.charger}</li>
        <li>어스본드: ${stats.hits.earthBound}</li>
        <li>그림자: ${stats.hits.shadow}</li>
      </ul>
    </li>
    <li>디버프: 
      <ul>
        <li>움직이지 못함: ${stats.debuffs.immobilized}</li>
        <li>플래시라이트 사용 불가: ${stats.debuffs.flashlightDisabled}</li>
        <li>경고 표시 숨김: ${stats.debuffs.warningHidden}</li>
      </ul>
    </li>
    <li>클리어 횟수: ${stats.clears}</li>
  `;
}

export function updateGhostCountDisplay() {
  const ghostCountDisplay = document.getElementById('ghost-count-display');
  ghostCountDisplay.innerText = `유령 개체수: ${ghosts.length}`;
}

export function updateGameTimer() {
  const gameTimerDisplay = document.getElementById('game-timer');
  const elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
  const minutes = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
  const seconds = String(elapsedTime % 60).padStart(2, '0');
  gameTimerDisplay.innerText = `${minutes}:${seconds}`;
}

export function updateDebuffDisplay() {
  const debuffDisplay = document.getElementById('debuff-display');
  debuffDisplay.innerHTML = '';
  player.debuffs.forEach(debuff => {
    const debuffElement = document.createElement('div');
    debuffElement.className = 'debuff';
    debuffElement.innerText = getDebuffName(debuff.type);
    debuffDisplay.appendChild(debuffElement);
  });
}

export function getDebuffName(debuffType) {
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

const compassImage = new Image();
compassImage.src = 'images/compass-needle.svg';

export function drawArrowToExit(ctx) {
  if (!maze.exit) return;
  const compassSize = 20; // 나침반 크기 조정
  const playerX = canvas.width / 2;
  const playerY = canvas.height / 2;
  const exitX = maze.exit.x + mazeOffsetX;
  const exitY = maze.exit.y + mazeOffsetY;
  const dx = exitX - playerX;
  const dy = exitY - playerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(playerX, playerY - player.size - 20);
  ctx.rotate(angle + Math.PI / 2);
  ctx.translate(-compassSize / 2, -compassSize / 2); // 나침반 중심으로 이동
  ctx.drawImage(compassImage, 0, 0, compassSize, compassSize);
  ctx.restore();

  // ctx.fillStyle = 'white';
  // ctx.font = '16px Arial';
  // ctx.textAlign = 'center';
  // ctx.fillText(`${Math.round(distance)}`, playerX, playerY - player.size - 40);
}

export function showPlayerStats() {
  const statsDiv = document.getElementById('player-stats');
  statsDiv.style.display = 'block';
  updatePlayerStats();

  // 게임 통계가 업데이트될 때마다 통계 표시를 갱신하도록 이벤트 리스너 추가
  window.addEventListener('statsUpdated', updatePlayerStats);
}

export function showGameClearScreen() {
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

export function deleteAllStatsCookies() {
  const cookies = document.cookie.split('; ');
  cookies.forEach(cookie => {
    const [key] = cookie.split('=');
    if (key.startsWith('gameStats_')) {
      document.cookie = `${key}=; path=/; max-age=0`;
    }
  });
}