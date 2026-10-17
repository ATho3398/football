/* @ds-bundle: {"format":4,"namespace":"PlayerOne","components":[{"name":"Button"},{"name":"Icon"},{"name":"Avatar"},{"name":"Crest"},{"name":"TierBadge"},{"name":"RatingBadge"},{"name":"StatChip"},{"name":"Meter"},{"name":"FatigueGauge"},{"name":"FormIndicator"},{"name":"StatBar"},{"name":"PlayerCard"},{"name":"GameCard"},{"name":"CardHand"},{"name":"ChoiceButton"},{"name":"FeedItem"},{"name":"ScoreBar"},{"name":"PossessionBar"},{"name":"AppBar"},{"name":"Tabs"},{"name":"Banner"},{"name":"Toast"},{"name":"BottomSheet"},{"name":"Modal"},{"name":"ResultSplash"},{"name":"DeckSlot"},{"name":"HeroPanel"},{"name":"SectionTitle"},{"name":"Pitch"},{"name":"FitBadge"},{"name":"TacticEmblem"},{"name":"TacticChip"},{"name":"FormationPitch"},{"name":"OptionRow"},{"name":"Slider"},{"name":"Switch"},{"name":"CellGauge"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var F = React.Fragment;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }
  function omit(obj, keys) {
    var o = {};
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && keys.indexOf(k) < 0) o[k] = obj[k];
    return o;
  }
  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function signed(n, digits) {
    if (digits == null) digits = Math.abs(n * 10 - Math.round(n * 10)) > 1e-6 ? 2 : 1;
    var s = digits === 0 ? String(Math.round(Math.abs(n))) : Math.abs(n).toFixed(digits);
    return (n > 0 ? '+' : n < 0 ? '−' : '±') + s;
  }

  /* ---------------- Icon ---------------- */
  var P = {
    ball: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7.5l3.8 2.8-1.4 4.5H9.6l-1.4-4.5z M12 3v4.5 M15.8 10.3l4.6-1.4 M14.4 14.8l2.6 4 M9.6 14.8l-2.6 4 M8.2 10.3l-4.6-1.4',
    save: 'M7 12V6.5a1.5 1.5 0 0 1 3 0V11 M10 11V4.5a1.5 1.5 0 0 1 3 0V11 M13 11V5.5a1.5 1.5 0 0 1 3 0V12 M16 12V8.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L4 14.5a1.6 1.6 0 0 1 2.6-1.9L7 13.5',
    card: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
    sub: 'M7 4v13 M3 13l4 4 4-4 M17 20V7 M13 11l4-4 4 4',
    injury: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    danger: 'M12 3.5L2.5 20h19z M12 10v4.5 M12 17.2v.1',
    chance: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z M12 11.2v1.6',
    dot: 'M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
    clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7v5l3.5 2',
    bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 20.5a2 2 0 0 0 4 0',
    disk: 'M5 4h11l4 4v12H4V4z M8 4v5h7V4 M8 20v-6h8v6',
    home: 'M3 11l9-7 9 7 M5.5 9.5V20h13V9.5 M10 20v-5h4v5',
    match: 'M3 5h18v14H3z M12 5v14 M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z M3 9h3v6H3 M21 9h-3v6h3',
    player: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4 21a8 8 0 0 1 16 0',
    career: 'M4 8h16v12H4z M9 8V5h6v3 M4 13h16',
    world: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M3 12h18 M12 3c3 3.5 3 14.5 0 18 M12 3c-3 3.5-3 14.5 0 18',
    lock: 'M6 11h12v9H6z M9 11V8a3 3 0 0 1 6 0v3',
    plus: 'M12 5v14 M5 12h14',
    minus: 'M5 12h14',
    check: 'M5 12.5l4.5 4.5L19 7',
    close: 'M6 6l12 12 M18 6L6 18',
    'chevron-right': 'M9 6l6 6-6 6',
    'chevron-down': 'M6 9l6 6 6-6',
    play: 'M7 5l12 7-12 7z',
    pause: 'M8 5v14 M16 5v14',
    skip: 'M5 5l9 7-9 7z M18 5v14',
    risk: 'M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 2 3 0-3 0-5 1-8z',
    'arrow-up': 'M12 19V5 M6 11l6-6 6 6',
    'arrow-down': 'M12 5v14 M6 13l6 6 6-6',
    'arrow-flat': 'M5 12h14 M13 6l6 6-6 6',
    'double-up': 'M6 12l6-6 6 6 M6 18l6-6 6 6',
    'double-down': 'M6 6l6 6 6-6 M6 12l6 6 6-6',
    passive: 'M7 9a3 3 0 1 0 0 6c2.5 0 7.5-6 10-6a3 3 0 1 1 0 6c-2.5 0-7.5-6-10-6z',
    setpiece: 'M6 21V4 M6 4h11l-2 4 2 4H6',
    combo: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
    defense: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    manage: 'M3 12h4l2-4.5 3.5 9 2-4.5H21',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    levelup: 'M12 3.5l7.5 7.5H15v9H9v-9H4.5z',
    info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 11v5.5 M12 7.8v.1',
    filter: 'M4 5h16l-6 7.5V19l-4 1.5v-8z',
    restore: 'M4 12a8 8 0 1 0 2.4-5.7 M4 4v4.5h4.5',
    search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z M15.5 15.5L20 20',
    shot: 'M4 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0z M9.5 15.5L19 6 M13 5.5h6.5V12',
    corner: 'M5 21V3 M5 3l10 4-10 4 M5 21a9 9 0 0 1 9-9',
    freekick: 'M3 19a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0z M12 21v-8 M16 21v-8 M20 21v-8 M10.6 9.5a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0z M14.6 9.5a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0z M18.6 9.5a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0z',
    penalty: 'M3 13V5h18v8 M7.5 5v8 M12 5v8 M16.5 5v8 M3 9h18 M12 19.5h.01',
    foul: 'M3 11a5 5 0 0 0 9.8 1.5H15l5-3.5V6H8a5 5 0 0 0-5 5z M8 11h.01 M10 3.5l1 1.5 M14 3l-.5 1.8',
    offside: 'M6 21V3 M6 4h12v8H6z M6 12L18 4',
    advantage: 'M4 6l7 6-7 6 M12 6l7 6-7 6',
    safe: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M8.5 12l2.5 2.5 4.5-5',
    balanced: 'M12 4v16 M6 20h12 M4 8h16 M4 8l-2.5 6a3.5 3.5 0 0 0 5 0z M20 8l-2.5 6a3.5 3.5 0 0 0 5 0z M12 4l-1-1h2z',
    gamble: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M8.5 8.5h.01 M15.5 8.5h.01 M12 12h.01 M8.5 15.5h.01 M15.5 15.5h.01',
    throwin: 'M12 2.5a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4z M7 11l2.5-3h5L17 11 M9.5 8v5.5h5V8 M10 13.5L8.5 21 M14 13.5l1.5 7.5',
    goalkick: 'M3 20h18 M5 20v-6h14v6 M9 20v-3h6v3 M12 3.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z M12 8.5v3',
    tactic: 'M5 4h14v17H5z M9 4V2.5h6V4 M8 9l2 2 M10 9l-2 2 M14.5 15.5a1.5 1.5 0 1 0 0.01 0 M10 12.5c2 0 3 .8 3.5 2',
    order: 'M10 14l4-4 M8.5 11.5l-2 2a3.2 3.2 0 0 0 4.5 4.5l2-2 M15.5 12.5l2-2a3.2 3.2 0 0 0-4.5-4.5l-2 2',
    solo: 'M20 13a8 8 0 1 1-9-8 M14 3h7v7 M21 3l-9 9',
    't-balanced': 'M3 12h18 M12 4v16 M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z',
    't-tikitaka': 'M6.5 17L12 7.5l5.5 9.5z M4.5 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0z M10 7.5a2 2 0 1 0 4 0a2 2 0 1 0-4 0z M15.5 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0z',
    't-gegen': 'M3 5l6 7-6 7 M21 5l-6 7 6 7 M12 8v8',
    't-counter': 'M3 19l7-7 3 3 8-9 M15 6h6v6',
    't-direct': 'M4 19c3-11 10-14 16-12 M16.5 3.5L20 7l-3.5 3.5 M3 19h3',
    't-block': 'M4 6h16v4.5H4z M4 10.5h16V15H4z M4 15h16v4.5H4z M9 6v4.5 M15 6v4.5 M12 10.5V15 M9 15v4.5 M15 15v4.5',
    newchoice: 'M4 12h6 M10 12l5-6h5 M10 12l5 6h5 M19 3v6 M16 6h6',
    signature: 'M4 20c2.5-.5 4.5-2 6-4.5 M14 3.5l6.5 6.5-7.5 7.5-4-1.5-1.5-4z M14.2 9.8h.01',
    'pos-all': 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z M4 12h16',
    'pos-att': 'M12 20V5 M6 11l6-6 6 6 M6 17l6-6 6 6',
    'pos-mid': 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    ff: 'M3 6l8 6-8 6z M12 6l8 6-8 6z',
    auto: 'M4 12a8 8 0 0 1 14-5.3 M20 12a8 8 0 0 1-14 5.3 M18 3v4h-4 M6 21v-4h4',
    manual: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V12 M11 11V4.5a1.5 1.5 0 0 1 3 0V12 M14 11.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 15a1.6 1.6 0 0 1 2.6-1.9L8 15',
    settings: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1',
    calendar: 'M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5',
    train: 'M3 10v4 M6.5 7v10 M17.5 7v10 M21 10v4 M6.5 12h11',
    video: 'M3 6h13v12H3z M16 10l5-3v10l-5-3z',
    rest: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    recover: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z M8 12h2.2l1.3-2 1.6 4 1.2-2H16',
    target: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z M12 11.3a.7.7 0 1 0 0 1.4a.7.7 0 1 0 0-1.4z',
    download: 'M12 3v12 M7 10l5 5 5-5 M4 20h16',
    upload: 'M12 15V3 M7 8l5-5 5 5 M4 20h16',
    plane: 'M2.5 13l19-7-5.5 13-3.5-4.5z M12.5 14.5L21.5 6',
    replay: 'M4 12a8 8 0 1 0 2.4-5.7 M4 4v4.5h4.5 M10 9.5v5l4-2.5z',
    stop: 'M6 6h12v12H6z',
    menu: 'M4 7h16 M4 12h16 M4 17h16',
    deck: 'M9 4h9a1 1 0 0 1 1 1v12 M6 7h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z',
    chat: 'M4 5h16v11H10l-6 4z M8 9.5h8 M8 12.5h5',
    trophy: 'M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 14v4 M8 20h8',
    swap: 'M4 8h14 M14 4l4 4-4 4 M20 16H6 M10 12l-4 4 4 4',
    edit: 'M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4',
    eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
    grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
    face: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M9 10v.5 M15 10v.5 M8.5 14.5q3.5 3 7 0',
    sliders: 'M4 7h9 M17 7h3 M15 5v4 M4 17h3 M11 17h9 M9 15v4',
    pin: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z M12 8a2 2 0 1 0 0 4a2 2 0 1 0 0-4z',
    collapse: 'M6 15l6-6 6 6'
  };
  var FILLED = { stop: 1, card: 1, star: 1, levelup: 1, combo: 1, play: 1, injury: 1, risk: 1 };
  var DOTTY = {};

  function Icon(props) {
    var name = props.name, size = props.size || 20;
    var d = P[name] || P.dot;
    var filled = props.filled != null ? props.filled : !!FILLED[name];
    return h('svg', {
      className: cx('po-icon', props.className), width: size, height: size, viewBox: '0 0 24 24',
      fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: props.strokeWidth || 2,
      strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': props.label ? undefined : true, 'data-dotty': DOTTY[name] ? '' : undefined,
      role: props.label ? 'img' : undefined, 'aria-label': props.label, style: props.style
    }, h('path', { d: d }));
  }
  Icon.names = Object.keys(P);

  /* ---------------- Button ---------------- */
  function Button(props) {
    var variant = props.variant || 'primary', size = props.size || 'md';
    var rest = omit(props, ['variant', 'size', 'block', 'icon', 'iconRight', 'children', 'className']);
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('po-btn', 'po-btn--' + variant, 'po-btn--' + size, props.block && 'po-btn--block', props.className)
    }),
      props.icon && h(Icon, { name: props.icon, size: size === 'sm' ? 16 : 20 }),
      props.children != null && h('span', null, props.children),
      props.iconRight && h(Icon, { name: props.iconRight, size: size === 'sm' ? 16 : 20 }));
  }

  /* ---------------- Avatar / Crest ---------------- */
  function DefaultAvatar() {
    return h('svg', { viewBox: '0 0 160 160', width: '100%', height: '100%', 'aria-hidden': true },
      h('rect', { width: 160, height: 160, fill: 'var(--surface-3)' }),
      h('circle', { cx: 132, cy: 28, r: 44, fill: 'var(--line)' }),
      h('path', { d: 'M22 160c4-30 26-44 58-44s54 14 58 44z', fill: 'var(--brand)' }),
      h('path', { d: 'M62 118l18 18 18-18', fill: 'none', stroke: 'var(--on-brand)', strokeWidth: 5, strokeLinejoin: 'round' }),
      h('rect', { x: 68, y: 92, width: 24, height: 26, rx: 8, fill: '#d9a77f' }),
      h('ellipse', { cx: 80, cy: 70, rx: 28, ry: 32, fill: '#e8b98f' }),
      h('path', { d: 'M51 66c-2-24 12-38 30-38 17 0 31 11 29 34-6-9-16-14-28-14-12 0-23 6-31 18z', fill: '#1d1a19' }),
      h('ellipse', { cx: 70, cy: 74, rx: 3, ry: 4, fill: '#1d1a19' }),
      h('ellipse', { cx: 90, cy: 74, rx: 3, ry: 4, fill: '#1d1a19' }),
      h('path', { d: 'M73 88q7 5 14 0', fill: 'none', stroke: '#9b6a4a', strokeWidth: 3, strokeLinecap: 'round' }));
  }
  function Avatar(props) {
    var size = props.size || 56;
    return h('span', {
      className: cx('po-avatar', props.ring && 'po-avatar--ring', props.className),
      style: { width: size, height: size, borderRadius: props.shape === 'square' ? 'var(--radius-md)' : '50%' }
    }, props.src ? h('img', { src: props.src, alt: props.name || '' }) : h(DefaultAvatar));
  }
  function Crest(props) {
    var size = props.size || 28;
    var initial = (props.name || '?').trim().charAt(0);
    if (props.src) return h('img', { className: cx('po-crest', props.className), src: props.src, alt: props.name || '', width: size, height: size * 1.125 });
    var color = props.color || 'var(--brand)';
    return h('svg', { className: cx('po-crest', props.className), viewBox: '0 0 64 72', width: size, height: size * 1.125, role: 'img', 'aria-label': props.name },
      h('path', { d: 'M32 3l27 8v23c0 18-12 30-27 35C17 64 5 52 5 34V11z', fill: 'var(--surface-2)', stroke: color, strokeWidth: 4 }),
      h('text', { x: 32, y: 45, textAnchor: 'middle', fontSize: 26, fontWeight: 800, fill: color, fontFamily: 'var(--font-sans)' }, initial));
  }

  /* ---------------- Badges & chips ---------------- */
  var TIERS = { normal: '일반', key: '스페셜', top: '탑클래스', world: '월드클래스', legend: '레전더리' };
  function TierBadge(props) {
    var tier = props.tier || 'normal';
    return h('span', { className: cx('po-tier', 'po-tier--' + tier, props.size === 'sm' && 'po-tier--sm', props.className) },
      h('span', { className: 'po-tier__pips', 'aria-hidden': true },
        [0, 1, 2, 3, 4].map(function (i) { return h('i', { key: i, className: i <= Object.keys(TIERS).indexOf(tier) ? 'on' : '' }); })),
      h('span', null, TIERS[tier]),
      props.score != null && h('b', { className: 'po-num' }, props.score));
  }
  function ratingStep(v) { return v < 5 ? 1 : v < 6 ? 2 : v < 7 ? 3 : v < 8 ? 4 : 5; }
  function RatingBadge(props) {
    var v = props.value, size = props.size || 'md';
    return h('span', { className: cx('po-rating-wrap', props.className) },
      h('span', { className: cx('po-rating', 'po-rating--' + size, 'po-rating--s' + ratingStep(v)), 'aria-label': '평점 ' + fmt1(v) }, fmt1(v)),
      props.delta != null && h('span', { className: cx('po-delta', props.delta > 0 ? 'is-up' : props.delta < 0 ? 'is-down' : 'is-flat') },
        props.delta > 0 ? '▲' : props.delta < 0 ? '▼' : '', signed(props.delta)));
  }
  function StatChip(props) {
    return h('span', { className: cx('po-chip', 'po-chip--' + (props.tone || 'neutral'), props.className) },
      props.icon && h(Icon, { name: props.icon, size: 14 }),
      props.label && h('span', { className: 'po-chip__label' }, props.label),
      props.value != null && h('b', { className: 'po-num' }, props.value));
  }

  /* ---------------- Meters ---------------- */
  function Meter(props) {
    var max = props.max || 100, pct = Math.max(0, Math.min(100, (props.value / max) * 100));
    var gain = props.gain ? Math.min(100 - pct, (props.gain / max) * 100) : 0;
    return h('div', { className: cx('po-meter', 'po-meter--' + (props.tone || 'brand'), props.size === 'lg' && 'po-meter--lg', props.className) },
      (props.label || props.showValue) && h('div', { className: 'po-meter__head' },
        h('span', { className: 'po-meter__label' }, props.label),
        props.showValue && h('span', { className: 'po-num po-meter__value' }, props.value + (props.gain ? ' +' + props.gain : '') + ' / ' + max)),
      h('div', { className: 'po-meter__track', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': props.value, 'aria-label': props.label },
        h('div', { className: 'po-meter__fill', style: { width: pct + '%' } }),
        gain > 0 && h('div', { className: 'po-meter__gain', style: { left: pct + '%', width: gain + '%' } })));
  }
  function FatigueGauge(props) {
    var v = props.value || 0, level = v < 40 ? 'low' : v < 70 ? 'mid' : 'high';
    var on = Math.ceil(v / 10);
    return h('div', { className: cx('po-fatigue', 'po-fatigue--' + level, props.compact && 'po-fatigue--compact', props.className), role: 'meter', 'aria-valuenow': v, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': '피로' },
      !props.compact && h('span', { className: 'po-fatigue__label' }, '피로'),
      h('span', { className: 'po-fatigue__segs' }, Array.from({ length: 10 }, function (_, i) { return h('i', { key: i, className: i < on ? 'on' : '' }); })),
      h('b', { className: 'po-num' }, v));
  }
  var FORMS = [null, { l: '최악', i: 'double-down' }, { l: '나쁨', i: 'arrow-down' }, { l: '보통', i: 'arrow-flat' }, { l: '좋음', i: 'arrow-up' }, { l: '최고', i: 'double-up' }];
  function FormIndicator(props) {
    var lv = Math.max(1, Math.min(5, props.level || 3)), f = FORMS[lv];
    return h('span', { className: cx('po-form', 'po-form--' + lv, props.className), 'aria-label': '폼 ' + f.l },
      h('span', { className: 'po-form__icon' }, h(Icon, { name: f.i, size: props.size || 18, strokeWidth: 2.5 })),
      props.showLabel !== false && h('span', { className: 'po-form__label' }, f.l));
  }

  /* ---------------- StatBar ---------------- */
  function statStep(v) { return v < 40 ? 1 : v < 55 ? 2 : v < 65 ? 3 : v < 75 ? 4 : 5; }
  function StatBar(props) {
    var max = props.max || 99, v = props.value, add = props.add || 0;
    var editable = !!props.editable;
    return h('div', { className: cx('po-statbar', editable && 'po-statbar--edit', props.highlight && 'is-highlight', props.className) },
      h('span', { className: 'po-statbar__label' }, props.label),
      h('span', { className: 'po-statbar__track' },
        h('span', { className: cx('po-statbar__fill', 'po-step-' + statStep(v)), style: { width: (v / max) * 100 + '%' } }),
        add > 0 && h('span', { className: 'po-statbar__add', style: { left: (v / max) * 100 + '%', width: (add / max) * 100 + '%' } })),
      h('span', { className: 'po-statbar__value po-num' }, v + add, add > 0 && h('small', null, '+' + add)),
      editable && h('span', { className: 'po-statbar__ctrl' },
        h('span', { className: cx('po-statbar__cost', props.cost >= 2 && 'is-warn') }, props.cost != null && h('small', null, '비용'), props.cost != null && h('b', { className: 'po-num' }, props.cost)),
        h('span', { className: 'po-statbar__ovr po-num' }, props.ovrDelta != null && !props.maxed ? 'OVR +' + props.ovrDelta : props.maxed ? '최대' : ''),
        h('button', { type: 'button', className: 'po-iconbtn', disabled: add <= 0, onClick: props.onMinus, 'aria-label': props.label + ' 내리기' }, h(Icon, { name: 'minus', size: 16 })),
        h('button', { type: 'button', className: 'po-iconbtn po-iconbtn--brand', disabled: props.maxed || props.locked, onClick: props.onPlus, 'aria-label': props.label + ' 올리기' }, h(Icon, { name: props.maxed ? 'lock' : 'plus', size: 16 }))));
  }

  /* ---------------- PlayerCard ---------------- */
  function PlayerCard(props) {
    var p = props.player || props, tier = p.tier || 'normal', variant = props.variant || 'full';
    if (variant === 'compact') {
      return h('div', { className: cx('po-pcard', 'po-pcard--compact', 'po-tierframe--' + tier, props.className) },
        h(Avatar, { src: p.avatar, name: p.name, size: 48 }),
        h('div', { className: 'po-pcard__main' },
          h('div', { className: 'po-pcard__name' }, p.name),
          h('div', { className: 'po-pcard__meta' }, p.position, ' · ', p.age, '세 · ', p.team)),
        h('div', { className: 'po-pcard__ovrbox' }, h('b', { className: 'po-num' }, p.ovr), h('small', null, 'OVR')));
    }
    return h('div', { className: cx('po-pcard', 'po-tierframe--' + tier, props.className) },
      h('div', { className: 'po-pcard__sheen', 'aria-hidden': true }),
      h('div', { className: 'po-pcard__top' },
        h('div', { className: 'po-pcard__ovr' }, h('b', { className: 'po-num' }, p.ovr), h('span', { className: 'po-pcard__pos' }, p.position)),
        h(Avatar, { src: p.avatar, name: p.name, size: 96, shape: 'square' }),
        h('div', { className: 'po-pcard__side' },
          h(Crest, { name: p.team, src: p.crest, size: 28 }),
          h('span', { className: 'po-pcard__lv' }, 'LV', h('b', { className: 'po-num' }, p.level)))),
      h('div', { className: 'po-pcard__name' }, p.name),
      h('div', { className: 'po-pcard__meta' }, p.age, '세 · ', p.team),
      h('div', { className: 'po-pcard__tier' }, h(TierBadge, { tier: tier, score: p.tierScore, size: 'sm' })),
      p.xp != null && h(Meter, { value: p.xp, max: p.xpMax, label: 'XP', showValue: true, tone: 'xp', className: 'po-pcard__xp' }));
  }

  /* ---------------- Cards ---------------- */
  var CTYPES = { play: '플레이', setpiece: '세트피스', passive: '패시브', combo: '콤보', manage: '관리', signature: '시그니처', order: '지시' };
  /* 이전 키 호환: defense → 플레이 + 수비 태그, solo → 지시(독단) */
  var CTYPE_ALIAS = { defense: { type: 'play', pos: 'def' }, solo: { type: 'order', order: 'solo' } };
  var POS = { all: { l: '공용', i: 'pos-all' }, att: { l: '공격', i: 'pos-att' }, mid: { l: '미드', i: 'pos-mid' }, def: { l: '수비', i: 'defense' } };
  function normCard(c) { var a = CTYPE_ALIAS[c.type]; return a ? Object.assign({}, c, a, { pos: c.pos || a.pos }) : c; }
  function typeLabel(c) { return c.type === 'order' ? '지시 · ' + (c.order === 'solo' ? '독단' : '이행') : CTYPES[c.type] || c.type; }
  function typeIcon(c) { return c.type === 'play' ? 'newchoice' : c.type === 'order' ? (c.order === 'solo' ? 'solo' : 'order') : c.type; }
  var RARITY = { common: '일반', rare: '희귀', epic: '에픽', legend: '전설' };
  var CARD_W = 280, CARD_H = 392, ART_H = 210;
  var TRAJ = { setpiece: 'M44 268 Q 120 70 200 150', passive: 'M44 268 Q 110 200 180 170', combo: 'M44 268 Q 90 120 170 130', defense: 'M44 268 Q 150 230 190 160', manage: 'M44 268 Q 160 120 210 190', order: 'M44 268 Q 100 150 150 150 Q 190 150 205 110', solo: 'M44 268 Q 60 170 120 200 Q 190 236 220 120', play: 'M44 268 Q 70 120 140 140 Q 200 160 214 108', signature: 'M44 268 Q 140 40 206 168' };
  /* 스크린톤 없음. 그림은 날카로운 사선에서 잘리고, 경계 아래 희귀도 색 줄무늬 2줄(사선 분할). */
  var CUT = { clip: 'M0 0H280V172L0 206Z', overlay: [{ d: 'M0 211L280 177V182L0 216Z' }, { d: 'M0 221L280 187V189L0 223Z', op: 0.5 }] };
  var SCENE = (function () {
    var net = '', wall = '';
    for (var x = 84; x <= 196; x += 14) net += 'M' + x + ' 124V212 ';
    for (var y = 136; y <= 204; y += 14) net += 'M72 ' + y + 'H208 ';
    [112, 130, 148, 166].forEach(function (x) { wall += 'M' + (x - 7) + ' 224V200a7 7 0 0 1 14 0V224Z M' + (x - 6) + ' 184a6 6 0 1 0 12 0a6 6 0 1 0-12 0Z '; });
    return { net: net, wall: wall };
  })();
  var uidSeq = 0;
  function useUid(prefix) { var ref = React.useRef(null); if (!ref.current) ref.current = prefix + (++uidSeq); return ref.current; }
  /* 기본 그림: 조명 아래 골문, 수비벽, 공의 궤적. card.art(이미지 URL)가 있으면 그것을 쓴다. */
  function CardScene(props) {
    /* 카드 그림 이미지는 4:3(280×210) 칸에 꽉 채운다. 3:2 원본이면 좌우가 조금 잘린다. */
    /* card.artPos { x, y, zoom }: x = 오른쪽으로 이동(%), y = 위로 올림(%), 둘 다 그림 칸 크기 기준. zoom = 확대 배율(1 = 꽉 채움). */
    if (props.art) {
      var p = props.pos || {}, z = Math.max(1, Math.min(4, +p.zoom || 1)), iw = CARD_W * z, ih = props.sq ? iw : ART_H * z;
      var ix = (CARD_W - iw) / 2 + (+p.x || 0) * CARD_W / 100, iy = (ART_H - ih) / 2 - (+p.y || 0) * ART_H / 100;
      var img = function (k, t) { return h('image', { key: k, href: props.art, x: ix, y: iy, width: iw, height: ih, preserveAspectRatio: 'xMidYMid slice', transform: t }); };
      /* 옮겨서 드러난 가장자리는 그림을 거울처럼 이어 붙여 채운다(대부분 사선 아래 글자 패널에 가려진다). */
      var rot = Math.max(-45, Math.min(45, +p.rotate || 0)), cx = ix + iw / 2, cy = iy + ih / 2;
      var moved = (+p.x || 0) !== 0 || (+p.y || 0) !== 0 || rot !== 0;
      /* flip: 좌우 반전, rotate: 기울기(도, 시계 방향 +). 둘 다 그림 자기 가운데 기준이라 x 이동 방향은 그대로다. */
      var tf = (rot ? 'rotate(' + rot + ' ' + cx + ' ' + cy + ') ' : '') + (p.flip ? 'translate(' + 2 * cx + ' 0) scale(-1 1)' : '');
      return h(F, null, h('rect', { x: 0, y: 0, width: CARD_W, height: ART_H, fill: '#121317' }),
        h('g', { transform: tf || undefined },
          moved && [img('b', 'translate(0 ' + 2 * (iy + ih) + ') scale(1 -1)'), img('t', 'translate(0 ' + 2 * iy + ') scale(1 -1)'),
            img('l', 'translate(' + 2 * ix + ' 0) scale(-1 1)'), img('r', 'translate(' + 2 * (ix + iw) + ' 0) scale(-1 1)')],
          img('m')));
    }
    var a = 'var(--r)', thin = props.mini;
    if (props.placeholder !== 'scene') {
      /* 요청 6 규칙: 그림이 없으면 '기본 장면' 대신 조용한 플레이스홀더 — 단색 바탕 + 하프라인 + 종류 아이콘(희귀도 색 55%).
         그림 카드와 섞여도 '다른 화풍'이 아니라 '아직 그림 없음'으로 읽힌다. 좌표는 280×210 그림 칸 기준(full은 위로 10 옮겨 그린다). */
      var ic = P[props.icon] || P.dot, fil = !!FILLED[props.icon];
      return h(F, null,
        h('rect', { x: 0, y: 0, width: CARD_W, height: 440, fill: '#1a1d24' }),
        h('path', { d: 'M0 150H280', stroke: '#ffffff', strokeOpacity: 0.07, strokeWidth: 2 }),
        h('circle', { cx: 140, cy: 150, r: 64, fill: 'none', stroke: '#ffffff', strokeOpacity: 0.07, strokeWidth: 2 }),
        h('svg', { x: 92, y: thin ? 36 : 64, width: 96, height: 96, viewBox: '0 0 24 24', fill: fil ? a : 'none', stroke: a, strokeWidth: thin ? 2.2 : 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.55, style: { color: a } },
          h('path', { d: ic })));
    }
    return h(F, null,
      h('rect', { x: 0, y: 0, width: CARD_W, height: 440, fill: '#1a1d24' }),
      h('circle', { cx: 150, cy: 40, r: 190, style: { fill: a }, fillOpacity: 0.12 }),
      h('circle', { cx: 150, cy: 40, r: 100, style: { fill: a }, fillOpacity: 0.12 }),
      h('path', { d: 'M60 0H100L190 440H30Z', fill: '#ffffff', fillOpacity: 0.06 }),
      h('path', { d: 'M200 0H232L270 440H150Z', fill: '#ffffff', fillOpacity: 0.05 }),
      h('path', { d: 'M0 232L280 212V440H0Z', fill: '#20242c' }),
      h('path', { d: 'M0 262L280 242', stroke: '#ffffff', strokeOpacity: 0.2, strokeWidth: 2 }),
      h('path', { d: SCENE.net, stroke: '#ffffff', strokeOpacity: 0.22, strokeWidth: thin ? 1.5 : 1 }),
      h('path', { d: 'M70 214V120H210V206', stroke: '#e9ecf1', strokeWidth: thin ? 7 : 5, fill: 'none', strokeLinejoin: 'round' }),
      h('path', { d: SCENE.wall, fill: '#0b0c0f' }),
      h('path', { d: TRAJ[props.type] || TRAJ.passive, style: { stroke: a }, strokeWidth: thin ? 6 : 3, strokeDasharray: thin ? '12 10' : '7 6', fill: 'none', strokeLinecap: 'round' }),
      h('circle', { cx: 44, cy: 268, r: thin ? 14 : 11, fill: '#f3f4f6' }),
      !thin && h('path', { d: 'M44 263l4.5 3.2-1.7 5.3h-5.6l-1.7-5.3z', fill: '#121317' }));
  }
  function effectParts(c) {
    var e = c.effect;
    if (e && typeof e === 'object') return e;
    return { pre: e || '', hi: c.effectValue || '', post: '' };
  }
  function condOf(c) {
    if (c.condition) return c.condition;
    if (c.req) return { text: c.req, met: c.met !== false, current: c.current };
    return { text: '없음', met: true };
  }
  function FullCard(props) {
    var c = normCard(props.card), type = c.type || 'passive', clipId = useUid('po-clip-'), L = CUT;
    var e = effectParts(c), cond = condOf(c);
    return h('div', { className: 'po-gc' },
      h('svg', { className: 'po-gc__art', width: CARD_W, height: CARD_H, viewBox: '0 0 ' + CARD_W + ' ' + CARD_H, 'aria-hidden': true },
        h('defs', null, h('clipPath', { id: clipId }, h('path', { d: L.clip }))),
        h('g', { clipPath: 'url(#' + clipId + ')' }, h('g', { transform: c.art ? undefined : 'translate(0 -10)' }, h(CardScene, { type: type, icon: typeIcon(c), placeholder: c.placeholder, art: c.art, sq: c.artSquare, pos: c.artPos }))),
        L.overlay.map(function (o, i) {
          return h('path', { key: i, d: o.d, style: { fill: 'var(--r)' }, opacity: o.op });
        })),
      h('div', { className: 'po-gc__top' },
        h('span', { className: 'po-gc__rarity' }, RARITY[c.rarity || 'common']),
        h('span', { className: 'po-gc__chip' }, h(Icon, { name: typeIcon(c), size: 12, strokeWidth: 2.6, style: { color: 'var(--r)' } }), typeLabel(c))),
      c.pos && POS[c.pos] && h('span', { className: cx('po-gc__chip po-gc__pos', 'po-pos--' + c.pos) }, h(Icon, { name: POS[c.pos].i, size: 12, strokeWidth: 2.4 }), POS[c.pos].l),
      h('span', { className: 'po-gc__chip po-gc__lv' }, '숙련 Lv ' + (c.level || 1)),
      c.isNew && h('span', { className: 'po-gc__new' }, 'NEW'),
      h('div', { className: 'po-gc__body' },
        h('span', { className: 'po-gc__name' }, c.name),
        h('div', { className: 'po-gc__effect' },
          h('span', { className: 'po-gc__label' }, '효과'),
          h('span', { className: 'po-gc__text' }, e.pre, e.hi && h('b', { className: 'po-num' }, e.hi), e.post)),
        h('div', { className: 'po-gc__cond' },
          h('span', null, h('b', null, '조건'), ' ', cond.text),
          cond.current != null && h('span', { className: cx('po-gc__state', cond.met ? 'is-met' : 'is-unmet') },
            (cond.met ? '✓ 충족' : '✕ 미달') + ' · 현재 ' + cond.current))));
  }
  function MiniCard(props) {
    var c = normCard(props.card), type = c.type || 'passive';
    return h(F, null,
      h('svg', { className: 'po-mc__art', viewBox: c.art || c.placeholder !== 'scene' ? '0 0 280 210' : '20 90 240 300', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': true }, h(CardScene, { type: type, icon: typeIcon(c), placeholder: c.placeholder, art: c.art, sq: c.artSquare, pos: c.artPosMini || c.artPos, mini: true })),
      h('span', { className: 'po-mc__band' }),
      h('span', { className: 'po-mc__dot' }),
      c.pos && c.pos !== 'all' && POS[c.pos] && h('span', { className: cx('po-mc__pos', 'po-pos--' + c.pos), title: POS[c.pos].l }, h(Icon, { name: POS[c.pos].i, size: 10, strokeWidth: 2.6 })),
      h('span', { className: 'po-mc__name' }, c.name),
      c.count > 1 && h('span', { className: 'po-mc__count po-num' }, '×' + c.count));
  }
  function GameCard(props) {
    var c = normCard(props.card || props), size = props.size || 'deck', rarity = c.rarity || 'common', type = c.type || 'passive';
    var state = props.state || 'normal', blocked = state === 'disabled' || state === 'locked';
    var el = props.onClick ? 'button' : 'div';
    var full = size === 'full' || size === 'deck';
    return h(el, {
      type: el === 'button' ? 'button' : undefined, onClick: props.onClick, disabled: el === 'button' && blocked ? true : undefined,
      className: cx('po-card', 'po-card--' + size, 'po-rarity--' + rarity, 'is-' + state, props.className), style: props.style,
      'aria-label': c.name + ' (' + RARITY[rarity] + ' ' + typeLabel(c) + (c.pos && POS[c.pos] ? ' · ' + POS[c.pos].l : '') + ')'
    },
      full ? h('span', { className: 'po-card__scale' }, h(FullCard, { card: c })) : h(MiniCard, { card: c, size: size }),
      !full && c.isNew && h('span', { className: 'po-mc__new' }, 'NEW'),
      blocked && props.reason && h('span', { className: 'po-card__reason' }, props.reason));
  }
  function DeckSlot(props) {
    if (props.card) return h(GameCard, { card: props.card, size: 'mini', onClick: props.onClick, className: props.className });
    return h('button', { type: 'button', className: cx('po-slot-empty', props.className), onClick: props.onClick, 'aria-label': '빈 슬롯에 카드 넣기' },
      h('span', null, h(Icon, { name: 'plus', size: 18, strokeWidth: 2.4 })));
  }
  function CardHand(props) {
    var cards = props.cards || [], n = cards.length, mid = (n - 1) / 2;
    return h('div', { className: cx('po-hand', props.className), role: 'list', 'aria-label': '내 패' },
      cards.map(function (c, i) {
        var off = i - mid, sel = props.selectedId === c.id;
        var tf = 'translateY(' + (sel ? -16 : Math.abs(off) * Math.abs(off) * 1.6) + 'px) rotate(' + (sel ? 0 : off * 3) + 'deg)';
        return h('div', { key: c.id || i, role: 'listitem', className: cx('po-hand__slot', sel && 'is-sel'), style: { transform: tf, zIndex: sel ? 20 : 10 - Math.abs(Math.round(off)) } },
          h(GameCard, { card: c, size: 'hand', state: sel ? 'selected' : (c.disabled ? 'disabled' : 'normal'), onClick: props.onSelect ? function () { props.onSelect(c.id); } : undefined }));
      }));
  }

  /* ---------------- ChoiceButton ---------------- */
  var KINDS = { safe: '안전', balanced: '균형', gamble: '도박', play: '플레이 카드' };
  var KIND_ICON = { safe: 'safe', balanced: 'balanced', gamble: 'gamble', play: 'newchoice' };
  var OFFSIDE = { low: { l: '낮음', n: 1 }, mid: { l: '중간', n: 2 }, high: { l: '높음', n: 3 } };
  function ChoiceButton(props) {
    var s = props.success || {}, f = props.fail || {};
    var hasDelta = props.chanceDelta != null && props.chanceDelta !== 0;
    var shown = props.chance + (props.chanceDelta || 0);
    var kind = props.kind, off = props.offside && OFFSIDE[props.offside];
    return h('button', { type: 'button', onClick: props.onClick, disabled: props.disabled, 'aria-pressed': !!props.selected,
      className: cx('po-choice', kind && 'po-choice--' + kind, kind === 'play' && 'po-rarity--' + (props.rarity || 'rare'), props.compact && 'po-choice--compact', props.selected && 'is-selected', props.className) },
      h('span', { className: 'po-choice__main' },
        (kind || off) && h('span', { className: 'po-choice__tags' },
          kind && h('span', { className: 'po-kind po-kind--' + kind }, h(Icon, { name: KIND_ICON[kind] || kind, size: 12, strokeWidth: 2.4 }), KINDS[kind]),
          props.card && h('span', { className: 'po-choice__card' }, props.card),
          off && h('span', { className: 'po-offside po-offside--' + props.offside, title: '오프사이드 위험' },
            h(Icon, { name: 'offside', size: 12, strokeWidth: 2.2 }), '오프사이드 ' + off.l,
            h('span', { className: 'po-offside__bars', 'aria-hidden': true }, [1, 2, 3].map(function (i) { return h('i', { key: i, className: i <= off.n ? 'on' : '' }); })))),
        h('span', { className: 'po-choice__name' }, props.name, props.risk && h('span', { className: 'po-choice__risk' }, h(Icon, { name: 'risk', size: 12 }), props.risk)),
        h('span', { className: 'po-choice__outcomes' },
          h('span', { className: 'po-out po-out--ok' }, h(Icon, { name: 'check', size: 14, strokeWidth: 3 }), h('span', null, s.text), h('b', { className: 'po-num' }, signed(s.rating))),
          h('span', { className: 'po-out po-out--bad' }, h(Icon, { name: 'close', size: 14, strokeWidth: 3 }), h('span', null, f.text || '실패'), h('b', { className: 'po-num' }, signed(f.rating))))),
      h('span', { className: 'po-choice__prob' },
        hasDelta && h('s', { className: 'po-num' }, props.chance + '%'),
        h('b', { className: cx('po-num', hasDelta && (props.chanceDelta > 0 ? 'is-up' : 'is-down')) }, shown, h('small', null, '%')),
        hasDelta && h('span', { className: cx('po-choice__delta po-num', props.chanceDelta > 0 ? 'is-up' : 'is-down') },
          (props.chanceDelta > 0 ? '▲' : '▼') + signed(props.chanceDelta, 0), props.deltaSource && h('small', null, ' ' + props.deltaSource)),
        h('span', { className: 'po-choice__probbar' }, h('i', { style: { width: shown + '%' } }))));
  }

  /* ---------------- Feed ---------------- */
  var FEED = { normal: 'dot', goal: 'ball', concede: 'ball', danger: 'danger', chance: 'chance', shot: 'shot', save: 'save', corner: 'corner', freekick: 'freekick', penalty: 'penalty', foul: 'foul', offside: 'offside', advantage: 'advantage', yellow: 'card', red: 'card', sub: 'sub', injury: 'injury', half: 'clock', throwin: 'throwin', goalkick: 'goalkick', tactic: 'tactic' };
  function FeedItem(props) {
    var kind = props.kind || 'normal';
    return h('div', { className: cx('po-feed', 'po-feed--' + kind, props.mine && 'is-mine', (props.faint || kind === 'throwin' || kind === 'goalkick') && 'is-faint', props.className) },
      h('span', { className: 'po-feed__min po-num' }, props.minute != null ? props.minute + "'" : ''),
      h('span', { className: 'po-feed__icon' }, h(Icon, { name: FEED[kind] || 'dot', size: kind === 'goal' ? 20 : 16 })),
      h('span', { className: 'po-feed__text' },
        props.children || props.text,
        props.score && h('b', { className: 'po-feed__score po-num' }, props.score)),
      props.mine && h('span', { className: 'po-feed__tag' }, '나'));
  }

  /* ---------------- Match chrome ---------------- */
  function redTag(red, players) {
    if (!red) return null;
    return h('span', { className: 'po-score__red', 'aria-label': '레드카드 ' + red + '장, ' + (players || 11 - red) + '명' },
      h('i', { className: 'po-score__redcard' }), h('b', { className: 'po-num' }, (players || 11 - red) + '명'));
  }
  function sceneStrip(props, solo) {
    var view = props.view, sc = props.scene || {}, total = sc.total || 7, idx = sc.index || 0;
    return h('div', { className: cx('po-strip', view && 'po-strip--' + view, solo && 'po-strip--solo', solo && props.className) },
      h('div', { className: 'po-strip__row' },
        h('span', { className: 'po-strip__lead' },
          view === 'live' ? h('i', { className: 'po-live' }) : view === 'halftime' ? h(Icon, { name: 'clock', size: 13 }) : view && h(Icon, { name: 'video', size: 13 }),
          view === 'live' ? h('span', null, h('b', null, '실시간'), ' · ', h('span', { className: 'po-num' }, (sc.minute != null ? sc.minute : props.minute) + "'")) :
          view === 'halftime' ? h('b', null, '하프타임') :
          view === 'transition' ? h('span', null, h('b', null, '장면 전환'), ' · 다음 ', h('span', { className: 'po-num' }, (idx + 1) + '/' + total)) :
          view ? h('span', null, h('b', null, '하이라이트'), ' · 장면 ', h('span', { className: 'po-num' }, idx + '/' + total), sc.minute != null && [' · ', h('span', { key: 'm', className: 'po-num' }, sc.minute + "'")], sc.label && ' ' + sc.label) : null),
        h('span', { className: 'po-strip__acts' },
          (view === 'highlight' || view === 'transition') && h('button', { type: 'button', className: 'po-strip__btn', disabled: view === 'transition', onClick: props.onLive }, h(Icon, { name: 'play', size: 11, filled: true }), '여기서부터 실시간'),
          view === 'live' && h('button', { type: 'button', className: 'po-strip__btn', onClick: props.onHighlight }, h(Icon, { name: 'video', size: 11 }), '하이라이트로 돌아가기'),
          h('button', { type: 'button', className: cx('po-strip__gear', props.settingsOn && 'is-on'), 'aria-label': '경기 설정', 'aria-expanded': props.settingsOn || undefined, onClick: props.onSettings }, h(Icon, { name: 'settings', size: 17 })))),
      (view === 'highlight' || view === 'transition') && h('div', { className: 'po-strip__ticks', 'aria-hidden': true },
        Array.from({ length: total }, function (_, i) { return h('i', { key: i, className: cx(i + 1 < idx && 'is-done', i + 1 === idx && (view === 'transition' ? 'is-done' : 'is-on'), view === 'transition' && i === idx && 'is-next') }); })),
      props.sceneNote && h('span', { className: 'po-strip__note' }, h(Icon, { name: props.sceneNoteIcon || 'throwin', size: 12 }), props.sceneNote));
  }
  function SceneStrip(props) { return sceneStrip(props, true); }
  function ScoreBar(props) {
    var speeds = props.speeds || ['1×', '2×', '4×'];
    var view = props.view;
    var strip = (view || props.onSettings || props.settings) && sceneStrip(props);
    var lockSpeed = view === 'transition' || view === 'halftime';
    return h('div', { className: cx('po-score', props.paused && 'is-paused', props.mode && 'po-score--mode', view && 'po-score--strip', props.className) },
      strip,
      h('div', { className: 'po-score__teams' },
        h('span', { className: 'po-score__team' }, h('span', { className: 'po-score__id' }, h(Crest, { name: props.home, size: 22 }), h('span', null, props.home)), redTag(props.homeRed, props.homePlayers)),
        h('span', { className: 'po-score__board' },
          h('b', { className: 'po-num' }, props.homeScore), h('i', null, '-'), h('b', { className: 'po-num' }, props.awayScore)),
        h('span', { className: 'po-score__team po-score__team--away' }, h('span', { className: 'po-score__id' }, h('span', null, props.away), h(Crest, { name: props.away, size: 22, color: 'var(--away)' })), redTag(props.awayRed, props.awayPlayers))),
      h('div', { className: 'po-score__row' },
        h('span', { className: cx('po-score__min', props.status && !props.ff && 'has-status', props.ff && 'is-ff') },
          props.ff ? h(Icon, { name: 'ff', size: 12, filled: true }) : props.paused ? h(Icon, { name: 'pause', size: 12, strokeWidth: 3 }) : h('i', { className: 'po-live' }),
          h('span', { className: 'po-num' }, props.minute + "'"), props.minuteTo != null && h('span', { className: 'po-num po-score__to' }, '→ ' + props.minuteTo + "'"), props.ff ? h('span', null, '빨리 감기') : props.status && h('span', null, props.status)),
        props.mode && h('span', { className: 'po-mode', role: 'group', 'aria-label': '진행 방식' },
          ['manual', 'auto'].map(function (m) {
            return h('button', { key: m, type: 'button', className: cx('po-mode__btn', props.mode === m && 'is-on'), 'aria-pressed': props.mode === m, onClick: props.onMode && function () { props.onMode(m); } }, m === 'manual' ? '직접' : '자동');
          })),
        props.speed !== false && h('span', { className: cx('po-speed', lockSpeed && 'is-disabled'), role: 'group', 'aria-label': '경기 속도', 'aria-disabled': lockSpeed || undefined },
          h('button', { type: 'button', className: 'po-speed__btn', 'aria-label': props.paused ? '재생' : '일시정지', onClick: props.onPause },
            h(Icon, { name: props.paused ? 'play' : 'pause', size: 14, strokeWidth: 2.5 })),
          speeds.map(function (s) {
            return h('button', { key: s, type: 'button', className: cx('po-speed__btn', props.speed === s && 'is-on'), 'aria-pressed': props.speed === s, onClick: props.onSpeed && function () { props.onSpeed(s); } }, s);
          }),
          h('button', { type: 'button', className: 'po-speed__btn', 'aria-label': '건너뛰기', onClick: props.onSkip }, h(Icon, { name: 'skip', size: 14 })))),
      (props.homeTactic || props.awayTactic) && h('div', { className: 'po-score__tactics' },
        props.homeTactic ? h(TacticChip, Object.assign({ size: 'xs' }, props.homeTactic)) : h('span'),
        props.awayTactic ? h(TacticChip, Object.assign({ size: 'xs', away: true }, props.awayTactic)) : h('span')));
  }
  function PossessionBar(props) {
    var v = props.home != null ? props.home : 50;
    return h('div', { className: cx('po-poss', props.className) },
      h('span', { className: 'po-num po-poss__us' }, v + '%'),
      h('span', { className: 'po-poss__track' }, h('i', { className: 'po-poss__home', style: { width: v + '%' } }), h('i', { className: 'po-poss__away' })),
      h('span', { className: 'po-num po-poss__them' }, (100 - v) + '%'),
      props.label !== false && h('span', { className: 'po-poss__label' }, props.label || '점유율'));
  }
  function AppBar(props) {
    return h('header', { className: cx('po-appbar', props.className) },
      h('div', { className: 'po-appbar__title' },
        props.crest !== false && h(Crest, { name: props.team, size: 24, src: props.crest }),
        h('div', null, h('b', null, props.team), h('small', null, props.subtitle))),
      h('div', { className: 'po-appbar__actions' },
        h('button', { type: 'button', className: 'po-iconbtn po-iconbtn--ghost', 'aria-label': '알림' }, h(Icon, { name: 'bell' }), props.unread > 0 && h('span', { className: 'po-dotbadge po-num' }, props.unread)),
        h('button', { type: 'button', className: 'po-iconbtn po-iconbtn--ghost', 'aria-label': '저장', onClick: props.onSave }, h(Icon, { name: 'disk' }))));
  }
  function Tabs(props) {
    var variant = props.variant || 'segment';
    return h('div', { className: cx('po-tabs', 'po-tabs--' + variant, props.fill && 'po-tabs--fill', props.scroll && 'po-tabs--scroll', props.cols && 'po-tabs--grid', props.className), role: 'tablist', 'aria-label': props.label, style: props.cols ? { gridTemplateColumns: 'repeat(' + props.cols + ', minmax(0, 1fr))' } : undefined },
      (props.items || []).map(function (it) {
        var on = it.id === props.value;
        return h('button', { key: it.id, type: 'button', role: 'tab', 'aria-selected': on, className: cx('po-tab', on && 'is-on'), onClick: props.onChange && function () { props.onChange(it.id); } },
          it.icon && h(Icon, { name: it.icon, size: variant === 'nav' ? 22 : 16, strokeWidth: on && variant === 'nav' ? 2.4 : 2 }),
          h('span', null, it.label),
          it.badge != null && h('span', { className: 'po-dotbadge po-num' }, it.badge));
      }));
  }

  /* ---------------- Feedback ---------------- */
  var BANNER_ICON = { injury: 'injury', warning: 'danger', info: 'info', success: 'check' };
  function Banner(props) {
    var tone = props.tone || 'info';
    return h('div', { className: cx('po-banner', 'po-banner--' + tone, props.className), role: tone === 'injury' || tone === 'warning' ? 'alert' : 'status' },
      h('span', { className: 'po-banner__icon' }, h(Icon, { name: BANNER_ICON[tone], size: 18 })),
      h('div', { className: 'po-banner__body' }, h('b', null, props.title), props.children && h('p', null, props.children)),
      props.action && h('button', { type: 'button', className: 'po-banner__action', onClick: props.onAction }, props.action));
  }
  var TOAST_ICON = { levelup: 'levelup', badge: 'star', card: 'combo', info: 'info' };
  function Toast(props) {
    var kind = props.kind || 'info';
    return h('div', { className: cx('po-toast', 'po-toast--' + kind, props.className), role: 'status' },
      h('span', { className: 'po-toast__icon' }, h(Icon, { name: TOAST_ICON[kind], size: 22 })),
      h('div', { className: 'po-toast__body' }, h('b', null, props.title), props.body && h('span', null, props.body)),
      props.action && h('button', { type: 'button', className: 'po-toast__action', onClick: props.onAction }, props.action));
  }
  function BottomSheet(props) {
    if (props.open === false) return null;
    var sheet = h('div', { className: cx('po-sheet', props.className), role: 'dialog', 'aria-modal': !props.inline, 'aria-label': props.title },
      h('span', { className: 'po-sheet__grip', 'aria-hidden': true }),
      (props.title || props.eyebrow) && h('div', { className: 'po-sheet__head' },
        props.eyebrow && h('span', { className: 'po-sheet__eyebrow' }, props.eyebrow),
        props.title && h('b', null, props.title),
        props.subtitle && h('p', null, props.subtitle)),
      h('div', { className: 'po-sheet__body' }, props.children),
      props.footer && h('div', { className: 'po-sheet__foot' }, props.footer));
    if (props.inline) return sheet;
    return h('div', { className: 'po-overlay po-overlay--sheet', onClick: function (e) { if (e.target === e.currentTarget && props.onClose) props.onClose(); } }, sheet);
  }
  function Modal(props) {
    if (props.open === false) return null;
    var box = h('div', { className: cx('po-modal', props.className), role: 'dialog', 'aria-modal': !props.inline, 'aria-label': props.title },
      props.icon && h('span', { className: 'po-modal__icon po-modal__icon--' + (props.tone || 'info') }, h(Icon, { name: props.icon, size: 24 })),
      h('b', { className: 'po-modal__title' }, props.title),
      props.children && h('div', { className: 'po-modal__body' }, props.children),
      props.actions && h('div', { className: 'po-modal__actions' }, props.actions));
    if (props.inline) return box;
    return h('div', { className: 'po-overlay', onClick: function (e) { if (e.target === e.currentTarget && props.onClose) props.onClose(); } }, box);
  }
  function ResultSplash(props) {
    var ok = props.result !== 'fail';
    return h('div', { className: cx('po-splash', ok ? 'po-splash--ok' : 'po-splash--bad', props.className), role: 'status' },
      h('span', { className: 'po-splash__stamp' }, h(Icon, { name: ok ? 'check' : 'close', size: 28, strokeWidth: 3.5 }), ok ? '성공' : '실패'),
      h('b', { className: 'po-splash__title' }, props.title),
      props.detail && h('span', { className: 'po-splash__detail' }, props.detail),
      props.rating != null && h(RatingBadge, { value: props.rating, delta: props.ratingDelta, size: 'lg' }));
  }



  /* ---------------- Pitch ---------------- */
  var PW = 105, PH = 68;
  var ARROW_TONE = { safe: 'var(--choice-safe)', balanced: 'var(--choice-balanced)', gamble: 'var(--choice-gamble)', shot: '#f3f4f6', pass: 'var(--brand)', dribble: 'var(--mine)', cross: 'var(--brand)' };
  function px(p) { return [p[0] / 100 * PW, p[1] / 100 * PH]; }
  function Pitch(props) {
    if (props.orient === 'vertical') return h(PitchV, props);
    var id = useUid('po-pitch-');
    var players = props.players || [], arrows = props.arrows || [];
    var lineC = 'rgba(255,255,255,0.16)';
    return h('div', { className: cx('po-pitch', props.className), role: 'img', 'aria-label': props.label || '경기장: 선수 ' + players.length + '명' },
      h('svg', { viewBox: '0 0 ' + PW + ' ' + PH, width: '100%', className: 'po-pitch__svg' },
        h('defs', null,
          ['safe', 'balanced', 'gamble', 'shot', 'pass', 'dribble', 'cross'].map(function (k) {
            return h('marker', { key: k, id: id + '-' + k, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: 'auto-start-reverse' },
              h('path', { d: 'M0 0L10 5L0 10z', style: { fill: ARROW_TONE[k] } }));
          })),
        h('rect', { x: 0, y: 0, width: PW, height: PH, className: 'po-pitch__grass' }),
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return i % 2 ? h('rect', { key: i, x: i * 10.5, y: 0, width: 10.5, height: PH, className: 'po-pitch__stripe' }) : null; }),
        h('g', { fill: 'none', stroke: lineC, strokeWidth: 0.35 },
          h('rect', { x: 1, y: 1, width: PW - 2, height: PH - 2 }),
          h('path', { d: 'M52.5 1V67' }),
          h('circle', { cx: 52.5, cy: 34, r: 9.15 }),
          h('path', { d: 'M1 13.84H17.5V54.16H1 M1 24.84H6.5V43.16H1 M104 13.84H87.5V54.16H104 M104 24.84H98.5V43.16H104' }),
          h('path', { d: 'M17.5 26.7a9.15 9.15 0 0 1 0 14.6 M87.5 26.7a9.15 9.15 0 0 0 0 14.6' }),
          h('path', { d: 'M1 30.34H-0.8V37.66H1 M104 30.34H105.8V37.66H104', strokeWidth: 0.6, stroke: 'rgba(255,255,255,0.35)' })),
        h('g', { fill: lineC }, h('circle', { cx: 52.5, cy: 34, r: 0.5 }), h('circle', { cx: 12, cy: 34, r: 0.4 }), h('circle', { cx: 93, cy: 34, r: 0.4 })),
        props.offsideX != null && h('g', { className: 'po-pitch__offside' },
          h('path', { d: 'M' + (props.offsideX / 100 * PW) + ' 1V67', strokeDasharray: '1.6 1.2' }),
          h('text', { x: props.offsideX / 100 * PW + 1, y: 4.6 }, '오프사이드 라인')),
        arrows.map(function (a, i) {
          var f = px(a.from), t = px(a.to), tone = a.tone || a.kind || 'pass';
          var d = 'M' + f[0] + ' ' + f[1] + (a.curve ? ' Q ' + ((f[0] + t[0]) / 2 + a.curve[0]) + ' ' + ((f[1] + t[1]) / 2 + a.curve[1]) + ' ' : ' L ') + t[0] + ' ' + t[1];
          if (a.kind === 'dribble') {
            var n = 7, dd = 'M' + f[0] + ' ' + f[1];
            for (var k = 1; k <= n; k++) { var q = k / n, x = f[0] + (t[0] - f[0]) * q, y = f[1] + (t[1] - f[1]) * q, nx = -(t[1] - f[1]), ny = t[0] - f[0], L = Math.hypot(nx, ny) || 1, w = k === n ? 0 : (k % 2 ? 1.1 : -1.1); dd += ' L ' + (x + nx / L * w) + ' ' + (y + ny / L * w); }
            d = dd;
          }
          return h('path', { key: 'a' + i, d: d, fill: 'none', style: { stroke: ARROW_TONE[tone] || tone }, strokeWidth: a.kind === 'shot' ? 0.9 : 0.6, strokeDasharray: a.kind === 'pass' || a.kind === 'through' || a.kind === 'cross' ? '1.6 1' : undefined, strokeLinecap: 'round', strokeLinejoin: 'round', markerEnd: 'url(#' + id + '-' + (ARROW_TONE[tone] ? tone : 'pass') + ')', opacity: a.ghost ? 0.35 : 1 });
        }),
        players.map(function (p, i) {
          var c = px([p.x, p.y]), me = p.me, r = me ? 2.5 : 1.9;
          return h('g', { key: 'p' + i, className: cx('po-pl', 'po-pl--' + (p.team || 'home'), me && 'is-me', p.dim && 'is-dim', p.flag && 'is-flag') },
            me && h('circle', { cx: c[0], cy: c[1], r: r + 1.1, className: 'po-pl__halo' }),
            h('circle', { cx: c[0], cy: c[1], r: r, className: 'po-pl__dot' }),
            p.num != null && h('text', { x: c[0], y: c[1] + 0.75, className: 'po-pl__num', fontSize: me ? 2.4 : 2 }, p.num),
            p.label && h('g', null,
              h('rect', { x: c[0] - p.label.length * 1.05 - 1, y: c[1] - r - 5.2, width: p.label.length * 2.1 + 2, height: 3.6, rx: 0.9, className: 'po-pl__tagbg' }),
              h('text', { x: c[0], y: c[1] - r - 2.6, className: 'po-pl__tag' }, p.label)),
            p.flag && h('path', { d: 'M' + (c[0] + 2.2) + ' ' + (c[1] - 1) + 'v-5 l3.4 1.3 -3.4 1.3', className: 'po-pl__flag' }));
        }),
        props.ball && h('g', { className: 'po-ball' },
          h('circle', { cx: px(props.ball)[0], cy: px(props.ball)[1], r: 1.05 })),
        props.marks && props.marks.map(function (m, i) {
          var c = px([m.x, m.y]);
          return h('g', { key: 'm' + i, className: 'po-mark po-mark--' + (m.tone || 'brand') },
            h('rect', { x: c[0] - m.text.length * 1.15 - 1.6, y: c[1] - 2.4, width: m.text.length * 2.3 + 3.2, height: 4.8, rx: 1.2 }),
            h('text', { x: c[0], y: c[1] + 0.95 }, m.text));
        })),
      props.children && h('div', { className: 'po-pitch__overlay' }, props.children));
  }

  /* ---------------- Layout pieces ---------------- */
  function HeroPanel(props) {
    var pct = props.total ? Math.round((props.value / props.total) * 100) : null;
    var val = typeof props.value === 'number' && props.pad !== false ? String(props.value).padStart(2, '0') : props.value;
    var isText = typeof val === 'string' && /[^0-9.,:\/%+\-−·× ]/.test(val.replace(/[위세점명P일R골개]$/, ''));
    return h('section', { className: cx('po-hero', props.compact && 'po-hero--compact', isText && 'po-hero--text', props.className) },
      h('div', { className: 'po-hero__bar' },
        props.onBack !== false ? h('button', { type: 'button', className: 'po-hero__back', 'aria-label': '뒤로', onClick: props.onBack }, h(Icon, { name: 'chevron-right', size: 18, strokeWidth: 2.4, style: { transform: 'scaleX(-1)' } })) : h('span', null),
        h('span', { className: 'po-hero__title' }, props.title),
        h('span', { className: 'po-hero__right' }, props.right)),
      props.eyebrow && h('span', { className: 'po-hero__eyebrow' }, props.eyebrow),
      props.value != null && h('div', { className: 'po-hero__num' },
        h('span', { className: 'po-hero__value po-num' }, val),
        props.total != null && h('span', { className: 'po-hero__total po-num' }, '/ ' + props.total)),
      pct != null && props.progress !== false && h('div', { className: 'po-hero__progress' },
        h('span', { className: 'po-hero__track' }, h('i', { style: { width: pct + '%' } })),
        h('span', { className: 'po-num' }, pct + '%')),
      props.chips && h('div', { className: 'po-hero__chips' }, props.chips.map(function (c, i) {
        var ch = typeof c === 'string' ? { label: c } : c;
        return h('span', { key: i, className: cx('po-hero__chip', ch.soft && 'is-soft') }, ch.label);
      })),
      props.children);
  }
  function SectionTitle(props) {
    return h('div', { className: cx('po-section', props.className) },
      h('span', { className: 'po-section__bar', 'aria-hidden': true }),
      h(props.as || 'h2', { className: 'po-section__title' }, props.title),
      props.action && h('span', { className: 'po-section__action' }, props.action));
  }

  /* ---------------- Tactics ---------------- */
  var TSTYLES = { balanced: '균형', tikitaka: '티키타카', gegen: '게겐프레싱', counter: '역습', direct: '직선', block: '수비 블록' };
  var TSTYLE_ICON = { balanced: 't-balanced', tikitaka: 't-tikitaka', gegen: 't-gegen', counter: 't-counter', direct: 't-direct', block: 't-block' };
  var FIT = { good: { l: '잘 맞음', s: '✓' }, ok: { l: '보통', s: '–' }, bad: { l: '안 맞음', s: '✕' } };
  function FitBadge(props) {
    var f = FIT[props.fit] || FIT.ok;
    return h('span', { className: cx('po-fit', 'po-fit--' + (props.fit || 'ok'), props.className), 'aria-label': '적합도 ' + f.l },
      h('i', { 'aria-hidden': true }, f.s), props.label ? props.label + ' ' + f.l : f.l);
  }
  function TacticEmblem(props) {
    var size = props.size || 40;
    return h('span', { className: cx('po-temblem', props.away && 'is-away', props.on && 'is-on', props.className), style: { width: size, height: size }, role: 'img', 'aria-label': TSTYLES[props.tactic] },
      h(Icon, { name: TSTYLE_ICON[props.tactic] || 't-balanced', size: Math.round(size * 0.55), strokeWidth: 2.2 }));
  }
  function TacticChip(props) {
    var size = props.size || 'md', el = props.onClick ? 'button' : 'span';
    var em = size === 'xs' ? 16 : size === 'sm' ? 22 : 30;
    return h(el, { type: el === 'button' ? 'button' : undefined, onClick: props.onClick, 'aria-pressed': el === 'button' ? !!props.selected : undefined,
      className: cx('po-tchip', 'po-tchip--' + size, props.selected && 'is-on', props.away && 'is-away', props.className) },
      h(TacticEmblem, { tactic: props.tactic, size: em, away: props.away, on: props.selected }),
      h('span', { className: 'po-tchip__text' },
        props.team && h('b', { className: 'po-tchip__team' }, props.team),
        h('span', { className: 'po-tchip__name' }, TSTYLES[props.tactic] || props.tactic),
        props.formation && h('span', { className: 'po-tchip__form po-num' }, props.formation)),
      props.fit && h(FitBadge, { fit: props.fit }));
  }
  /* 세로 미니 피치: x 0~100(왼→오), y 0~100(우리 골문 아래 → 상대 골문 위) */
  function FormationPitch(props) {
    var slots = props.slots || [];
    return h('div', { className: cx('po-fpitch', props.compact && 'po-fpitch--compact', props.className), style: props.height ? { height: props.height } : undefined, role: 'img', 'aria-label': props.label || '포메이션' },
      h('svg', { className: 'po-fpitch__lines', viewBox: '0 0 68 100', preserveAspectRatio: 'none', 'aria-hidden': true },
        h('rect', { x: 1, y: 1, width: 66, height: 98, rx: 2 }),
        h('path', { d: 'M1 50H67 M20 1v14h28V1 M28 1v5h12V1 M20 99V85h28v14 M28 99v-5h12v5' }),
        h('ellipse', { cx: 34, cy: 50, rx: 8, ry: 6 })),
      props.grid && h('div', { className: 'po-fpitch__grid', 'aria-hidden': true }, Array.from({ length: 30 }, function (_, i) { return h('i', { key: i }); })),
      (props.cells || []).map(function (c, i) {
        return h('div', { key: 'c' + i, className: cx('po-fcell', 'po-fcell--' + (c.tone || 'target')), style: { left: c.col * 20 + '%', bottom: c.row * (100 / 6) + '%' } }, c.label && h('span', null, c.label));
      }),
      slots.map(function (s, i) {
        return h('div', { key: s.id || i, className: cx('po-fslot', s.me && 'is-me', s.selected && 'is-sel', s.dim && 'is-dim', s.warn && 'is-warn', s.drag && 'is-drag', s.ghost && 'is-ghost'), style: { left: s.x + '%', top: (100 - s.y) + '%' } },
          h('span', { className: 'po-fslot__dot' }, h('b', null, s.pos), s.me && h('span', { className: 'po-fslot__me' }, '나')),
          !props.compact && s.name && h('span', { className: 'po-fslot__name' }, s.name),
          !props.compact && s.role && h('span', { className: 'po-fslot__role' }, s.role),
          s.ovr != null && h('span', { className: cx('po-fslot__ovr po-num', s.ovrDown && 'is-down') }, s.ovr));
      }));
  }
  function OptionRow(props) {
    var el = props.onClick ? 'button' : 'div';
    return h(el, { type: el === 'button' ? 'button' : undefined, onClick: props.onClick, role: props.radio ? 'radio' : undefined, 'aria-checked': props.radio ? !!props.selected : undefined,
      className: cx('po-option', props.selected && 'is-on', props.disabled && 'is-disabled', props.className) },
      props.icon && h('span', { className: 'po-option__icon' }, h(Icon, { name: props.icon, size: 20 })),
      h('span', { className: 'po-option__main' },
        h('b', null, props.title),
        props.desc && h('span', null, props.desc),
        props.note && h('em', { className: 'po-option__note' }, h(Icon, { name: 'signature', size: 12, strokeWidth: 2.2 }), props.note)),
      (props.right || props.fit || props.tag) && h('span', { className: 'po-option__right' }, props.tag && h('span', { className: 'po-option__tag' }, props.tag), props.fit && h(FitBadge, { fit: props.fit }), props.right),
      props.radio && h('span', { className: 'po-option__radio', 'aria-hidden': true }));
  }
  function Slider(props) {
    var v = Math.max(0, Math.min(100, props.value != null ? props.value : 50));
    return h('div', { className: cx('po-slider', props.className) },
      h('div', { className: 'po-slider__head' }, h('b', null, props.label), props.valueLabel && h('span', null, props.valueLabel)),
      h('div', { className: 'po-slider__track', role: 'slider', 'aria-label': props.label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': v },
        h('i', { className: 'po-slider__fill', style: { width: v + '%' } }),
        [25, 50, 75].map(function (t) { return h('i', { key: t, className: 'po-slider__tick', style: { left: t + '%' } }); }),
        h('span', { className: 'po-slider__thumb', style: { left: v + '%' } })),
      (props.left || props.right) && h('div', { className: 'po-slider__ends' }, h('span', null, props.left), h('span', null, props.right)));
  }

  function Switch(props) {
    return h('div', { className: cx('po-switchrow', props.className) },
      h('span', { className: 'po-switchrow__main' }, h('b', null, props.label), props.desc && h('span', null, props.desc)),
      h('button', { type: 'button', role: 'switch', 'aria-checked': !!props.on, 'aria-label': props.label, className: cx('po-switch', props.on && 'is-on'), onClick: props.onChange && function () { props.onChange(!props.on); } }, h('i')));
  }
  function CellGauge(props) {
    var n = props.cells || 30, v = Math.max(0, Math.min(n, props.value || 0)), add = props.add || 0;
    return h('div', { className: cx('po-cells', props.className) },
      (props.label || props.valueLabel) && h('div', { className: 'po-cells__head' }, h('b', null, props.label), h('span', { className: 'po-num' }, props.valueLabel != null ? props.valueLabel : v + ' / ' + n)),
      h('div', { className: 'po-cells__row', role: 'meter', 'aria-label': props.label, 'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': v },
        Array.from({ length: n }, function (_, i) { return h('i', { key: i, className: i < v ? 'on' : i < v + add ? 'add' : '' }); })));
  }


  /* ================= 요청 5: 새 컴포넌트 ================= */

  /* ---------------- Dock ---------------- */
  /* 요청 6: 홈은 항상 가운데(폰 6칸 = 왼쪽 2fr+1fr · 홈 · 오른쪽 1fr×3, PC 9칸 = 5번째). 진행 칸은 맨 왼쪽(넓은 알약). */
  var DOCK_PHONE = [
    { id: 'progress' }, { id: 'player', label: '선수', icon: 'player' }, { id: 'home', label: '홈', icon: 'home' },
    { id: 'schedule', label: '훈련·일정', icon: 'calendar' }, { id: 'world', label: '월드', icon: 'world' }, { id: 'more', label: '더보기', icon: 'menu' }];
  var DOCK_PC = [
    { id: 'progress' }, { id: 'player', label: '선수', icon: 'player' }, { id: 'schedule', label: '훈련·일정', icon: 'calendar' }, { id: 'deck', label: '덱', icon: 'deck' },
    { id: 'home', label: '홈', icon: 'home' },
    { id: 'tactic', label: '전술', icon: 'tactic' }, { id: 'world', label: '월드', icon: 'world' }, { id: 'settings', label: '설정', icon: 'settings' }, { id: 'save', label: '저장', icon: 'disk' }];
  var PROGRESS = {
    'continue': { label: '계속', icon: 'chevron-right' }, match: { label: '경기', icon: 'match' }, live: { label: '경기 중', icon: 'match' },
    answer: { label: '답하기', icon: 'chat' }, season: { label: '시즌 요약', icon: 'trophy' } };
  function Dock(props) {
    var pc = props.device === 'pc', items = pc ? DOCK_PC : DOCK_PHONE;
    var badges = props.badges || {}, locked = props.locked || [], st = PROGRESS[props.progress || 'continue'] || PROGRESS['continue'];
    return h('nav', { className: cx('po-dock', pc && 'po-dock--pc', props.className), 'aria-label': '메뉴' },
      items.map(function (it) {
        if (it.id === 'progress') {
          return h('button', { key: it.id, type: 'button', className: cx('po-dock__go', 'is-' + (props.progress || 'continue'), props.value === 'progress' && 'is-on'), onClick: props.onSelect && function () { props.onSelect('progress'); } },
            h('span', { className: 'po-dock__goicon' }, props.progress === 'live' ? h('i', { className: 'po-dock__live' }) : null, h(Icon, { name: st.icon, size: 20, strokeWidth: 2.4 }),
              h('span', { className: 'po-dock__golabel' }, st.label),
              badges.progress != null && h('b', { className: 'po-dock__badge po-num' }, badges.progress)));
        }
        var lock = locked.indexOf(it.id) >= 0, on = props.value === it.id;
        if (it.id === 'home') {
          return h('button', { key: it.id, type: 'button', 'aria-current': on ? 'page' : undefined, className: cx('po-dock__home', on && 'is-on'), onClick: props.onSelect && function () { props.onSelect('home'); } },
            h('span', { className: 'po-dock__homeicon' }, h(Icon, { name: 'home', size: pc ? 22 : 26, strokeWidth: 2.4 }),
              badges.home != null && h('b', { className: 'po-dock__badge po-num' }, badges.home)),
            h('span', { className: 'po-dock__label' }, it.label));
        }
        return h('button', { key: it.id, type: 'button', disabled: lock, 'aria-current': on ? 'page' : undefined, className: cx('po-dock__item', on && 'is-on', lock && 'is-locked'), onClick: props.onSelect && function () { props.onSelect(it.id); } },
          h('span', { className: 'po-dock__icon' }, h(Icon, { name: it.icon, size: 22, strokeWidth: on ? 2.4 : 2 }),
            lock && h('span', { className: 'po-dock__lock' }, h(Icon, { name: 'lock', size: 10, strokeWidth: 2.6 })),
            !lock && badges[it.id] != null && h('b', { className: 'po-dock__badge po-num' }, badges[it.id])),
          h('span', { className: 'po-dock__label' }, it.label));
      }));
  }

  /* ---------------- AttrTile / AttrGrid ---------------- */
  function attrBand(v) { return v >= 17 ? 'top' : v >= 15 ? 'good' : v >= 13 ? 'ok' : v >= 10 ? 'mid' : 'low'; }
  function AttrTile(props) {
    var v = props.value, add = props.add || 0, shown = v + add, prog = Math.max(0, Math.min(1, props.progress || 0));
    var sel = props.editable && props.selected;
    return h(props.onClick ? 'button' : 'div', { type: props.onClick ? 'button' : undefined, onClick: props.onClick,
      className: cx('po-attr', 'po-attr--' + attrBand(shown), props.keyAttr && 'is-key', props.editable && 'is-edit', sel && 'is-selected', props.maxed && 'is-maxed', props.className) },
      h('span', { className: 'po-attr__name' }, props.name),
      h('span', { className: 'po-attr__row' },
        h('b', { className: 'po-attr__val po-num' }, shown),
        add > 0 ? h('span', { className: 'po-attr__add po-num' }, '+' + add) : props.delta ? h('span', { className: cx('po-attr__delta po-num', props.delta < 0 && 'is-down') }, signed(props.delta, 0)) : null),
      h('span', { className: 'po-attr__bar' }, h('i', { style: { width: prog * 100 + '%' } })),
      props.editable && props.cost != null && h('span', { className: 'po-attr__cost' }, h('b', { className: 'po-num' }, props.maxed ? '최대' : props.cost + 'P'), !props.maxed && props.ovrDelta != null && h('span', { className: 'po-num' }, 'OVR +' + props.ovrDelta)),
      sel && h('span', { className: 'po-attr__ctrl' },
        h('span', { role: 'button', 'aria-label': props.name + ' 내리기', className: cx('po-attr__btn', add <= 0 && 'is-off') }, h(Icon, { name: 'minus', size: 16, strokeWidth: 2.6 })),
        h('span', { role: 'button', 'aria-label': props.name + ' 올리기', className: cx('po-attr__btn po-attr__btn--plus', props.maxed && 'is-off') }, h(Icon, { name: 'plus', size: 16, strokeWidth: 2.6 }))));
  }
  function AttrGrid(props) {
    var cols = props.columns || 3;
    return h('div', { className: cx('po-attrgrid', props.className) },
      (props.groups || []).map(function (g, gi) {
        return h('section', { key: gi, className: 'po-attrgrid__group' },
          h('header', { className: 'po-attrgrid__head' }, h('b', null, g.name), g.note && h('span', null, g.note)),
          h('div', { className: 'po-attrgrid__grid', style: { gridTemplateColumns: 'repeat(' + cols + ', minmax(0, 1fr))' } },
            (g.items || []).map(function (a, i) { return h(AttrTile, Object.assign({ key: i, editable: props.editable }, a)); })));
      }));
  }

  /* ---------------- DayCell ---------------- */
  function DayCell(props) {
    var kind = props.kind || 'train';
    return h(props.onClick ? 'button' : 'div', { type: props.onClick ? 'button' : undefined, onClick: props.onClick,
      className: cx('po-day', 'po-day--' + kind, props.today && 'is-today', props.selected && 'is-selected', props.fixed && 'is-fixed', props.past && 'is-past', props.className) },
      h('span', { className: 'po-day__dow' }, props.day),
      h('b', { className: 'po-day__date po-num' }, props.date),
      h('span', { className: 'po-day__icon' }, h(Icon, { name: props.icon || (kind === 'match' ? 'ball' : kind === 'rest' ? 'rest' : 'train'), size: 18 }),
        props.fixed && h('span', { className: 'po-day__lock' }, h(Icon, { name: 'lock', size: 9, strokeWidth: 2.8 }))),
      h('span', { className: 'po-day__label' }, props.label),
      props.today && h('span', { className: 'po-day__today' }, '오늘'));
  }

  /* ---------------- OfferCard ---------------- */
  function OfferCard(props) {
    var o = props.offer || props;
    return h('article', { className: cx('po-offer', o.loan && 'is-loan', props.selected && 'is-selected', props.className) },
      h('header', { className: 'po-offer__head' },
        h(Crest, { name: o.club, src: o.crest, size: 36, color: o.color }),
        h('span', { className: 'po-offer__club' }, h('b', null, o.club), h('span', null, o.league + (o.rank != null ? ' · ' + o.rank + '위' : ''))),
        h('span', { className: 'po-offer__tags' }, finChip(o.tier, true),
          o.loan ? h('span', { className: 'po-offer__tag is-loan' }, '임대') : o.tag && h('span', { className: 'po-offer__tag' }, o.tag))),
      o.homeClub && h('span', { className: 'po-offer__home' }, h(Icon, { name: 'home', size: 12, strokeWidth: 2.6 }), o.homeClub),
      h('dl', { className: 'po-offer__grid' },
        h('div', null, h('dt', null, '팀 전력'), h('dd', { className: 'po-num' }, o.strength)),
        h('div', null, h('dt', null, '예상 출전'), h('dd', { className: 'po-num' }, o.apps + '%')),
        h('div', null, h('dt', null, '예상 선발'), h('dd', { className: 'po-num' }, o.starts + '%')),
        h('div', null, h('dt', null, o.loan ? '임대 기간' : '계약'), h('dd', null, o.years, o.fee && h('small', { className: 'po-offer__fee' }, '이적료 ' + o.fee)))),
      h('div', { className: 'po-offer__wage' },
        h('span', null, '주급 ', h('b', { className: 'po-num' }, o.weekly)),
        h('span', null, '연봉 ', h('b', { className: 'po-num' }, o.yearly)),
        o.note && h('em', null, o.note)),
      props.actions !== false && h('div', { className: 'po-offer__actions' },
        h(Button, { variant: 'secondary', size: 'md', block: true, onClick: props.onReject }, '거절'),
        h(Button, { size: 'md', block: true, onClick: props.onAccept, icon: 'check' }, '수락')));
  }

  /* 요청 6 · 재정 등급 칩: 4단 막대(채운 칸 수) + 글자. 색을 쓰지 않아 순위표·제안·소식 어디서나 같은 모양. */
  var FIN_N = { '빅클럽': 4, '상위': 3, '중위': 2, '하위': 1 };
  function finChip(t, sm) {
    if (!t || !FIN_N[t]) return null;
    var n = FIN_N[t];
    return h('span', { className: cx('po-fin', sm && 'po-fin--sm'), title: '재정 등급 ' + t },
      h('span', { className: 'po-fin__bars', 'aria-hidden': true }, [0, 1, 2, 3].map(function (k) { return h('i', { key: k, className: k < n ? 'on' : '', style: { height: 4 + k * 2 } }); })), t);
  }
  /* ---------------- TransferRow ---------------- */
  function TransferRow(props) {
    if (props.fill) {
      return h('div', { className: cx('po-xfer po-xfer--fill', props.className) },
        h('span', { className: 'po-xfer__fillmark' }, '↳'),
        h('span', { className: 'po-xfer__filltext' }, '빈자리 보충 · ', h('b', null, props.name), ' ', props.pos, ' ', h('span', { className: 'po-num' }, props.age + '세 · OVR ' + props.ovr)),
        props.from && h('span', { className: 'po-xfer__fillfrom' }, props.from + '에서'));
    }
    return h('div', { className: cx('po-xfer', props.mine && 'is-mine', props.className) },
      h(Avatar, { src: props.avatar, name: props.name, size: 40 }),
      h('span', { className: 'po-xfer__main' },
        h('span', { className: 'po-xfer__name' }, h('b', null, props.name), h('span', { className: 'po-xfer__pos' }, props.pos), h('span', { className: 'po-num' }, props.age + '세')),
        h('span', { className: 'po-xfer__move' },
          h(Crest, { name: props.from, size: 14, color: 'var(--ink-faint)' }), h('span', null, props.from),
          h(Icon, { name: 'chevron-right', size: 12, strokeWidth: 2.6 }),
          h(Crest, { name: props.to, size: 14 }), h('b', null, props.to), finChip(props.toTier, true)),
        props.fee != null && h('span', { className: 'po-xfer__fee' }, '몸값 ', h('b', { className: 'po-num' }, props.fee))),
      h('span', { className: 'po-xfer__side' },
        h('b', { className: 'po-num' }, props.ovr), h('span', null, props.status)));
  }

  /* ---------------- TextField ---------------- */
  function TextField(props) {
    var has = props.value != null && props.value !== '';
    return h('label', { className: cx('po-field', props.focused && 'is-focus', props.className) },
      props.label && h('span', { className: 'po-field__label' }, props.label, props.count && h('span', { className: 'po-num' }, props.count)),
      h('span', { className: 'po-field__box' },
        props.icon && h(Icon, { name: props.icon, size: 18 }),
        h('span', { className: cx('po-field__value', !has && 'is-ph') }, has ? props.value : props.placeholder, props.focused && h('i', { className: 'po-field__caret' })),
        has && props.clearable !== false && h('span', { className: 'po-field__clear', role: 'button', 'aria-label': '지우기' }, h(Icon, { name: 'close', size: 14, strokeWidth: 2.6 }))),
      props.hint && h('span', { className: 'po-field__hint' }, props.hint));
  }

  /* ---------------- Pitch — vertical (요청 5) ---------------- */
  var VW = 68, VH = 105;
  function pxv(p) { return [p[1] / 100 * VW, (100 - p[0]) / 100 * VH]; }
  function shortName(p) {
    if (p.short) return p.short;
    var l = p.label || ''; var s = l.split('.').pop();
    return s.length > 3 ? s.slice(0, 3) : s;
  }
  function labelW(t, fs) { var w = 0; for (var i = 0; i < t.length; i++) w += /[ㄱ-힝]/.test(t[i]) ? fs * 0.98 : fs * 0.58; return w + fs * 0.9; }
  function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
  function layoutLabels(players, ball, mode, scale, fs, collide) {
    var out = {}; if (mode === 'off') return out;
    var bc = ball ? pxv(ball) : null;
    var order = players.map(function (p, i) {
      var c = pxv([p.x, p.y]); var d = bc ? Math.hypot(c[0] - bc[0], c[1] - bc[1]) : 0;
      return { i: i, p: p, c: c, pr: p.me ? 0 : p.ball ? 1 : 2, d: d };
    }).filter(function (o) { return o.p.label && (mode !== 'mine' || o.p.me); });
    order.sort(function (a, b) { return a.pr - b.pr || a.d - b.d; });
    var marks = players.map(function (p, i) { var c = pxv([p.x, p.y]), r = (p.me ? 2.3 : 1.8) * scale; return { i: i, x: c[0] - r, y: c[1] - r, w: r * 2, h: r * 2 }; });
    var placed = [];
    order.forEach(function (o) {
      var r = (o.p.me ? 2.3 : 1.8) * scale, cands = [];
      [o.p.label, shortName(o.p)].forEach(function (t, k) {
        if (k === 1 && t === o.p.label) return;
        var w = labelW(t, fs), hh = fs * 1.5;
        cands.push({ t: t, short: k === 1, x: o.c[0] - w / 2, y: o.c[1] + r + 0.4, w: w, h: hh });
        cands.push({ t: t, short: k === 1, x: o.c[0] - w / 2, y: o.c[1] - r - 0.4 - hh, w: w, h: hh });
      });
      var ok = null;
      for (var k = 0; k < cands.length && !ok; k++) {
        var c = cands[k]; c.x = Math.max(0.6, Math.min(VW - 0.6 - c.w, c.x));
        if (collide === false || o.pr < 2 || (!placed.some(function (b) { return overlap(c, b); }) && !marks.some(function (m) { return m.i !== o.i && overlap(c, m); }))) ok = c;
      }
      if (ok) { placed.push(ok); out[o.i] = ok; } else out[o.i] = { hidden: true };
    });
    return out;
  }
  function pixelChar(cx0, cy0, s, team, me, p, band, clash) {
    // 8×10 도트 캐릭터. s = 도트 한 칸 크기(viewBox 단위). p.kit = { kit, kit2, pattern: 'solid'|'stripe'|'hoop', skin, hair } (요청 6)
    var k = (p && p.kit) || {};
    var shirt = k.kit || (team === 'away' ? 'var(--team-away)' : 'var(--team-home)'), shirt2 = k.kit2 || shirt;
    var map = ['..hhhh..', '.hhhhhh.', '.hssssh.', '.ssssss.', '..ssss..', 'tttttttt', 'tttttttt', '.tttttt.', '.kk..kk.', '.kk..kk.'];
    if (k.hair === 'none') map = map.map(function (r, i) { return i < 2 ? (i === 0 ? '........' : '..ssss..') : r.replace(/h/g, 's'); });
    var col = { h: k.hair && k.hair !== 'none' ? k.hair : '#2a1d16', s: k.skin || '#e8b894', t: shirt, k: '#f3f4f6' };
    var x0 = cx0 - 4 * s, y0 = cy0 - 5 * s, rects = [];
    map.forEach(function (row, y) { for (var x = 0; x < 8; x++) { var ch = row[x]; if (ch === '.') continue;
      var f = col[ch];
      if (ch === 't' && k.pattern === 'stripe' && x % 2 === 1) f = shirt2;
      if (ch === 't' && k.pattern === 'hoop' && y % 2 === 0) f = shirt2;
      rects.push(h('rect', { key: x + '-' + y, x: x0 + x * s, y: y0 + y * s, width: s + 0.02, height: s + 0.02, fill: f })); } });
    var tc = team === 'away' ? 'var(--team-away)' : 'var(--team-home)';
    return h('g', { shapeRendering: 'crispEdges' },
      me && h('rect', { x: x0 - s, y: y0 - s, width: 10 * s, height: 12 * s + (band ? 3.4 * s : 0), fill: 'none', stroke: 'var(--mine)', strokeWidth: 0.45 }),
      clash && team === 'away' && h('rect', { x: x0 - 0.3 * s, y: y0 + 4.7 * s, width: 8.6 * s, height: 3.6 * s, fill: 'none', stroke: 'var(--team-away)', strokeWidth: s * 0.55 }),
      rects,
      band && p && p.num != null && h('g', null,
        h('rect', { x: x0 - 0.5 * s, y: y0 + 10.4 * s, width: 9 * s, height: 3 * s, rx: 0.6 * s, fill: tc }),
        h('text', { x: cx0, y: y0 + 12.55 * s, className: 'po-pv__band', fontSize: 2.5 * s }, p.num)));
  }
  function faceMarker(c, r, team, me, src, uid) {
    var ring = me ? 'var(--mine)' : team === 'away' ? 'var(--team-away)' : 'var(--team-home)';
    return h('g', null,
      h('clipPath', { id: uid }, h('circle', { cx: c[0], cy: c[1], r: r })),
      h('circle', { cx: c[0], cy: c[1], r: r, fill: 'var(--surface-3)' }),
      src ? h('image', { href: src, x: c[0] - r, y: c[1] - r, width: r * 2, height: r * 2, clipPath: 'url(#' + uid + ')', preserveAspectRatio: 'xMidYMid slice' }) :
        h('g', { clipPath: 'url(#' + uid + ')' },
          h('ellipse', { cx: c[0], cy: c[1] + r * 0.95, rx: r * 0.95, ry: r * 0.6, fill: team === 'away' ? 'var(--team-away)' : 'var(--team-home)' }),
          h('circle', { cx: c[0], cy: c[1] - r * 0.12, r: r * 0.46, fill: '#e8b894' }),
          h('path', { d: 'M' + (c[0] - r * 0.48) + ' ' + (c[1] - r * 0.2) + 'a' + r * 0.48 + ' ' + r * 0.44 + ' 0 0 1 ' + r * 0.96 + ' 0z', fill: '#2a1d16' })),
      h('circle', { cx: c[0], cy: c[1], r: r, fill: 'none', stroke: ring, strokeWidth: me ? 0.7 : 0.45 }));
  }
  function PitchV(props) {
    var id = useUid('po-pv-');
    var players = props.players || [], arrows = props.arrows || [];
    var sz = { md: 1, lg: 1.25, xl: 1.5 }[props.size || 'md'] || 1;
    var marker = props.marker || 'number';
    var fs = 2.05 * (props.size === 'xl' ? 1.15 : 1);
    var crop = props.crop || [0, 100];
    var y0 = (100 - crop[1]) / 100 * VH, hh = (crop[1] - crop[0]) / 100 * VH;
    var lab = layoutLabels(players, props.ball, props.names || 'all', sz, fs, props.collide);
    var dotU = (props.dot || 2) / ((props.renderWidth || 358) / VW);
    var lineC = 'rgba(255,255,255,0.16)';
    return h('div', { className: cx('po-pitch po-pitch--v', props.className), role: 'img', 'aria-label': props.label || '세로 경기장: 선수 ' + players.length + '명' },
      h('svg', { viewBox: '0 ' + y0 + ' ' + VW + ' ' + hh, width: '100%', className: 'po-pitch__svg' },
        h('defs', null,
          ['safe', 'balanced', 'gamble', 'shot', 'pass', 'dribble', 'cross'].map(function (k) {
            return h('marker', { key: k, id: id + '-' + k, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: 'auto-start-reverse' },
              h('path', { d: 'M0 0L10 5L0 10z', style: { fill: ARROW_TONE[k] } }));
          })),
        h('rect', { x: 0, y: 0, width: VW, height: VH, className: 'po-pitch__grass' }),
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (i) { return i % 2 ? h('rect', { key: i, x: 0, y: i * 10.5, width: VW, height: 10.5, className: 'po-pitch__stripe' }) : null; }),
        h('g', { fill: 'none', stroke: lineC, strokeWidth: 0.35 },
          h('rect', { x: 1, y: 1, width: VW - 2, height: VH - 2 }),
          h('path', { d: 'M1 52.5H67' }),
          h('circle', { cx: 34, cy: 52.5, r: 9.15 }),
          h('path', { d: 'M13.84 1V17.5H54.16V1 M24.84 1V6.5H43.16V1 M13.84 104V87.5H54.16V104 M24.84 104V98.5H43.16V104' }),
          h('path', { d: 'M26.7 17.5a9.15 9.15 0 0 0 14.6 0 M26.7 87.5a9.15 9.15 0 0 1 14.6 0' }),
          h('path', { d: 'M30.34 1V-0.8H37.66V1 M30.34 104V105.8H37.66V104', strokeWidth: 0.6, stroke: 'rgba(255,255,255,0.35)' })),
        h('g', { fill: lineC }, h('circle', { cx: 34, cy: 52.5, r: 0.5 }), h('circle', { cx: 34, cy: 12, r: 0.4 }), h('circle', { cx: 34, cy: 93, r: 0.4 })),
        props.offsideX != null && h('g', { className: 'po-pitch__offside' },
          h('path', { d: 'M1 ' + ((100 - props.offsideX) / 100 * VH) + 'H67', strokeDasharray: '1.6 1.2' }),
          h('text', { x: 1.6, y: (100 - props.offsideX) / 100 * VH - 1 }, '오프사이드 라인')),
        arrows.map(function (a, i) {
          var f = pxv(a.from), t = pxv(a.to), tone = a.tone || a.kind || 'pass';
          var d = 'M' + f[0] + ' ' + f[1] + (a.curve ? ' Q ' + ((f[0] + t[0]) / 2 + a.curve[1]) + ' ' + ((f[1] + t[1]) / 2 - a.curve[0]) + ' ' : ' L ') + t[0] + ' ' + t[1];
          return h('path', { key: 'a' + i, d: d, fill: 'none', style: { stroke: ARROW_TONE[tone] || tone }, strokeWidth: a.kind === 'shot' ? 0.9 : 0.6, strokeDasharray: a.kind === 'pass' || a.kind === 'through' || a.kind === 'cross' ? '1.6 1' : undefined, strokeLinecap: 'round', markerEnd: 'url(#' + id + '-' + (ARROW_TONE[tone] ? tone : 'pass') + ')', opacity: a.ghost ? 0.35 : 1 });
        }),
        players.map(function (p, i) {
          var c = pxv([p.x, p.y]), me = p.me, r = (me ? 2.3 : 1.8) * sz, team = p.team || 'home';
          return h('g', { key: 'p' + i, className: cx('po-pl', 'po-pl--' + team, me && 'is-me', p.dim && 'is-dim') },
            marker === 'pixel' ? pixelChar(c[0], c[1], dotU, team, me, p, props.band !== false, props.kitClash) :
            marker === 'face' ? faceMarker(c, r, team, me, p.face, id + '-f' + i) :
              h(F, null,
                me && h('circle', { cx: c[0], cy: c[1], r: r + 1.1, className: 'po-pl__halo' }),
                h('circle', { cx: c[0], cy: c[1], r: r, className: 'po-pl__dot' }),
                p.num != null && h('text', { x: c[0], y: c[1] + 0.68 * sz, className: 'po-pl__num', fontSize: (me ? 2.1 : 1.8) * sz }, p.num)),
            p.ball && h('circle', { cx: c[0] + r * 0.8, cy: c[1] + r * 0.8, r: 0.9, className: 'po-pv__ballmark' }));
        }),
        props.ball && h('g', { className: 'po-ball' }, h('circle', { cx: pxv(props.ball)[0], cy: pxv(props.ball)[1], r: 1.05 })),
        players.map(function (p, i) {
          var L = lab[i]; if (!L || L.hidden) return null;
          return h('g', { key: 'l' + i, className: cx('po-pv__label', p.me && 'is-me', p.ball && 'is-ball', L.short && 'is-short') },
            h('rect', { x: L.x, y: L.y, width: L.w, height: L.h, rx: 0.8 }),
            h('text', { x: L.x + L.w / 2, y: L.y + L.h * 0.7, fontSize: fs }, L.t));
        }),
        props.marks && props.marks.map(function (m, i) {
          var c = pxv([m.x, m.y]);
          return h('g', { key: 'm' + i, className: 'po-mark po-mark--' + (m.tone || 'brand') },
            h('rect', { x: c[0] - m.text.length * 1.15 - 1.6, y: c[1] - 2.4, width: m.text.length * 2.3 + 3.2, height: 4.8, rx: 1.2 }),
            h('text', { x: c[0], y: c[1] + 0.95 }, m.text));
        })),
      props.children && h('div', { className: 'po-pitch__overlay' }, props.children));
  }


  /* ================= 요청 6 새 컴포넌트 ================= */
  /* ---------------- Stepper ---------------- */
  function Stepper(props) {
    var v = props.value, min = props.min, max = props.max, dis = !!props.disabled;
    var atMin = dis || (min != null && v <= min), atMax = dis || (max != null && v >= max);
    var range = props.range != null ? props.range : (min != null && max != null ? min + '~' + max + (props.unit || '') : null);
    return h('div', { className: cx('po-stepper', dis && 'is-disabled', props.size === 'sm' && 'po-stepper--sm', props.className) },
      (props.label || range) && h('span', { className: 'po-stepper__head' }, props.label && h('b', null, props.label), range && h('span', { className: 'po-num' }, range)),
      h('span', { className: 'po-stepper__box' },
        h('button', { type: 'button', className: 'po-stepper__btn', disabled: atMin, 'aria-label': (props.label || '값') + ' 내리기', onClick: props.onMinus }, h(Icon, { name: 'minus', size: 18, strokeWidth: 2.6 })),
        h('span', { className: 'po-stepper__mid' },
          h('span', { className: 'po-stepper__val' }, h('b', { className: 'po-num' }, v), props.unit && h('small', null, props.unit)),
          props.sub && h('span', { className: cx('po-stepper__sub', props.subTone && 'is-' + props.subTone) }, props.sub)),
        h('button', { type: 'button', className: 'po-stepper__btn', disabled: atMax, 'aria-label': (props.label || '값') + ' 올리기', onClick: props.onPlus }, h(Icon, { name: 'plus', size: 18, strokeWidth: 2.6 }))));
  }

  /* ---------------- PointBar ---------------- */
  function PointBar(props) {
    var left = props.left, total = props.total || 0, used = total - left;
    var st = left < 0 ? 'over' : left === 0 ? 'zero' : 'left';
    var pct = total > 0 ? Math.max(0, Math.min(1, used / total)) : 0;
    var msg = props.message || (st === 'over' ? '✕ ' + (-left) + 'P 넘쳤어요 · 시작할 수 없어요' : st === 'zero' ? '✓ 다 썼어요' : '남았어요');
    return h('div', { className: cx('po-pointbar', 'is-' + st, props.sticky && 'is-sticky', props.className), role: 'status', 'aria-live': 'polite' },
      h('div', { className: 'po-pointbar__row' },
        h('span', { className: 'po-pointbar__label' }, props.label || '배분 포인트'),
        h('b', { className: 'po-pointbar__left po-num' }, left, h('small', null, 'P')),
        h('span', { className: 'po-pointbar__total po-num' }, '/ ' + total + 'P'),
        h('span', { className: 'po-pointbar__msg' }, msg)),
      h('span', { className: 'po-pointbar__track' }, h('i', { style: { width: (st === 'over' ? 100 : pct * 100) + '%' } })),
      props.items && props.items.length > 0 && h('span', { className: 'po-pointbar__items' },
        props.items.map(function (it, i) {
          var v = it.value, z = v === 0 || v == null;
          return h('span', { key: i, className: cx('po-pointbar__item', !z && (v > 0 ? 'is-plus' : 'is-minus'), it.base && 'is-base') },
            it.label, ' ', h('b', { className: 'po-num' }, it.base ? v : z ? '0' : signed(v, 0)));
        })));
  }

  /* ---------------- TagChip ---------------- */
  /* 규칙: 색 = 장점(초록)/단점(빨강)/효과 없음(회색). 맨 앞 기호 = 종류(± 생성 · 핀 커리어 · 별 플레이 · 말풍선 스토리). 점선 테두리 = 해제형(조건을 채우면 사라짐). 취소선 = 해제됨. */
  var TAG_KIND = { gen: { l: '생성 태그' }, career: { l: '커리어 태그', i: 'pin' }, play: { l: '플레이 태그', i: 'star' }, story: { l: '스토리 태그', i: 'chat' } };
  function TagChip(props) {
    var kind = TAG_KIND[props.kind] ? props.kind : 'gen', pol = kind === 'story' ? 'none' : (props.polarity || 'pro');
    var K = TAG_KIND[kind], rel = !!props.release;
    var tip = [K.l + (pol === 'pro' ? ' · 장점' : pol === 'con' ? ' · 단점' : ''), props.scope && props.scope + '에서만 효과', rel && '해제형 · ' + props.release, props.released && '해제됨', props.desc].filter(Boolean).join('\n');
    return h(props.onClick ? 'button' : 'span', { type: props.onClick ? 'button' : undefined, onClick: props.onClick, title: tip, 'aria-label': props.name + ' — ' + tip.replace(/\n/g, ' · '),
      className: cx('po-tag', 'po-tag--' + kind, 'po-tag--' + pol, rel && 'is-release', props.released && 'is-released', props.size === 'sm' && 'po-tag--sm', props.className) },
      h('span', { className: 'po-tag__mark', 'aria-hidden': true }, K.i ? h(Icon, { name: K.i, size: props.size === 'sm' ? 11 : 13, strokeWidth: 2.6, filled: kind === 'play' }) : (pol === 'con' ? '−' : '+')),
      h('span', { className: 'po-tag__name' }, props.name),
      props.scope && props.showScope && h('span', { className: 'po-tag__scope' }, props.scope),
      rel && h('span', { className: 'po-tag__rel', 'aria-hidden': true }, h(Icon, { name: 'clock', size: props.size === 'sm' ? 10 : 12, strokeWidth: 2.6 })),
      kind === 'story' && h('span', { className: 'po-tag__none' }, '효과 없음'));
  }

  /* ---------------- PixelTile ---------------- */
  /* 16×16 도트. sprite = { kind: 'person'|'kit', skin, hair('none' = 민머리), hairStyle: 'short'|'long'|'curly', kit, kit2, pattern: 'solid'|'stripe'|'hoop' } 또는 src(16px PNG). 크기는 16의 정수배만(scale 1~6). */
  var PX_PERSON = ['................', '.....hhhhhh.....', '....hhhhhhhh....', '....hssssssh....', '....ssssssss....', '....sesssses....', '....ssssssss....', '.....ssssss.....',
    '......ssss......', '...tttttttttt...', '..tttttttttttt..', '..tttttttttttt..', '..tttttttttttt..', '..tttttttttttt..', '..tttttttttttt..', '..tttttttttttt..'];
  var PX_KIT = ['................', '................', '...tttc..cttt...', '..ttttcccctttt..', '.tttttttttttttt.', 'tttttttttttttttt', 'tttttttttttttttt', 'ttt.tttttttt.ttt',
    '....tttttttt....', '....tttttttt....', '....tttttttt....', '....tttttttt....', '....tttttttt....', '....tttttttt....', '....tttttttt....', '................'];
  function pixelMap(sp) {
    var m = (sp.kind === 'kit' ? PX_KIT : PX_PERSON).slice();
    if (sp.kind !== 'kit') {
      if (sp.hair === 'none') m = m.map(function (r, i) { return i === 1 ? '................' : i === 2 ? '.....ssssss.....' : r.replace(/h/g, 's'); });
      else if (sp.hairStyle === 'long') { m[4] = '...hssssssssh...'; m[5] = '...hsesssssesh..'.replace('sesssssesh..', 'sesssesh...'); m[5] = '...h' + 'sesssses' + 'h...'; m[6] = '...hssssssssh...'; m[7] = '....hssssssh....'; }
      else if (sp.hairStyle === 'curly') { m[0] = '....hhhhhhhh....'; m[1] = '...hhhhhhhhhh...'; m[2] = '...hhhhhhhhhh...'; m[3] = '...hhssssssh....'; }
    }
    return m;
  }
  function PixelSprite(props) {
    var sp = props.sprite || {}, m = pixelMap(sp), size = props.size, rects = [];
    var col = { h: sp.hair && sp.hair !== 'none' ? sp.hair : '#2a1d16', s: sp.skin || '#e8b894', e: '#121317', t: sp.kit || 'var(--team-home)', c: sp.kit2 || '#f3f4f6' };
    m.forEach(function (row, y) { for (var x = 0; x < 16; x++) { var ch = row[x]; if (!ch || ch === '.') continue;
      var f = col[ch];
      if (ch === 't' && sp.pattern === 'stripe' && Math.floor(x / 2) % 2 === 1) f = sp.kit2 || '#f3f4f6';
      if (ch === 't' && sp.pattern === 'hoop' && Math.floor(y / 2) % 2 === 1) f = sp.kit2 || '#f3f4f6';
      rects.push(h('rect', { key: x + '-' + y, x: x, y: y, width: 1, height: 1, fill: f })); } });
    return h('svg', { className: 'po-pixel__svg', width: size, height: size, viewBox: '0 0 16 16', shapeRendering: 'crispEdges', 'aria-hidden': true }, rects);
  }
  function PixelTile(props) {
    var sc = Math.max(1, Math.min(6, Math.round(props.scale || 3))), size = 16 * sc;
    return h(props.onClick ? 'button' : 'div', { type: props.onClick ? 'button' : undefined, onClick: props.onClick, 'aria-pressed': props.onClick ? !!props.selected : undefined, title: props.title || props.label,
      className: cx('po-pixel', props.selected && 'is-selected', props.isDefault && 'is-default', props.disabled && 'is-disabled', props.className), style: { '--px-size': size + 'px' } },
      h('span', { className: 'po-pixel__art' },
        props.src ? h('img', { src: props.src, width: size, height: size, alt: '', className: 'po-pixel__img' }) : h(PixelSprite, { sprite: props.sprite, size: size }),
        props.isDefault && h('span', { className: 'po-pixel__def' }, '기본'),
        props.selected && h('span', { className: 'po-pixel__check' }, h(Icon, { name: 'check', size: 10, strokeWidth: 3.2 }))),
      props.label != null && h('span', { className: 'po-pixel__label' }, props.label));
  }

  var api = {
    Stepper: Stepper, PointBar: PointBar, TagChip: TagChip, PixelTile: PixelTile,
    Dock: Dock, AttrTile: AttrTile, AttrGrid: AttrGrid, DayCell: DayCell, OfferCard: OfferCard, TransferRow: TransferRow, TextField: TextField,
    Button: Button, Icon: Icon, Avatar: Avatar, Crest: Crest, TierBadge: TierBadge, RatingBadge: RatingBadge, StatChip: StatChip,
    Meter: Meter, FatigueGauge: FatigueGauge, FormIndicator: FormIndicator, StatBar: StatBar, PlayerCard: PlayerCard,
    GameCard: GameCard, CardHand: CardHand, ChoiceButton: ChoiceButton, FeedItem: FeedItem, ScoreBar: ScoreBar, SceneStrip: SceneStrip,
    PossessionBar: PossessionBar, AppBar: AppBar, Tabs: Tabs, Banner: Banner, Toast: Toast, BottomSheet: BottomSheet,
    Modal: Modal, ResultSplash: ResultSplash, DeckSlot: DeckSlot, HeroPanel: HeroPanel, SectionTitle: SectionTitle, Pitch: Pitch,
    FitBadge: FitBadge, TacticEmblem: TacticEmblem, TacticChip: TacticChip, FormationPitch: FormationPitch, OptionRow: OptionRow, Slider: Slider, Switch: Switch, CellGauge: CellGauge,
    utils: { KINDS: KINDS, ratingStep: ratingStep, formatRating: fmt1, signed: signed, TIERS: TIERS, CARD_TYPES: CTYPES, CARD_POS: POS, RARITY: RARITY, TACTIC_STYLES: TSTYLES, FIT: FIT }
  };
  window.PlayerOne = Object.assign(window.PlayerOne || {}, api);
})();
