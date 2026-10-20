// 시작 팀 고르기 (45b b, 디자인 없음): 리그 탭(국기 + 이름, 가로 스크롤) → 그 리그 팀 목록(엠블럼 · 이름 · 전력, 못 고르는 팀은 흐리게 + 이유)
import { Crest, esc, Icon, Tabs } from '../components';
import type { TeamPickVM } from '../teamPickVM';

export function teamPickHtml(p: TeamPickVM, act: string, key: string, randomKey = key): string {
  const tabs = Tabs({ items: p.leagues, value: p.league, variant: 'segment', scroll: true, act: 'ng-pick-league', label: '리그 고르기' });
  const random = p.random
    ? `<button type="button" class="tp-row tp-row--random${p.random.on ? ' is-on' : ''}" data-act="${act}" data-k="${randomKey}" data-v="random" aria-pressed="${p.random.on}"><span class="tp-crest">${Icon({ name: 'swap', size: 16 })}</span><span class="grow"><b>${esc(p.random.label)}</b></span></button>`
    : '';
  const rows = p.teams.map((t) => `<button type="button" class="tp-row${t.on ? ' is-on' : ''}${t.ok ? '' : ' is-off'}" data-act="${act}" data-k="${key}" data-v="${esc(t.id)}" aria-pressed="${t.on}"${t.ok ? '' : ' disabled'}>${Crest({ name: t.ko, team: t.id, size: 22 })}<span class="grow"><b>${esc(t.ko)}</b>${t.why ? `<small>${esc(t.why)}</small>` : ''}</span><span class="tp-rating po-num">${Math.round(t.rating)}</span></button>`).join('');
  return `<div class="tp">${tabs}<div class="tp-list">${random}${rows}</div></div>`;
}
