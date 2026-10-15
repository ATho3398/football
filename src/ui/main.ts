// 1단계 웹 UI (B.7): 모바일 세로 단일 컬럼, 프레임워크 없이 문자열 렌더링 + 이벤트 위임

import {
  ATTRIBUTE_GROUPS, ATTRIBUTE_NAMES_KO, FIELD_ATTRIBUTES, GROUP_NAMES, type AttributeGroup, type FieldAttribute,
} from '../attributes';
import { BALANCE, type Difficulty } from '../config/balance';
import {
  averageRating, careerTotals, newGame, nextFixture, playRound, retire, selectableRealPlayers, startNextSeason,
  type GameState,
} from '../game';
import { FORM_ICONS, FORM_NAMES_KO, formBonus, formLevel } from '../form';
import { generatePlayer } from '../generate';
import { INJURY_NAMES_KO } from '../injury';
import {
  autoAllocate, costTier, nextReputationTier, playerOvr, pointCost, raiseAttribute, raiseBlock, reputationTier, xpToLevel,
  skillTier, TIER_NAMES_KO, type AttributeDelta,
} from '../growth';
import { sortedTable, teamById } from '../league';
import { npcOvr } from '../npc';
import {
  allPositionOvrs, attributeOvrWeight, PLAYABLE_POSITIONS, POSITION_NAMES_KO, positionOvr, positionOvrExact, profileOf,
  type PlayablePosition,
} from '../positions';
import { deleteSave, listSaves, loadGame, SAVE_SLOTS, saveGame, type SaveSlot } from '../save';
import { saveStartNotice, versionLabel } from '../version';
import type { Tier } from '../types';
import { matchSummaryView } from './views/matchSummary';
import { ReplayPlayer, replayView } from './views/replay';
import { avgMapView, drawAvgMap } from './views/avgMap';

type Screen =
  | 'title' | 'new' | 'home' | 'match' | 'replay' | 'allocate' | 'player' | 'table' | 'stars' | 'season' | 'saves' | 'retired';

const GROUP_NAMES_KO: Record<AttributeGroup, string> = {
  ballHandling: '볼 다루기', finishing: '마무리', passing: '패스·시야', defending: '수비',
  pace: '스피드·민첩', physical: '피지컬', mental: '멘탈',
};

const ui = {
  screen: 'title' as Screen,
  game: null as GameState | null,
  toast: '' as string,
  coachComment: false,
  /** 시즌 자동 진행 중 */
  busy: false,
  /** 방금 치른 내 경기 재생 (E5-lite). 세이브에 담지 않는다 */
  replay: null as ReplayPlayer | null,
  /** 포인트 화면에 들어올 때의 OVR (소수). "OVR 현재 → 예상" 미리보기 기준 */
  allocStartOvr: 0,
  form: {
    mode: 'prospect' as 'prospect' | 'real',
    name: '',
    position: 'ST' as PlayablePosition,
    seed: '',
    difficulty: 'normal' as Difficulty,
    realId: '',
  },
};

const app = document.getElementById('app')!;

// ── 유틸 ──

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const tierBadge = (t: Tier, prefix = '') => `<span class="tier tier-${t}">${prefix}${TIER_NAMES_KO[t]}</span>`;
const seasonLabel = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const deltaClass = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : 'muted');

function teamName(id: string): string {
  return ui.game ? teamById(ui.game.league, id).nameKo : id;
}

function autosave(): void {
  if (ui.game) saveGame('auto', ui.game);
}

function go(screen: Screen): void {
  ui.screen = screen;
  render();
  window.scrollTo(0, 0);
}

function showToast(msg: string): void {
  ui.toast = msg;
  render();
  setTimeout(() => {
    if (ui.toast === msg) {
      ui.toast = '';
      render();
    }
  }, 1800);
}

// ── 화면 ──

function titleView(): string {
  const auto = listSaves()[0];
  return `
    <h1>⚽ 축구 커리어</h1>
    <div class="card">
      <p class="muted">17세 유망주 또는 2018년 실제 선수로 시작해 은퇴까지 커리어를 쌓는 선수 시점 커리어 모드입니다.</p>
      ${auto ? `<button class="primary block" data-act="continue">이어하기 <span class="small">· ${esc(auto.name)} ${seasonLabel(auto.season)} ${auto.round}R</span></button>` : ''}
      <button class="block ${auto ? '' : 'primary'}" data-act="go" data-to="new">새 게임</button>
      <button class="block" data-act="go" data-to="saves">불러오기</button>
    </div>
    ${versionFooter()}`;
}

/** 버전 표시 (21.5.1): 화면 맨 아래 작은 글씨. 세이브 시작 버전이 다르면 한 줄 더 */
function versionFooter(g?: GameState): string {
  const notice = g ? saveStartNotice(g.startPatch) : null;
  return `<p class="small muted center">${notice ? `${esc(notice)}<br>` : ''}${esc(versionLabel())}</p>`;
}

function newGameView(): string {
  const f = ui.form;
  const reals = selectableRealPlayers();
  const seedForPreview = f.seed.trim() || 'preview';
  const modeTabs = `
    <div class="row">
      <button class="chip ${f.mode === 'prospect' ? 'on' : ''}" data-act="form" data-k="mode" data-v="prospect">가상 유망주</button>
      <button class="chip ${f.mode === 'real' ? 'on' : ''}" data-act="form" data-k="mode" data-v="real">실제 선수</button>
    </div>`;

  const prospect = `
    <label class="field">이름 (비우면 랜덤)</label>
    <input type="text" id="f-name" maxlength="20" value="${esc(f.name)}" placeholder="예: 김민준" />
    <label class="field">포지션</label>
    <div class="row wrap">
      ${PLAYABLE_POSITIONS.map((p) => `<button class="chip ${f.position === p ? 'on' : ''}" data-act="form" data-k="position" data-v="${p}">${p}</button>`).join('')}
    </div>
    <p class="small muted">${POSITION_NAMES_KO[f.position]} · 핵심 능력치: ${profileOf(f.position).keys.map((a) => ATTRIBUTE_NAMES_KO[a]).join(', ')}</p>`;

  const real = `
    <p class="small muted">현재 리그(프리미어리그)에 소속된, 데이터가 준비된 선수만 고를 수 있습니다.</p>
    ${reals
      .map((p) => {
        const ovr = positionOvr(generatePlayer(p, seedForPreview).attributes, p.position);
        return `
        <div class="list-item">
          <span class="pos-badge">${p.position}</span>
          <div class="grow"><b>${esc(p.nameKo)}</b><div class="small muted">${BALANCE.newGame.startYear - p.birthYear}세 · ${esc(p.club)}</div></div>
          <span class="muted small">약 ${ovr}</span>
          <button class="chip ${f.realId === p.id ? 'on' : ''}" data-act="form" data-k="realId" data-v="${p.id}">선택</button>
        </div>`;
      })
      .join('')}`;

  const canStart = f.mode === 'prospect' || f.realId !== '';
  return `
    <h1>새 게임</h1>
    <div class="card">
      <h2>시작 방식</h2>
      ${modeTabs}
      ${f.mode === 'prospect' ? prospect : real}
    </div>
    <div class="card">
      <h2>난이도</h2>
      <div class="row">
        ${(Object.keys(BALANCE.difficulty) as Difficulty[]).map((d) => `<button class="chip ${f.difficulty === d ? 'on' : ''}" data-act="form" data-k="difficulty" data-v="${d}">${BALANCE.difficulty[d].label}</button>`).join('')}
      </div>
      <label class="field">시드 (비우면 랜덤, 같은 시드 + 같은 선택 = 같은 결과)</label>
      <input type="text" id="f-seed" maxlength="40" value="${esc(f.seed)}" placeholder="랜덤" />
    </div>
    <button class="primary block" data-act="start" ${canStart ? '' : 'disabled'}>커리어 시작</button>
    <button class="block" data-act="go" data-to="title">뒤로</button>`;
}

function playerCard(g: GameState): string {
  const p = g.player;
  const ovr = playerOvr(p);
  const condition = Math.round(100 - p.fatigue);
  const condClass = condition < 50 ? 'bad' : condition < 75 ? 'warn' : '';
  const xpPct = Math.round((p.xp / xpToLevel(p)) * 100);
  return `
    <div class="card player-card">
      <div class="row between">
        <div>
          <div class="row"><span class="pos-badge">${p.position}</span><b>${esc(p.name)}</b></div>
          <div class="small muted" style="margin-top:4px">${p.age}세 · ${teamName(p.teamId)}</div>
        </div>
        <div class="center"><div class="ovr">${ovr}</div><div class="small muted">OVR</div></div>
      </div>
      <div class="row wrap" style="margin:10px 0">
        ${tierBadge(skillTier(ovr), '실력 ')}
        ${tierBadge(reputationTier(p.reputation), '위상 ')}
        <span class="tier">Lv.${p.level}</span>
      </div>
      <div class="row small"><span class="muted" style="width:52px">컨디션</span><div class="bar grow ${condClass}"><i style="width:${condition}%"></i></div><span style="width:38px;text-align:right">${condition}%</span></div>
      ${formRow(p.recentRatings)}
      <div class="row small" style="margin-top:6px"><span class="muted" style="width:52px">XP</span><div class="bar grow"><i style="width:${xpPct}%"></i></div><span style="width:38px;text-align:right">${p.xp}</span></div>
    </div>`;
}

/** 폼 5단계 (부록 D.1). 출전 경기가 모자라면 보정 없음 */
function formRow(recent: number[]): string {
  const level = formLevel(recent);
  const enough = recent.length >= BALANCE.form.games;
  const bonus = formBonus(recent);
  const detail = enough
    ? `평점 ${bonus >= 0 ? '+' : ''}${bonus.toFixed(2)}`
    : `${recent.length}/${BALANCE.form.games}경기`;
  return `<div class="row small" style="margin-top:6px"><span class="muted" style="width:52px">폼</span>
    <span class="grow form-${level}">${FORM_ICONS[level]} ${FORM_NAMES_KO[level]}</span><span class="muted">${detail}</span></div>`;
}

function seasonStatsGrid(g: GameState): string {
  const s = g.player.season;
  const avg = averageRating(s);
  return `
    <div class="stat-grid">
      <div><b>${s.apps}</b><span>출전(선발 ${s.starts})</span></div>
      <div><b>${s.goals}</b><span>골</span></div>
      <div><b>${s.assists}</b><span>도움</span></div>
      <div><b>${avg === null ? '-' : avg.toFixed(2)}</b><span>평균 평점</span></div>
    </div>`;
}

/** 복귀 예정 시점. 비시즌에 BALANCE.injury.offseasonWeeks 만큼 회복된다 */
function returnLabel(g: GameState): string {
  const inj = g.player.injury!;
  const { round, schedule } = g.league;
  if (g.phase === 'season') {
    const target = round + inj.weeksLeft; // 이 라운드(0부터)까지 결장
    if (target < schedule.length) return `${seasonLabel(g.league.season)} ${target + 1}라운드`;
    const carry = inj.weeksLeft - (schedule.length - round) - BALANCE.injury.offseasonWeeks;
    return carry <= 0 ? '다음 시즌 개막' : `다음 시즌 ${carry + 1}라운드`;
  }
  const carry = inj.weeksLeft - BALANCE.injury.offseasonWeeks;
  return carry <= 0 ? '다음 시즌 개막' : `다음 시즌 ${carry + 1}라운드`;
}

function injuryBanner(g: GameState): string {
  const inj = g.player.injury;
  if (!inj) return '';
  return `<div class="notice injury">🚑 부상 (${INJURY_NAMES_KO[inj.grade]}) · 남은 기간 ${inj.weeksLeft}주 · 복귀 예정 ${returnLabel(g)}
    <div class="small">부상 중에는 경기에 나가지 못하고 재활 XP(주 ${BALANCE.injury.rehabXp})만 받습니다.</div></div>`;
}

function homeView(g: GameState): string {
  const p = g.player;
  const pointsBtn = p.unspentPoints > 0
    ? `<button class="block" data-act="go" data-to="allocate">능력치 포인트 찍기 <b class="gold">(${p.unspentPoints})</b></button>`
    : '';

  let week = '';
  if (g.phase === 'season') {
    const fx = nextFixture(g)!;
    const my = teamById(g.league, p.teamId);
    const opp = teamById(g.league, fx.opponentId);
    week = `
      <div class="card">
        <div class="row between"><h2>이번 주 경기</h2><span class="muted small">${seasonLabel(g.league.season)} · ${g.league.round + 1}/${g.league.schedule.length}R</span></div>
        <div class="row between" style="margin:6px 0 4px">
          <div><b>${fx.home ? my.nameKo : opp.nameKo}</b><div class="small muted">홈 · 전력 ${(fx.home ? my : opp).rating}</div></div>
          <span class="muted">vs</span>
          <div style="text-align:right"><b>${fx.home ? opp.nameKo : my.nameKo}</b><div class="small muted">원정 · 전력 ${(fx.home ? opp : my).rating}</div></div>
        </div>
        <button class="primary block" data-act="play">다음 경기 ▶</button>
        <button class="block" data-act="sim-rest">남은 시즌 자동 진행</button>
      </div>`;
  } else if (g.phase === 'offseason') {
    week = `
      <div class="card">
        <h2>비시즌</h2>
        <p class="muted">${seasonLabel(g.league.season)} 시즌이 끝났습니다.</p>
        <button class="primary block" data-act="go" data-to="season">시즌 종료 요약</button>
      </div>`;
  }

  return `
    ${playerCard(g)}
    ${injuryBanner(g)}
    ${pointsBtn}
    ${week}
    <div class="card"><h2>이번 시즌</h2>${seasonStatsGrid(g)}</div>
    ${versionFooter(g)}`;
}

function matchView(g: GameState): string {
  const m = g.lastMatch;
  if (!m) return homeView(g);
  const r = m.result;
  const my = teamName(g.player.teamId);
  const opp = teamName(m.opponentId);
  const [homeName, awayName] = m.home ? [my, opp] : [opp, my];
  const [hg, ag] = m.home ? [r.goalsFor, r.goalsAgainst] : [r.goalsAgainst, r.goalsFor];
  const outcome = r.outcome === 'win' ? '<span class="up">승리</span>' : r.outcome === 'loss' ? '<span class="down">패배</span>' : '<span class="muted">무승부</span>';
  const appearance = m.injured ? '부상으로 결장 (재활)'
    : m.suspended ? '출장 정지로 결장'
    : r.minutes === 0 ? '결장 (벤치)' : r.started ? '선발 90분' : `교체 출전 ${r.minutes}분`;
  const ratingCls = r.rating === null ? '' : r.rating >= 7 ? 'good' : r.rating < 6 ? 'bad' : '';
  const seasonOver = g.phase !== 'season';

  return `
    <div class="card">
      <div class="muted small center">${seasonLabel(m.season)} · ${m.round}라운드</div>
      <div class="row between" style="margin-top:8px"><b class="grow">${homeName}</b><b class="grow" style="text-align:right">${awayName}</b></div>
      <div class="score">${hg} : ${ag}</div>
      <div class="center">${outcome}</div>
    </div>
    <div class="card">
      <div class="row between">
        <div><h2>내 활약</h2><div class="muted small">${appearance}</div>
          ${r.minutes > 0 && m.formBonus ? `<div class="small ${m.formBonus > 0 ? 'up' : 'down'}">폼 보정 ${m.formBonus > 0 ? '+' : ''}${m.formBonus.toFixed(2)}</div>` : ''}</div>
        <div class="center"><div class="rating ${ratingCls}">${r.rating === null ? '-' : r.rating.toFixed(1)}</div><div class="small muted">평점</div></div>
      </div>
      <div class="stat-grid" style="margin-top:10px">
        <div><b>${r.goals}</b><span>골</span></div>
        <div><b>${r.assists}</b><span>도움</span></div>
        <div><b class="gold">+${r.xp}</b><span>XP</span></div>
        <div><b>${r.mom ? '⭐' : '-'}</b><span>MOM</span></div>
      </div>
      ${matchSummaryView({ engine: m.engine, cards: m.cards, banned: g.player.suspended > 0 && g.phase === 'season' })}
      ${ui.replay ? avgMapView(ui.replay.replay.teams) : ''}
      ${m.injury ? `<div class="notice injury">🚑 부상! ${INJURY_NAMES_KO[m.injury.grade]} ${m.injury.weeksTotal}주 결장${
        Object.keys(m.injury.permanent).length ? `<div class="small">후유증: ${deltaList(m.injury.permanent)}</div>` : ''}</div>` : ''}
      ${m.recovered ? '<div class="notice">부상에서 회복했습니다. 다음 경기부터 출전할 수 있습니다.</div>' : ''}
      ${m.levelsGained > 0 ? `<div class="notice">레벨 업! Lv.${g.player.level} · 능력치 포인트 +${m.levelsGained * BALANCE.growth.pointsPerLevel} · 현재 OVR ${playerOvr(g.player)}</div>` : ''}
    </div>
    ${g.player.unspentPoints > 0 ? `<button class="primary block" data-act="go" data-to="allocate">포인트 찍기 (${g.player.unspentPoints})</button>` : ''}
    ${seasonOver
      ? `<button class="${g.player.unspentPoints > 0 ? '' : 'primary'} block" data-act="go" data-to="season">시즌 종료 요약</button>`
      : `<button class="${g.player.unspentPoints > 0 ? '' : 'primary'} block" data-act="play">다음 경기 ▶</button>
         <button class="block" data-act="go" data-to="home">홈으로</button>`}`;
}

function allocateView(g: GameState): string {
  const p = g.player;
  const keys = profileOf(p.position).keys;
  const cap = p.allocation.levels * BALANCE.growth.maxRaisePerLevel;
  const tier = costTier(p);
  // 포인트 1개당 OVR 상승량. 가장 효율 좋은 능력치 대비 비율로 ●●● 표시
  const efficiency = (a: FieldAttribute) =>
    attributeOvrWeight(p.position, a) / pointCost(p.attributes[a], tier);
  const maxEff = Math.max(...FIELD_ATTRIBUTES.map(efficiency));
  const effDots = (a: FieldAttribute) => {
    const r = efficiency(a) / maxEff;
    if (r === 0) return '<span class="eff muted">OVR 무관</span>';
    const n = r >= 0.66 ? 3 : r >= 0.33 ? 2 : 1;
    return `<span class="eff eff-${n}">${'●'.repeat(n)}${'○'.repeat(3 - n)}</span>`;
  };
  const groups = GROUP_NAMES.map((grp) => {
    const rows = (ATTRIBUTE_GROUPS[grp] as readonly FieldAttribute[]).map((a) => {
      const v = p.attributes[a];
      const block = raiseBlock(p, a);
      const raised = p.allocation.raised[a] ?? 0;
      const costLabel = v >= BALANCE.growth.maxAttribute ? '최대' : `비용 ${pointCost(v, tier)}`;
      const perPoint = attributeOvrWeight(p.position, a);
      return `
        <div class="attr-row ${keys.includes(a) ? 'key' : ''}">
          <span class="name">${ATTRIBUTE_NAMES_KO[a]}</span>
          ${raised > 0 ? `<span class="small up">+${raised}</span>` : ''}
          <span class="val">${v}</span>
          <span class="per small muted">${perPoint > 0 ? `+${perPoint.toFixed(2)}` : ''}</span>
          ${effDots(a)}
          <span class="cost">${costLabel}</span>
          <button class="mini" data-act="raise" data-attr="${a}" ${block ? 'disabled' : ''}>+</button>
        </div>`;
    });
    return `<h3>${GROUP_NAMES_KO[grp]}</h3>${rows.join('')}`;
  });

  return `
    <div class="card" style="position:sticky;top:0;z-index:2">
      <div class="row between">
        <div><h2 style="margin:0">포인트 찍기</h2><div class="small muted">한 능력치 최대 +${cap} (레벨업 ${p.allocation.levels}회분) · ★ 핵심 능력치 · +0.00 능력치 +1당 OVR · ●●● 포인트당 효율</div></div>
        <div class="center"><div class="ovr" style="font-size:30px">${p.unspentPoints}</div><div class="small muted">남은 포인트</div></div>
      </div>
      <div style="margin-top:6px">${p.position} OVR <b>${Math.round(ui.allocStartOvr)}</b> → <b class="gold">${playerOvr(p)}</b>
        <span class="small muted">(${ui.allocStartOvr.toFixed(1)} → ${positionOvrExact(p.attributes, p.position).toFixed(1)})</span></div>
      <div class="small muted">비용 구간: ${tierBadge(tier, '위상 ')} 기준 · 비용 1 ~${BALANCE.growth.costBands[tier].cost1Max} / 비용 2 ~${BALANCE.growth.costBands[tier].cost2Max}</div>
      ${ui.coachComment ? `<div class="notice">코치: "여기서부터는 성장이 더뎌져. 더 큰 무대에서 활약해서 이름을 알리면 다시 길이 열릴 거야."</div>` : ''}
    </div>
    <div class="card">${groups.join('')}</div>
    <button class="block" data-act="auto-alloc" ${p.unspentPoints > 0 ? '' : 'disabled'}>자동 배분 (포지션 OVR 우선)</button>
    <button class="primary block" data-act="alloc-done">완료</button>`;
}

function playerView(g: GameState): string {
  const p = g.player;
  const keys = profileOf(p.position).keys;
  const ovrs = allPositionOvrs(p.attributes);
  const groups = GROUP_NAMES.map((grp) => `
    <h3>${GROUP_NAMES_KO[grp]}</h3>
    ${(ATTRIBUTE_GROUPS[grp] as readonly FieldAttribute[]).map((a) => `
      <div class="attr-row ${keys.includes(a) ? 'key' : ''}"><span class="name">${ATTRIBUTE_NAMES_KO[a]}</span><span class="val">${p.attributes[a]}</span></div>`).join('')}`);

  return `
    ${playerCard(g)}
    <div class="card">
      <h2>위상</h2>
      <div class="row between"><span>${p.reputation} / ${BALANCE.reputation.max}</span>${tierBadge(reputationTier(p.reputation))}</div>
      <div class="bar" style="margin-top:6px"><i style="width:${(p.reputation / BALANCE.reputation.max) * 100}%"></i></div>
      <p class="small muted">누적 XP ${p.totalXp} · 레벨 ${p.level}</p>
    </div>
    <div class="card">
      <h2>포지션별 OVR</h2>
      <div class="pos-grid">${PLAYABLE_POSITIONS.map((pos) => `<div class="${pos === p.position ? 'main' : ''}"><span class="small muted">${pos}</span><b>${ovrs[pos]}</b></div>`).join('')}</div>
      <p class="small muted">1단계에서는 포지션 전환이 없습니다.</p>
    </div>
    <div class="card"><h2>능력치</h2>${groups.join('')}</div>
    <div class="card"><h2>시즌별 기록</h2>${historyTable(g)}</div>`;
}

function historyTable(g: GameState): string {
  const h = g.player.history;
  if (!h.length) return '<p class="muted small">아직 끝난 시즌이 없습니다.</p>';
  return `<table>
    <tr><th>시즌</th><th>나이</th><th>OVR</th><th>경기</th><th>골</th><th>도움</th><th>평점</th><th>순위</th></tr>
    ${h.map((r) => `<tr><td>${seasonLabel(r.season)}</td><td>${r.age}</td><td>${r.ovr}</td><td>${r.apps}</td><td>${r.goals}</td><td>${r.assists}</td><td>${r.apps ? (r.ratingSum / r.apps).toFixed(2) : '-'}</td><td>${r.leaguePosition}</td></tr>`).join('')}
  </table>`;
}

function tableView(g: GameState): string {
  const rows = sortedTable(g.league);
  return `
    <div class="card">
      <div class="row between"><h2>${g.league.name}</h2><span class="muted small">${seasonLabel(g.league.season)} · ${g.league.round}/${g.league.schedule.length}R</span></div>
      <table>
        <tr><th>#</th><th class="l">팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>
        ${rows.map((r, i) => `
          <tr class="${r.teamId === g.player.teamId ? 'me' : ''}">
            <td>${i + 1}</td><td class="l">${teamName(r.teamId)}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${signed(r.gf - r.ga)}</td><td><b>${r.points}</b></td>
          </tr>`).join('')}
      </table>
      <p class="small muted">팀 전력: ${rows.map((r) => `${teamName(r.teamId)} ${teamById(g.league, r.teamId).rating}`).join(' · ')}</p>
    </div>`;
}

function starsView(g: GameState): string {
  const list = g.npcs.filter((n) => !n.retired).sort((a, b) => npcOvr(b) - npcOvr(a));
  const retired = g.npcs.filter((n) => n.retired);
  return `
    <div class="card">
      <h2>리그 스타 선수</h2>
      <p class="small muted">유명 선수들도 시즌마다 성장하고 늙습니다. 오른쪽 숫자는 지난 시즌 대비 OVR 변화.</p>
      ${list.map((n) => `
        <div class="list-item">
          <span class="pos-badge">${n.position}</span>
          <div class="grow"><b>${esc(n.nameKo)}</b><div class="small muted">${n.age}세 · ${esc(n.club)}</div></div>
          <b>${npcOvr(n)}</b>
          <span class="small ${deltaClass(n.lastChange)}" style="width:30px;text-align:right">${n.lastChange ? signed(n.lastChange) : ''}</span>
        </div>`).join('')}
      ${retired.length ? `<p class="small muted">은퇴: ${retired.map((n) => esc(n.nameKo)).join(', ')}</p>` : ''}
    </div>`;
}

function deltaList(d: AttributeDelta): string {
  const entries = Object.entries(d) as [FieldAttribute, number][];
  if (!entries.length) return '<span class="muted small">없음</span>';
  return `<div class="row wrap small">${entries.map(([a, v]) => `<span class="${deltaClass(v)}">${ATTRIBUTE_NAMES_KO[a]} ${signed(v)}</span>`).join('<span class="muted">·</span>')}</div>`;
}

/** 위상 진행도와 다음 티어에서 열리는 비용 구간 (6.3) */
function reputationProgress(rep: number): string {
  const next = nextReputationTier(rep);
  if (!next) return '<p class="small muted">최고 위상 티어입니다. 성장 구간이 모두 열렸습니다.</p>';
  const cur = BALANCE.reputation.tierCuts[reputationTier(rep)];
  const band = BALANCE.growth.costBands[next.tier];
  return `
    <div class="bar" style="margin-top:6px"><i style="width:${((rep - cur) / (next.cut - cur)) * 100}%"></i></div>
    <p class="small muted">다음 티어 ${TIER_NAMES_KO[next.tier]}까지 ${rep} / ${next.cut} · 열리는 구간: 비용 1 ~${band.cost1Max}, 비용 2 ~${band.cost2Max}</p>`;
}

function seasonView(g: GameState): string {
  const s = g.lastSeasonSummary;
  if (!s) return homeView(g);
  const rec = g.player.history.at(-1)!;
  const avg = rec.apps ? (rec.ratingSum / rec.apps).toFixed(2) : '-';
  const ovrDiff = s.ovrAfter - s.ovrBefore;

  let actions: string;
  if (g.phase === 'retired') {
    actions = `
      ${s.forcedRetire ? `<div class="notice">${g.player.age}세. 더 이상 뛸 수 없습니다. 은퇴합니다.</div>` : ''}
      <button class="primary block" data-act="go" data-to="retired">커리어 요약</button>`;
  } else {
    actions = `
      ${g.player.unspentPoints > 0 ? `<button class="block" data-act="go" data-to="allocate">포인트 찍기 (${g.player.unspentPoints})</button>` : ''}
      <button class="primary block" data-act="next-season">${seasonLabel(s.season + 1)} 시즌 시작</button>
      ${s.canRetire ? '<button class="block" data-act="retire">은퇴하기</button>' : ''}`;
  }

  return `
    <h1>${seasonLabel(s.season)} 시즌 종료</h1>
    <div class="card">
      <div class="row between"><h2>${teamName(rec.teamId)}</h2><b>${s.leaguePosition}위</b></div>
      <div class="stat-grid">
        <div><b>${rec.apps}</b><span>출전</span></div>
        <div><b>${rec.goals}</b><span>골</span></div>
        <div><b>${rec.assists}</b><span>도움</span></div>
        <div><b>${avg}</b><span>평균 평점</span></div>
      </div>
      ${rec.injuries || rec.injuredWeeks ? `<p class="small muted">부상 ${rec.injuries}회 · 부상 결장 ${rec.injuredWeeks}주</p>` : ''}
    </div>
    ${g.phase === 'offseason' ? injuryBanner(g) : ''}
    <div class="card">
      <h2>업적 XP</h2>
      ${s.achievements.length ? s.achievements.map((a) => `<div class="row between"><span>${a.label}</span><b class="gold">+${a.xp}</b></div>`).join('') : '<p class="muted small">이번 시즌 업적 없음</p>'}
      <div class="row between small muted" style="margin-top:6px"><span>지급 XP (난이도 반영)</span><span>${s.achievementXp}</span></div>
      ${s.levelsGained ? `<div class="notice">레벨 업 ${s.levelsGained}회!</div>` : ''}
      <div class="row between" style="margin-top:8px"><span>위상</span><span>${s.reputationBefore} → <b>${s.reputationAfter}</b> ${tierBadge(reputationTier(s.reputationAfter))}</span></div>
      ${reputationProgress(s.reputationAfter)}
    </div>
    <div class="card">
      <h2>능력치 변화</h2>
      <div class="row between"><span>${g.player.position} OVR</span><span>${s.ovrBefore} → <b>${s.ovrAfter}</b> <span class="${deltaClass(ovrDiff)}">(${signed(ovrDiff)})</span></span></div>
      <h3>자동 성장 (${BALANCE.growth.autoGrowth.minAge}~${BALANCE.growth.autoGrowth.maxAge}세)</h3>
      ${deltaList(s.autoGrowth)}
      <h3>노련함 (경험으로 오르는 능력치)</h3>
      ${deltaList(s.veteranGrowth ?? {})}
      <h3>노화</h3>
      ${deltaList(s.aging)}
      <p class="small muted">나이 ${s.age} → ${g.player.age}세</p>
    </div>
    ${actions}`;
}

function retiredView(g: GameState): string {
  const t = careerTotals(g.player);
  return `
    <h1>커리어 요약</h1>
    ${playerCard(g)}
    <div class="card">
      <h2>통산 기록</h2>
      <div class="stat-grid">
        <div><b>${t.seasons}</b><span>시즌</span></div>
        <div><b>${t.apps}</b><span>경기</span></div>
        <div><b>${t.goals}</b><span>골</span></div>
        <div><b>${t.assists}</b><span>도움</span></div>
      </div>
      <div class="row between" style="margin-top:10px"><span>평균 평점</span><b>${t.avgRating === null ? '-' : t.avgRating.toFixed(2)}</b></div>
      <div class="row between"><span>최고 OVR</span><b>${t.peakOvr}</b></div>
      <div class="row between"><span>최고 순위</span><b>${t.bestFinish ?? '-'}위</b></div>
      <div class="row between"><span>최종 위상</span><span>${g.player.reputation} ${tierBadge(reputationTier(g.player.reputation))}</span></div>
    </div>
    <div class="card"><h2>시즌별 기록</h2>${historyTable(g)}</div>
    <button class="primary block" data-act="go" data-to="new">새 게임</button>`;
}

function savesView(): string {
  const metas = listSaves();
  const slotName = (s: SaveSlot) => (s === 'auto' ? '자동 저장' : `슬롯 ${s}`);
  return `
    <h1>저장 / 불러오기</h1>
    <div class="card">
      ${SAVE_SLOTS.map((slot, i) => {
        const m = metas[i];
        return `
          <div class="list-item">
            <div class="grow">
              <b>${slotName(slot)}</b>
              <div class="small muted">${m ? `${esc(m.name)} · ${m.age}세 · ${seasonLabel(m.season)} ${m.round}R · ${new Date(m.savedAt).toLocaleString('ko-KR')}` : '비어 있음'}</div>
            </div>
            ${slot !== 'auto' && ui.game ? `<button class="mini" data-act="save" data-slot="${slot}">저장</button>` : ''}
            ${m ? `<button class="mini" data-act="load" data-slot="${slot}">불러오기</button>` : ''}
            ${m && slot !== 'auto' ? `<button class="mini" data-act="delete" data-slot="${slot}">삭제</button>` : ''}
          </div>`;
      }).join('')}
      <p class="small muted">매 라운드가 끝날 때마다 자동 저장됩니다. 저장은 이 브라우저(localStorage)에만 남습니다.</p>
    </div>
    ${ui.game ? '' : '<button class="block" data-act="go" data-to="title">뒤로</button>'}
    ${versionFooter(ui.game ?? undefined)}`;
}

function tabs(): string {
  if (!ui.game || ['title', 'new', 'retired'].includes(ui.screen)) return '';
  const items: [Screen, string][] = [['home', '홈'], ['player', '내 선수'], ['table', '순위'], ['stars', '스타'], ['saves', '저장']];
  return `<nav class="tabs"><div class="inner">${items.map(([s, l]) => `<button class="${ui.screen === s ? 'on' : ''}" data-act="go" data-to="${s}">${l}</button>`).join('')}</div></nav>`;
}

function render(): void {
  const g = ui.game;
  let html: string;
  switch (ui.screen) {
    case 'title': html = titleView(); break;
    case 'new': html = newGameView(); break;
    case 'saves': html = savesView(); break;
    default:
      if (!g) { html = titleView(); break; }
      if (g.phase === 'retired' && !['retired', 'season', 'saves', 'player'].includes(ui.screen)) { html = retiredView(g); break; }
      html = {
        home: () => homeView(g),
        match: () => matchView(g),
        replay: () => (ui.replay
          ? replayView({
            teams: ui.replay.replay.teams, side: ui.replay.replay.side, speed: ui.replay.speed, paused: ui.replay.paused,
            mode: ui.replay.mode, scene: ui.replay.idx + 1, scenes: ui.replay.scenes.length,
          })
          : matchView(g)),
        allocate: () => allocateView(g),
        player: () => playerView(g),
        table: () => tableView(g),
        stars: () => starsView(g),
        season: () => seasonView(g),
        retired: () => retiredView(g),
      }[ui.screen as 'home']();
  }
  app.innerHTML = html + tabs() + (ui.toast ? `<div class="toast">${esc(ui.toast)}</div>` : '');
  if (ui.screen === 'replay' && ui.replay) ui.replay.attach();
  else ui.replay?.stop();
  if (ui.screen === 'match' && ui.replay) drawAvgMap(ui.replay.replay);
}

// ── 동작 ──

function readFormInputs(): void {
  const name = document.getElementById('f-name') as HTMLInputElement | null;
  const seed = document.getElementById('f-seed') as HTMLInputElement | null;
  if (name) ui.form.name = name.value;
  if (seed) ui.form.seed = seed.value;
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const act = el.dataset.act!;
  const g = ui.game;

  switch (act) {
    case 'go':
      if (ui.screen === 'new') readFormInputs();
      if (el.dataset.to === 'allocate' && g) {
        ui.coachComment = false;
        ui.allocStartOvr = positionOvrExact(g.player.attributes, g.player.position);
      }
      go(el.dataset.to as Screen);
      return;
    case 'continue': {
      try {
        ui.game = loadGame('auto');
      } catch (e) {
        showToast((e as Error).message);
        return;
      }
      go(ui.game?.phase === 'retired' ? 'retired' : 'home');
      return;
    }
    case 'form': {
      readFormInputs();
      const k = el.dataset.k as 'mode' | 'position' | 'difficulty' | 'realId';
      (ui.form as Record<string, string>)[k] = el.dataset.v!;
      render();
      return;
    }
    case 'start': {
      readFormInputs();
      const f = ui.form;
      ui.game = f.mode === 'prospect'
        ? newGame({ mode: 'prospect', name: f.name, position: f.position, seed: f.seed, difficulty: f.difficulty })
        : newGame({ mode: 'real', playerId: f.realId, seed: f.seed, difficulty: f.difficulty });
      autosave();
      go('home');
      return;
    }
    case 'play':
      if (!g || g.phase !== 'season') return;
      ui.replay = null;
      playRound(g, { onReplay: (r) => { ui.replay = new ReplayPlayer(r, () => render()); } });
      autosave();
      go(ui.replay ? 'replay' : 'match');
      return;
    case 'rp-toggle':
      if (!ui.replay || ui.replay.ended) return;
      ui.replay.paused = !ui.replay.paused;
      render();
      return;
    case 'rp-live':
      ui.replay?.goLive();
      render();
      return;
    case 'rp-speed':
      if (!ui.replay) return;
      ui.replay.speed = Number(el.dataset.v);
      render();
      return;
    case 'rp-skip':
      // 건너뛰기는 즉시 최종 결과로 (24.3)
      ui.replay?.skip();
      go('match');
      return;
    case 'sim-rest': {
      if (!g || g.phase !== 'season' || ui.busy) return;
      if (!confirm('남은 경기를 모두 진행합니다. 포인트는 자동 배분됩니다. 계속할까요?')) return;
      // 경기 엔진은 한 경기에 약 0.5초가 걸리므로 라운드마다 화면에 진행 상황을 그린다
      ui.busy = true;
      const next = () => {
        if (g.phase !== 'season') {
          ui.busy = false;
          ui.toast = '';
          autosave();
          go('season');
          return;
        }
        playRound(g);
        autoAllocate(g.player);
        ui.toast = `자동 진행 중… ${g.league.round}/${g.league.schedule.length}라운드`;
        render();
        setTimeout(next, 0);
      };
      ui.toast = '자동 진행 중…';
      render();
      setTimeout(next, 0);
      return;
    }
    case 'raise': {
      if (!g) return;
      const before = g.player.coachWarned;
      raiseAttribute(g.player, el.dataset.attr as FieldAttribute);
      if (!before && g.player.coachWarned) ui.coachComment = true;
      autosave();
      render();
      return;
    }
    case 'auto-alloc':
      if (!g) return;
      autoAllocate(g.player);
      autosave();
      render();
      return;
    case 'alloc-done':
      if (!g) return;
      go(g.phase === 'season' ? 'home' : 'season');
      return;
    case 'next-season':
      if (!g) return;
      startNextSeason(g);
      autosave();
      go('home');
      return;
    case 'retire':
      if (!g || !confirm('정말 은퇴할까요? 되돌릴 수 없습니다.')) return;
      retire(g);
      autosave();
      go('retired');
      return;
    case 'save': {
      if (!g) return;
      const ok = saveGame(el.dataset.slot as SaveSlot, g);
      showToast(ok ? '저장했습니다' : '저장 실패 (브라우저 저장소를 쓸 수 없음)');
      return;
    }
    case 'load': {
      try {
        const loaded = loadGame(el.dataset.slot as SaveSlot);
        if (!loaded) return;
        ui.game = loaded;
        autosave();
        go(loaded.phase === 'retired' ? 'retired' : 'home');
      } catch (e) {
        showToast((e as Error).message);
      }
      return;
    }
    case 'delete':
      if (!confirm('이 슬롯을 삭제할까요?')) return;
      deleteSave(el.dataset.slot as SaveSlot);
      render();
      return;
  }
});

render();
