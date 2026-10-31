// 동작 그림과 아이콘 (직접 그린 SVG, F-7)
// 아이가 거울처럼 보는 방향: 아이의 오른팔이 그림의 오른쪽. 머리가 큰 아이, 굵은 갈색 외곽선, 둥근 손.
(function () {
  const OUT = '#6b4a2e', SKIN = '#ffdcbc', SHIRT = '#4d9de0', PANTS = '#8a6240', HAIR = '#6b4428';
  const SH = { l: [36, 44], r: [64, 44] };

  const LEGS = `<rect x="38" y="68" width="10" height="34" rx="5" fill="${PANTS}" stroke="${OUT}" stroke-width="3"/>` +
    `<rect x="52" y="68" width="10" height="34" rx="5" fill="${PANTS}" stroke="${OUT}" stroke-width="3"/>` +
    `<ellipse cx="42" cy="104" rx="8" ry="5" fill="#f2f2f2" stroke="${OUT}" stroke-width="3"/>` +
    `<ellipse cx="58" cy="104" rx="8" ry="5" fill="#f2f2f2" stroke="${OUT}" stroke-width="3"/>`;
  const BODY = `<rect x="32" y="36" width="36" height="38" rx="14" fill="${SHIRT}" stroke="${OUT}" stroke-width="3"/>` +
    `<path d="M38 42 Q50 50 62 42" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>`;
  const HEAD = `<circle cx="50" cy="19" r="17" fill="${SKIN}" stroke="${OUT}" stroke-width="3"/>` +
    `<path d="M33 18 A17 17 0 0 1 67 18 Q60 11 50 14 Q40 11 33 18 Z" fill="${HAIR}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>` +
    `<circle cx="44" cy="22" r="2.4" fill="${OUT}"/><circle cx="56" cy="22" r="2.4" fill="${OUT}"/>` +
    `<ellipse cx="40" cy="27" rx="3.5" ry="2.2" fill="#f7a6a6" opacity="0.8"/><ellipse cx="60" cy="27" rx="3.5" ry="2.2" fill="#f7a6a6" opacity="0.8"/>` +
    `<path d="M47 28 Q50 31 53 28" fill="none" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/>`;

  // 팔 = 굵은 외곽선 + 피부색 선 + 둥근 손. 머리는 팔 위에 그려 머리 위 동작에서 팔이 머리 뒤로 간다
  const line = (a, b, w, col, extra = '') =>
    `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${col}" stroke-width="${w}" stroke-linecap="round">${extra}</line>`;
  const handAt = (p, extra = '') => `<circle cx="${p[0]}" cy="${p[1]}" r="5.5" fill="${SKIN}" stroke="${OUT}" stroke-width="2.5">${extra}</circle>`;
  const arm = (sh, p) => line(sh, p, 11, OUT) + line(sh, p, 6, SKIN) + handAt(p);
  const svg = (inner, cls = '') =>
    `<svg viewBox="0 0 100 120" class="pg ${cls}" aria-hidden="true">${LEGS}${BODY}${inner}${HEAD}</svg>`;
  const cue = d => `<path d="${d}" class="pg-cue"/>`;

  const REST = { l: [30, 74], r: [70, 74] };
  const P = {
    neutral: svg(arm(SH.l, REST.l) + arm(SH.r, REST.r)),
    // 앞으로 나란히: 정면에서 보면 팔이 짧아 보이고 손이 어깨 높이 앞에 있다
    forward: svg(arm(SH.l, [40, 50]) + arm(SH.r, [60, 50])),
    right: svg(arm(SH.l, REST.l) + arm(SH.r, [96, 44])),
    left: svg(arm(SH.r, REST.r) + arm(SH.l, [4, 44])),
    delete_one: svg(arm(SH.l, [62, 62]) + arm(SH.r, [38, 62])),
    delete_all: svg('<g class="pg-wipe">' + arm(SH.l, [44, 58]) + arm(SH.r, [56, 58]) + '</g>' + cue('M22 64 h8 M70 64 h8')),
    run: svg(arm(SH.l, [43, -4]) + arm(SH.r, [57, -4])),
  };

  // 시범 애니메이션 (D-1): 차렷 → 동작 → 잠깐 유지 → 차렷을 되풀이한다
  const KT = '0;0.3;0.75;1', DUR = '2.6s';
  const anim = (attr, a, b) => `<animate attributeName="${attr}" values="${a};${b};${b};${a}" keyTimes="${KT}" dur="${DUR}" repeatCount="indefinite"/>`;
  const end = (from, to, x, y) => anim(x, from[0], to[0]) + anim(y, from[1], to[1]);
  const movingArm = (sh, to, from) =>
    line(sh, from, 11, OUT, end(from, to, 'x2', 'y2')) + line(sh, from, 6, SKIN, end(from, to, 'x2', 'y2')) + handAt(from, end(from, to, 'cx', 'cy'));
  const arms = (l, r) => movingArm(SH.l, l, REST.l) + movingArm(SH.r, r, REST.r);
  const appear = inner => `<g opacity="0">${inner}<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.25;0.35;0.75;1" dur="${DUR}" repeatCount="indefinite"/></g>`;

  const A = {
    neutral: P.neutral,
    forward: svg(arms([40, 50], [60, 50])),
    right: svg(arms(REST.l, [96, 44])),
    left: svg(arms([4, 44], REST.r)),
    delete_one: svg(arms([62, 62], [38, 62])),
    delete_all: svg('<g class="pg-wipe">' + arms([44, 58], [56, 58]) + '</g>' + appear(cue('M22 64 h8 M70 64 h8'))),
    run: svg(arms([43, -4], [57, -4])),
  };

  // 아이콘: 통통하고 둥근 모양, 글자색(currentColor)을 따른다 (블록·버튼 위에 얹는다)
  const ico = inner => `<svg viewBox="0 0 48 48" class="ico" aria-hidden="true">${inner}</svg>`;
  const W = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const turnR = `<path d="M15 42 V28 Q15 17 26 17 H31" ${W} stroke-width="8"/>` +
    `<path d="M30 7 L42 17 L30 27 Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>`;
  const ICON = {
    forward: ico(`<path d="M24 8 L39 24 H30 V41 H18 V24 H9 Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>`),
    right: ico(turnR),
    left: ico(`<g transform="translate(48 0) scale(-1 1)">${turnR}</g>`),
    pause: ico(`<rect x="12" y="10" width="9" height="28" rx="4" fill="currentColor"/><rect x="27" y="10" width="9" height="28" rx="4" fill="currentColor"/>`),
    play: ico(`<path d="M15 10 L37 24 L15 38 Z" fill="currentColor" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>`),
    camera: ico(`<rect x="6" y="15" width="36" height="25" rx="8" fill="currentColor"/><rect x="16" y="9" width="14" height="9" rx="4" fill="currentColor"/>` +
      `<circle cx="24" cy="27" r="8" fill="#fffbea"/><circle cx="24" cy="27" r="4.5" fill="currentColor"/>`),
    me: ico(`<circle cx="22" cy="16" r="9" fill="currentColor"/><path d="M8 42 Q8 28 22 28 Q36 28 36 42 Z" fill="currentColor"/>` +
      `<path d="M39 6 L41 11 L46 13 L41 15 L39 20 L37 15 L32 13 L37 11 Z" fill="#ffd84d"/>`),
    back: ico(`<path d="M14 18 H30 Q40 18 40 28 Q40 38 30 38 H18" ${W} stroke-width="7"/>` +
      `<path d="M18 8 L7 18 L18 28 Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>`),
  };

  const LABEL = {
    forward: '앞으로', right: '오른쪽으로 돌기', left: '왼쪽으로 돌기',
    delete_one: '하나 지우기', delete_all: '모두 지우기', run: '시작',
  };
  const HOW = {
    forward: '두 팔을 앞으로 나란히',
    right: '오른팔을 옆으로 쭉',
    left: '왼팔을 옆으로 쭉',
    delete_one: '가슴 앞에서 팔을 X자로',
    delete_all: '가슴 앞에서 칠판 지우듯 쓱쓱',
    run: '두 손을 머리 위에서 동그랗게',
  };

  window.BCM_PICTO = { P, A, ICON, LABEL, HOW };
})();
