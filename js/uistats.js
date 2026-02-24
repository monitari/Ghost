import { ghosts } from './createGhosts.js';
import { player } from './player.js';
import { battery, getBatteryPercent } from './input.js';
import { GAME_TIME_LIMIT } from './config.js';
import { getGameStartTime, getNickname, setNickname } from './gameState.js';

export const stats = {
  kills: {
    follower: 0,
    random: 0,
    teleporter: 0,
    weepingAngel: 0,
    charger: 0,
    earthBound: 0,
    shadow: 0,
    phantom: 0,
    splitter: 0,
  },
  hits: { // 유령 타입별 닿은 횟수 추가
    follower: 0,
    random: 0,
    teleporter: 0,
    weepingAngel: 0,
    charger: 0,
    earthBound: 0,
    shadow: 0,
    phantom: 0,
    splitter: 0,
  },
  debuffs: { // 디버프 별 획득 횟수 추가
    immobilized: 0,
    flashlightDisabled: 0,
    warningHidden: 0,
    confusion: 0,
    batteryDrain: 0, // 배터리 누전 디버프
  },
  clears: 0, // 게임 클리어 횟수 추가
};

// ═══════════════════════════════════════
//  localStorage 저장 · 로드
// ═══════════════════════════════════════

let saveTimeout  = null;
const SAVE_DEBOUNCE_MS = 2000;  // 저장 디바운스 (2초)

/** 닉네임 기반으로 localStorage에서 통계를 로드한다. */
export function loadStatsFromStorage(nickname) {
  setNickname(nickname);
  const key = `gameStats_${nickname}`;
  
  try {
    const savedData = localStorage.getItem(key);
    if (savedData) {
      const savedStats = JSON.parse(savedData);
      // 저장된 통계로 덮어쓰기
      Object.keys(savedStats).forEach(category => {
        if (typeof stats[category] === 'object' && typeof savedStats[category] === 'object') {
          Object.keys(savedStats[category]).forEach(subCategory => {
            if (stats[category].hasOwnProperty(subCategory)) {
              stats[category][subCategory] = savedStats[category][subCategory];
            }
          });
        } else if (stats.hasOwnProperty(category)) {
          stats[category] = savedStats[category];
        }
      });
    }
  } catch (e) {
    console.error('통계 로드 실패:', e);
  }
}

/** 하위 호환 별칭. */
export function loadStatsFromCookies(nickname) { loadStatsFromStorage(nickname); }

/** 통계를 localStorage에 저장하고 'statsUpdated' 이벤트를 발생시킨다. */
export function saveStatsToStorage() {
  const currentNickname = getNickname();
  if (!currentNickname) return;
  
  const key = `gameStats_${currentNickname}`;
  try {
    localStorage.setItem(key, JSON.stringify(stats));
  } catch (e) {
    console.error('통계 저장 실패:', e);
  }

  // 통계 업데이트 이벤트 발생
  const event = new Event('statsUpdated');
  window.dispatchEvent(event);
}

/** 저장 호출을 2초 디바운스하여 빈번한 I/O를 방지한다. */
function debouncedSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveStatsToStorage();
    saveTimeout = null;
  }, SAVE_DEBOUNCE_MS);
}

/** 하위 호환 별칭 — 디바운스 저장. */
export function saveStatsToCookies() { debouncedSave(); }

export function setCurrentNickname(nickname) { setNickname(nickname); }

// ═══════════════════════════════════════
//  통계 증가 함수
// ═══════════════════════════════════════

/** 처치 획수 +1 + 저장 + 이벤트. */
export function incrementKillCount(ghostType) {
  if (stats.kills.hasOwnProperty(ghostType)) {
    stats.kills[ghostType]++;
    saveStatsToCookies(); // 변경 시 저장
    
    // 통계 업데이트 이벤트 발생
    const event = new Event('statsUpdated');
    window.dispatchEvent(event);
  }
}

/** 피격 획수 +1 + 저장 + 이벤트. */
export function incrementHitCount(ghostType) {
  if (stats.hits.hasOwnProperty(ghostType)) {
    stats.hits[ghostType]++;
    saveStatsToCookies(); // 변경 시 저장
    
    // 통계 업데이트 이벤트 발생
    const event = new Event('statsUpdated');
    window.dispatchEvent(event);
  }
}

/** 디버프 획수 +1 + 저장 + 이벤트. */
export function incrementDebuffCount(debuffType) {
  if (stats.debuffs.hasOwnProperty(debuffType)) {
    stats.debuffs[debuffType]++;
    saveStatsToCookies(); // 변경 시 저장
    
    // 통계 업데이트 이벤트 발생
    const event = new Event('statsUpdated');
    window.dispatchEvent(event);
  }
}

// ═══════════════════════════════════════
//  UI 표시 — 통계 패널
// ═══════════════════════════════════════

/** 유령 이름 매핑 (한국어 표시용). */
const GHOST_NAMES = {
  follower: '팔로워', random: '랜덤', teleporter: '텔레포터',
  weepingAngel: '위핑 엔젤', charger: '차저', earthBound: '어스본드',
  shadow: '그림자', phantom: '환영', splitter: '분열체',
};

/** 유령 색상 매핑 (UI 업데이트용). */
const GHOST_COLORS = {
  follower: '#ff4444', random: '#44ff44', teleporter: '#4444ff',
  weepingAngel: '#ffff44', charger: '#ff44ff', earthBound: '#888888',
  shadow: '#44ffff', phantom: '#c896ff', splitter: '#ff8800',
};

/** 유령 이모지 매핑. */
const GHOST_ICONS = {
  follower: '👣', random: '🎲', teleporter: '⚡',
  weepingAngel: '😭', charger: '🐗', earthBound: '⛰️',
  shadow: '👤', phantom: '🌀', splitter: '💥',
};

/** 디버프 표시 매핑. */
const DEBUFF_INFO = {
  immobilized:       { icon: '🦶', name: '이동불가',    color: '#ff6666' },
  flashlightDisabled:{ icon: '🔦', name: '라이트차단', color: '#8888ff' },
  warningHidden:     { icon: '⚠️',  name: '경고숨김',   color: '#ffaa44' },
  confusion:         { icon: '💫', name: '혼란',       color: '#ff44ff' },
  batteryDrain:      { icon: '🔋', name: '배터리 누전', color: '#44ff88' },
};

/** 숫자 → 비율 바 HTML */
function miniBar(value, max, color) {
  const pct = max > 0 ? Math.min(value / max * 100, 100) : 0;
  return `<div class="stat-mini-bar"><div class="stat-mini-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

/** 통계 패널 HTML을 갱신한다. */
export function updatePlayerStats() {
  const statsContent = document.getElementById('stats-content');
  if (!statsContent) return;

  const totalKills   = Object.values(stats.kills).reduce((a, b) => a + b, 0);
  const totalHits    = Object.values(stats.hits).reduce((a, b) => a + b, 0);
  const totalDebuffs = Object.values(stats.debuffs).reduce((a, b) => a + b, 0);
  const kdRatio      = totalHits > 0 ? (totalKills / totalHits).toFixed(1) : totalKills > 0 ? '∞' : '-';

  let html = '';

  // ── 요약 카드 ──
  html += `<div class="stat-cards">`;
  html += `<div class="stat-card"><div class="stat-card-value" style="color:#44ff44">${totalKills}</div><div class="stat-card-label">처치</div></div>`;
  html += `<div class="stat-card"><div class="stat-card-value" style="color:#ff6666">${totalHits}</div><div class="stat-card-label">피격</div></div>`;
  html += `<div class="stat-card"><div class="stat-card-value" style="color:#ffcc00">${kdRatio}</div><div class="stat-card-label">K/D</div></div>`;
  html += `<div class="stat-card"><div class="stat-card-value" style="color:#4a9eff">${stats.clears}</div><div class="stat-card-label">클리어</div></div>`;
  html += `</div>`;

  // ── 유령별 상세 (통합 테이블) ──
  const maxKill = Math.max(...Object.values(stats.kills), 1);
  const maxHit  = Math.max(...Object.values(stats.hits), 1);
  const hasAnyData = totalKills > 0 || totalHits > 0;

  if (hasAnyData) {
    html += `<div class="stat-category">유령별 상세</div>`;
    html += `<div class="stat-ghost-header">`;
    html += `<span class="sgh-name">유령</span><span class="sgh-col">처치</span><span class="sgh-col">피격</span>`;
    html += `</div>`;

    for (const [type, name] of Object.entries(GHOST_NAMES)) {
      const k = stats.kills[type] || 0;
      const h = stats.hits[type]  || 0;
      if (k === 0 && h === 0) continue;

      html += `<div class="stat-ghost-row">`;
      html += `<span class="sgr-name"><span class="sgr-icon">${GHOST_ICONS[type]}</span><span style="color:${GHOST_COLORS[type]}">${name}</span></span>`;
      html += `<span class="sgr-cell"><span class="sgr-num" style="color:#44ff44">${k}</span>${miniBar(k, maxKill, '#44ff44')}</span>`;
      html += `<span class="sgr-cell"><span class="sgr-num" style="color:#ff6666">${h}</span>${miniBar(h, maxHit, '#ff6666')}</span>`;
      html += `</div>`;
    }
  }

  // ── 디버프 상세 ──
  if (totalDebuffs > 0) {
    html += `<div class="stat-category">디버프</div>`;
    const maxDebuff = Math.max(...Object.values(stats.debuffs), 1);
    for (const [type, info] of Object.entries(DEBUFF_INFO)) {
      const count = stats.debuffs[type] || 0;
      if (count === 0) continue;
      html += `<div class="stat-debuff-row">`;
      html += `<span class="sdr-label">${info.icon} ${info.name}</span>`;
      html += `<span class="sdr-right"><span class="sdr-num" style="color:${info.color}">${count}</span>${miniBar(count, maxDebuff, info.color)}</span>`;
      html += `</div>`;
    }
  }

  statsContent.innerHTML = html;
}

// ═══════════════════════════════════════
//  UI 표시 — HUD (유령 수 · 타이머 · 배터리 · 디버프)
// ═══════════════════════════════════════

/** 현재 유령 수를 표시한다. */
export function updateGhostCountDisplay() {
  const ghostCountDisplay = document.getElementById('ghost-count-display');
  ghostCountDisplay.innerText = `유령: ${ghosts.length}`;
}

/** 남은 시간을 MM:SS 형식으로 표시한다. 30초 이하 시 붉간색 펼스. */
export function updateGameTimer() {
  const gameTimerDisplay = document.getElementById('game-timer');
  const gameStartTime = getGameStartTime();
  const elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
  const remainingTime = Math.max(0, GAME_TIME_LIMIT - elapsedTime);
  const minutes = String(Math.floor(remainingTime / 60)).padStart(2, '0');
  const seconds = String(remainingTime % 60).padStart(2, '0');
  
  // 시간이 적으면 빨간색으로 표시
  if (remainingTime <= 30) {
    gameTimerDisplay.style.color = '#ff4444';
    gameTimerDisplay.style.animation = 'debuffPulse 1s ease-in-out infinite';
  } else if (remainingTime <= 60) {
    gameTimerDisplay.style.color = '#ffaa00';
    gameTimerDisplay.style.animation = '';
  } else {
    gameTimerDisplay.style.color = 'rgba(255, 255, 255, 0.95)';
    gameTimerDisplay.style.animation = '';
  }
  
  gameTimerDisplay.innerText = `⏱️ ${minutes}:${seconds}`;
}

/** 배터리 게이지(fill + 색상 + 충전중/위험 표시)를 갱신한다. */
export function updateBatteryDisplay() {
  const batteryDisplay = document.getElementById('battery-display');
  if (!batteryDisplay) return;
  
  const percent = getBatteryPercent();
  const batteryFill = batteryDisplay.querySelector('.battery-fill');
  const batteryText = batteryDisplay.querySelector('.battery-text');
  const batteryIcon = batteryDisplay.querySelector('.battery-icon');
  
  if (batteryFill) {
    batteryFill.style.width = `${percent}%`;

    // 색상 단계
    if (percent <= 10) {
      batteryFill.style.backgroundColor = '#ff2222';
    } else if (percent <= 20) {
      batteryFill.style.backgroundColor = '#ff4444';
    } else if (percent <= 50) {
      batteryFill.style.backgroundColor = '#ffaa00';
    } else {
      batteryFill.style.backgroundColor = '#44ff44';
    }

    // 충전 중 스트라이프
    batteryFill.classList.toggle('charging', battery.isDepleted);
    // 위험 깜빡임 (10% 이하)
    batteryFill.classList.toggle('battery-critical', percent <= 10 && !battery.isDepleted);
  }

  // 컨테이너 낮은 배터리 글로우
  batteryDisplay.classList.toggle('battery-low', percent <= 20);

  // 아이콘 변경
  if (batteryIcon) {
    if (battery.isDepleted)  batteryIcon.textContent = '⚠️';
    else if (percent <= 20)  batteryIcon.textContent = '🪫';
    else                     batteryIcon.textContent = '🔋';
  }

  if (batteryText) {
    batteryText.innerText = `${percent}%`;
    batteryText.style.color = percent <= 20 ? '#ff6666' : '';
  }
}

/** 활성 디버프 목록을 DOM에 렌더링한다. */
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

/** 디버프 타입 → 한국어 이름 변환. */
export function getDebuffName(debuffType) {
  switch (debuffType) {
    case 'immobilized':
      return '움직이지 못함';
    case 'flashlightDisabled':
      return '플래시라이트 사용 불가';
    case 'warningHidden':
      return '경고 표시 숨김';
    case 'confusion':
      return '혼란 (조작 반전)';
    case 'batteryDrain':
      return '배터리 누전';
    default:
      return '알 수 없음';
  }
}

// ═══════════════════════════════════════
//  통계 패널 · 종료 화면
// ═══════════════════════════════════════

/** 통계 패널을 표시하고 수신 이벤트를 등록한다. */
export function showPlayerStats() {
  const statsDiv = document.getElementById('player-stats');
  statsDiv.style.display = 'block';
  updatePlayerStats();

  // 접기/펼치기 토글
  const header = document.getElementById('stats-header');
  if (header) {
    header.addEventListener('click', () => {
      statsDiv.classList.toggle('collapsed');
    });
  }

  // 게임 통계가 업데이트될 때마다 통계 표시를 갱신하도록 이벤트 리스너 추가
  window.addEventListener('statsUpdated', updatePlayerStats);
}

/** 게임 클리어 화면을 표시한다 (생존 모드 완료). */
export function showGameClearScreen() {
  const overlay = document.getElementById('overlay');
  const currentNickname = getNickname();
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

/** 생존 종료 화면 (처치·피격·점수 + 유령별 상세)을 표시한다. */
export function showSurvivalEndScreen(totalHits, totalKills, score) {
  const overlay = document.getElementById('overlay');
  const currentNickname = getNickname();
  const scoreColor = score >= 0 ? '#44ff44' : '#ff4444';
  const kdRatio = totalHits > 0 ? (totalKills / totalHits).toFixed(1) : totalKills > 0 ? '∞' : '-';

  // 게임 종료 시 즉시 저장 (디바운스 무시)
  saveStatsToStorage();

  // 유령별 상세 행 생성
  let ghostRows = '';
  for (const [type, name] of Object.entries(GHOST_NAMES)) {
    const k = stats.kills[type] || 0;
    const h = stats.hits[type]  || 0;
    if (k === 0 && h === 0) continue;
    ghostRows += `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.08)">
        <td style="padding:4px 8px;text-align:left">
          <span style="margin-right:4px">${GHOST_ICONS[type]}</span>
          <span style="color:${GHOST_COLORS[type]}">${name}</span>
        </td>
        <td style="padding:4px 8px;text-align:center;color:#44ff44">${k}</td>
        <td style="padding:4px 8px;text-align:center;color:#ff6666">${h}</td>
      </tr>`;
  }

  overlay.innerHTML = `
    <h1 style="color:#4a9eff;margin-bottom:16px;">🎮 생존 완료!</h1>
    <div style="background:rgba(0,0,0,0.5);padding:20px;border-radius:12px;margin-bottom:16px;min-width:280px;max-width:360px;">
      <p style="margin:0 0 12px;font-size:18px;text-align:center;">플레이어: <strong>${currentNickname}</strong></p>

      <!-- 요약 카드 -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
        <div style="text-align:center;background:rgba(255,255,255,0.06);border-radius:8px;padding:8px 4px;">
          <div style="font-size:22px;font-weight:bold;color:#44ff44">${totalKills}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.5)">처치</div>
        </div>
        <div style="text-align:center;background:rgba(255,255,255,0.06);border-radius:8px;padding:8px 4px;">
          <div style="font-size:22px;font-weight:bold;color:#ff6666">${totalHits}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.5)">피격</div>
        </div>
        <div style="text-align:center;background:rgba(255,255,255,0.06);border-radius:8px;padding:8px 4px;">
          <div style="font-size:22px;font-weight:bold;color:#ffcc00">${kdRatio}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.5)">K/D</div>
        </div>
        <div style="text-align:center;background:rgba(255,255,255,0.06);border-radius:8px;padding:8px 4px;">
          <div style="font-size:22px;font-weight:bold;color:${scoreColor}">${score}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.5)">점수</div>
        </div>
      </div>
      <p style="margin:0 0 14px;font-size:11px;color:rgba(255,255,255,0.4);text-align:center;">(처치 ×10 − 피격 ×50)</p>

      <!-- 유령별 상세 -->
      ${ghostRows ? `
      <div style="border-top:1px solid rgba(255,255,255,0.15);padding-top:10px;">
        <div style="font-size:11px;color:#4a9eff;font-weight:bold;margin-bottom:6px;">유령별 상세</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse;">
          <tr style="color:rgba(255,255,255,0.4);font-size:10px;">
            <th style="text-align:left;padding:2px 8px;">유령</th>
            <th style="text-align:center;padding:2px 8px;">처치</th>
            <th style="text-align:center;padding:2px 8px;">피격</th>
          </tr>
          ${ghostRows}
        </table>
      </div>` : ''}

      <p style="margin:14px 0 0;color:rgba(255,255,255,0.5);font-size:12px;text-align:center;">🏆 누적 생존: ${stats.clears}회</p>
    </div>
    <button id="restart-button" style="padding:12px 40px;font-size:18px;cursor:pointer;border:none;border-radius:8px;background:linear-gradient(135deg,#4a9eff 0%,#2d7dd2 100%);color:white;">🔄 다시 도전</button>
  `;
  overlay.style.display = 'flex';

  document.getElementById('restart-button').addEventListener('click', () => {
    location.reload();
  });
}

// ═══════════════════════════════════════
//  데이터 초기화
// ═══════════════════════════════════════

/** 모든 닉네임의 통계를 localStorage에서 삭제하고 런타임 stats를 초기화한다. */
export function deleteAllStatsCookies() {
  // localStorage에서 모든 게임 통계 삭제
  const keysToDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('gameStats_')) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => localStorage.removeItem(key));
  
  // 런타임 stats 초기화
  Object.keys(stats.kills).forEach(k   => stats.kills[k] = 0);
  Object.keys(stats.hits).forEach(k    => stats.hits[k] = 0);
  Object.keys(stats.debuffs).forEach(k => stats.debuffs[k] = 0);
  stats.clears = 0;
}