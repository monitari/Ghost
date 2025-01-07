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

export function showPlayerStats() {
  const statsDiv = document.getElementById('player-stats');
  statsDiv.style.display = 'block';
  updatePlayerStats();

  // 게임 통계가 업데이트될 때마다 통계 표시를 갱신하도록 이벤트 리스너 추가
  window.addEventListener('statsUpdated', updatePlayerStats);
}
