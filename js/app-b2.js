// 몸으로 길 찾기 — 앱 본체 (시안 B2 화면판)
// app.js 와 동작은 같고, 그리는 부분(안내판·블록·미로·게이지·덮개·카메라 끄기)만 js/theme-b2.js 를 쓴다.
// 설계 근거: design-principles-2026-10-27.md (P1–P9, S1), design-decision-table-2026-10-27.md, screen-and-stages-2026-10-27.md
(function () {
  const B2 = window.BCM_B2;
  const APP_VERSION = '1.5.0';
  const GESTURE_VERSION = 4;              // 동작 규칙이 바뀌면 올린다 (F-2)
  const HOLD = { forward: 2000, right: 2000, left: 2000, delete_one: 2000, run: 2000, delete_all: 3000 }; // C-2
  // 기능 시험용: 주소에 ?hold=1000|2000|3000 을 붙이면 전체 지우기를 뺀 유지 시간을 바꾼다 (계획서 5단계)
  const HOLD_TEST = Number(new URLSearchParams(location.search).get('hold'));
  const DEBUG = new URLSearchParams(location.search).get('debug') === '1' ? {} : null;   // 진단 표시 (판정에는 영향 없음)
  if ([1000, 2000, 3000].includes(HOLD_TEST)) {
    for (const k of Object.keys(HOLD)) if (k !== 'delete_all') HOLD[k] = HOLD_TEST;
  }
  const WIPE_MIN_REVERSALS = 3;           // 칠판 지우기 확정에 필요한 방향 바뀜 (왕복 2번 이상)
  const COOLDOWN = 1000;                  // 확정 직후 새 후보를 받지 않는 시간 (C-6)
  const STEP_MS = 800;                    // 실행 한 칸 시간
  const POSE_VER = '0.5.1675469404';

  const { STAGES, DX, DY, SIZE } = window.BCM_STAGES;
  const G = window.BCM_GESTURES;
  const WHY = window.BCM_WHY;
  const PE = window.BCM_PERSONAL;
  const { P: PIC, A: ANIM, ICON, LABEL, HOW } = window.BCM_PICTO;
  const SHORT = { forward: '앞으로', right: '오른쪽', left: '왼쪽', delete_one: '하나 지우기', delete_all: '모두 지우기', run: '시작' };
  const TYPE_NAME = { make: '만들기', predict: '예측하기', fix: '고치기' };
  const EDIT_TYPES = ['forward', 'right', 'left', 'delete_one', 'delete_all'];

  const $ = id => document.getElementById(id);
  const el = {
    video: $('cam-video'), cam: $('cam-canvas'), badge: $('badge'),
    cand: $('candidate'), candPic: $('cand-pic'), candGauge: $('cand-gauge'), candLabel: $('cand-label'),
    cover: $('cam-off-cover'), coverText: $('cover-text'), personal: $('personal-chip'),
    pause: $('btn-pause'), camera: $('btn-camera'), guide: $('guide'),
    teacherBtn: $('btn-teacher'), teacherMenu: $('teacher-menu'), personalBtn: $('btn-personal'),
    stageType: $('stage-type'), stageNum: $('stage-num'), version: $('version'),
    maze: $('maze'), mazeSay: $('maze-say'), blocks: $('blocks'),
    overlay: $('overlay'), ovPic: $('ov-pic'), ovTitle: $('ov-title'), ovText: $('ov-text'), ovGauge: $('ov-gauge'), ovButtons: $('ov-buttons'),
    ovSum: $('ov-sum'), ovTl: $('ov-tl'), ovWhy: $('ov-why'),
  };
  const camCtx = el.cam.getContext('2d');
  const camIn = $('cam-in');
  const C_MOVE = '#3d8fe0', C_DEL = '#f39a42', C_WAIT = '#bbbbbb';

  const state = {
    sessionId: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    t0: performance.now(),
    logs: [],
    stageIdx: 0,
    program: [],
    mode: 'loading',          // loading | tutorial | play | running | summary
    attempt: 0,
    added: 0, deleted: 0,
    events: [], progEv: [],   // 활동 뒤 '카메라가 읽은 동작' (G11·P4, D-6). progEv는 program과 같은 자리의 사건
    paused: false, cameraOn: true,
    bodyVisible: null,
    cand: null,               // { type, start, rev0 }
    needNeutral: false,       // 확정 뒤 차렷으로 돌아올 때까지 새 후보를 받지 않는다 (P2, C-1)
    lastConfirm: -Infinity,
    tracker: G.createWipeTracker(),
    player: { x: 0, y: 0, dir: 0 },
    view: { x: 0, y: 0, angle: 0 },   // 그릴 때 쓰는 보간 값
    runIdx: -1, blockedIdx: -1, predictMark: null, wave: 0,
    tutorial: null,           // { steps, i, target }
    guess: null,              // 예측하기에서 누른 칸 { x, y, ok }
    personal: null,           // { samples: [{ type, f }], at } — 내 동작 맞추기 결과 (P9)
    calib: null,              // { i, phase, t, frames, samples }
    timers: [],
  };

  // ── 기록 (F-3) ──────────────────────────────────────────────
  function log(event, data = {}) {
    const st = STAGES[state.stageIdx];
    state.logs.push({
      t: new Date().toISOString(),
      ms: Math.round(performance.now() - state.t0),
      session_id: state.sessionId,
      app_version: APP_VERSION, gesture_version: GESTURE_VERSION,
      stage: st ? st.id : null, stage_type: st ? st.type : null,
      attempt: state.attempt, personal: !!state.personal, hold_ms: HOLD.forward, event, ...data,
    });
  }
  function saveLog() {
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.logs, null, 2));
    a.download = `body-code-maze-log-${state.sessionId}.json`;
    a.click();
  }

  // ── 소리와 말 (D-1, D-5) ─────────────────────────────────────
  let audio = null;
  function tone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime + delay;
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* 소리 장치가 없으면 조용히 넘어간다 */ }
  }
  const sound = {
    confirm: () => tone(880, 0.15, 'triangle'),
    step: () => tone(520, 0.08, 'sine', 0.06),
    soft: () => { tone(392, 0.18, 'sine', 0.1); tone(330, 0.25, 'sine', 0.1, 0.18); },
    success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, i * 0.1)),
  };

  // ── 타이머 정리 ──────────────────────────────────────────────
  function later(fn, ms) { const id = setTimeout(fn, ms); state.timers.push(id); return id; }
  function clearTimers() { state.timers.forEach(clearTimeout); state.timers = []; }

  // ── 게이지: 픽셀 막대, 9칸씩 끊어 찬다 ───────────────────────
  function drawGauge(gauge, ratio, color = C_MOVE) {
    const b = gauge.firstElementChild;
    b.style.width = Math.floor(Math.max(0, Math.min(1, ratio)) * 9) / 9 * 100 + '%';
    b.style.background = color;
  }

  // ── 단계 ────────────────────────────────────────────────────
  function stage() { return STAGES[state.stageIdx]; }

  function loadStage(idx) {
    clearTimers();
    state.stageIdx = Math.max(0, Math.min(STAGES.length - 1, idx));
    try { localStorage.setItem('bcm_stage', String(state.stageIdx)); } catch (e) { }
    const st = stage();
    state.program = st.given.slice();
    state.added = 0; state.deleted = 0;
    state.guess = null; mazeSay(''); hint.misses = {}; clearHint();
    state.events = []; state.progEv = state.program.map(() => null);
    state.predictMark = null; state.blockedIdx = -1; state.runIdx = -1; state.wave = 0;
    clearCandidate(false);
    resetPlayer(true);
    el.stageType.textContent = TYPE_NAME[st.type];
    el.stageType.className = 'pill ' + st.type;
    el.stageNum.textContent = `${st.id} / ${STAGES.length}`;
    renderGuide(); renderBlocks(); hideOverlay();
    state.mode = 'play';
    log('stage_start');
    if (st.type === 'predict') mazeSay('이 코드대로 가면 어디에 도착할까요? 도착할 칸을 눌러 봐요.');
    else if (st.type === 'fix') mazeSay('이 코드로는 도착하지 못해요. 고쳐 볼까요?');
  }

  function resetPlayer(snap) {
    const s = stage().start, v = state.view;
    state.player = { x: s.x, y: s.y, dir: s.dir };
    // 한 칸보다 멀리 되돌아갈 때는 걸어 돌아가지 않고 바로 출발점에 선다 (벽을 지나 걷는 모습 방지)
    if (snap || Math.abs(v.x - s.x) + Math.abs(v.y - s.y) > 1.01) state.view = { x: s.x, y: s.y, angle: s.dir * 90 };
  }

  // ── 그리기: 안내판, 블록, 미로 ──────────────────────────────
  // 모두 지우기 그림은 와이퍼처럼 좌·중·우를 오간다 (안내 카드·튜토리얼)
  const WIPE_FRAMES = ['delete_all_l', 'delete_all', 'delete_all_r', 'delete_all'];
  const WIPE_MS = 220;
  let guideTimer = null;
  function renderGuide() {
    const locked = stage().type === 'predict';
    el.guide.innerHTML = ['forward', 'right', 'left', 'delete_one', 'delete_all', 'run'].map(t =>
      `<div class="card ${t.startsWith('delete') ? 'del' : ''} ${locked && t !== 'run' ? 'disabled' : ''}" data-t="${t}">${B2.figOf(t)}<span>${SHORT[t]}</span></div>`).join('');
    clearInterval(guideTimer);
    const img = el.guide.querySelector('[data-t="delete_all"] img');
    if (!img) return;
    const srcs = WIPE_FRAMES.map(t => /src="([^"]+)"/.exec(B2.figOf(t))[1]);
    let i = 1;
    guideTimer = setInterval(() => { i = (i + 1) % srcs.length; img.src = srcs[i]; }, WIPE_MS);
  }

  function renderBlocks(blinkAll = false) {
    const locked = stage().type === 'predict';
    el.blocks.classList.toggle('blocks-locked', locked);
    el.blocks.innerHTML = state.program.map((c, i) => {
      const cls = ['blk', c];
      if (i === state.runIdx) cls.push('running');
      if (i === state.blockedIdx) cls.push('blocked');
      if (blinkAll) cls.push('blink');
      return `<div class="${cls.join(' ')}">${B2.blockIcon(c)}</div>`;
    }).join('');
    // 블록이 미로 너비를 넘으면 아랫줄이 생기므로 화면 크기를 다시 맞춘다
    const n = state.program.length;
    if (B2.layout.rowsFor(n) !== PXS.rows) B2.layout(n); else B2.layout.n = n;
  }

  function drawMaze() {
    B2.drawMaze(el.maze, stage(), {
      view: state.view, player: state.player, showSteps: state.mode === 'play',
      predictMark: state.predictMark, wave: state.wave, guess: state.guess,
    });
  }
  function animate() {
    const p = state.player, v = state.view, k = 0.18;
    v.x += (p.x - v.x) * k; v.y += (p.y - v.y) * k;
    let target = p.dir * 90, d = ((target - v.angle) % 360 + 540) % 360 - 180;
    v.angle += d * 0.09;
    drawMaze();
    requestAnimationFrame(animate);
  }

  // ── 후보와 확정 (P2, P3) ─────────────────────────────────────
  function inputAllowed(now) {
    return (state.mode === 'play' || state.mode === 'tutorial') && !state.paused && state.cameraOn && now - state.lastConfirm >= COOLDOWN;
  }

  function clearCandidate(logIt = true, why = null) {
    if (state.cand && logIt) {
      const held = Math.round(performance.now() - state.cand.start);
      log('candidate_cancel', { type: state.cand.type, held_ms: held });
      if (why && state.mode === 'play' && held >= HOLD[state.cand.type] * WHY.MISS_MIN) {
        state.events.push({ k: 'miss', t: state.cand.type, ms: held, why, p: !!state.personal });
        if (why === 'gone') hintAfterMiss(state.cand.type);
      }
    }
    state.cand = null;
    hintOn = false;
    el.cand.classList.remove('show');
    drawGauge(el.candGauge, 0);
    if (state.mode === 'tutorial') drawGauge(el.ovGauge, 0);
    if (state.mode !== 'running') renderBlocks();
  }

  // 확정 뒤 차렷을 기다리는 동안 후보 상자에 차렷 그림을 보인다 (활동 중에만)
  let hintOn = false;
  function neutralHint(on) {
    if (on === hintOn || state.mode !== 'play') { if (!on) hintOn = false; return; }
    hintOn = on;
    if (on) {
      el.candPic.innerHTML = B2.figOf('neutral', { tight: 1 });
      el.candLabel.textContent = '차렷하고 다음 동작!';
      drawGauge(el.candGauge, 0);
      el.cand.classList.add('show');
    } else el.cand.classList.remove('show');
  }

  // ── 고칠 점 안내 (P5, 전문가 검토 뒤 추가 2026-11-07) ─────────
  // 명령하려다 안 된 것으로 볼 수 있을 때만, 다음에 해 볼 행동을 말풍선으로 짧게 알린다.
  // 판정에는 영향을 주지 않는다. 내 동작 알려 주기를 쓰는 중에는 규칙이 달라 말하지 않는다.
  const HINT_MS = 1200;     // 같은 자세가 이만큼 이어져야 말한다 (지나가는 자세에는 말하지 않게)
  const HINT_KEEP = 6000;   // 자세가 바뀌어도 이만큼은 보여 준다 (1·2학년이 천천히 읽을 수 있게)
  const HINT_MAX = 3;       // 한 번에 띄우는 안내 수
  const MISS_REPEAT = 3;    // 같은 동작이 이만큼 끊기면 그림을 보라고 한다
  const hint = { text: null, since: 0, items: [], misses: {} };   // items: [{ text, at }]
  const camHint = $('cam-hint');   // 아이들이 보는 카메라 화면, 상태 표시 옆에 띄운다

  function showHint(text, now) {
    if (!camHint) return;
    const old = hint.items.find(x => x.text === text);
    if (old) { old.at = now; return; }
    log('hint', { text });
    hint.items.push({ text, at: now });
    if (hint.items.length > HINT_MAX) hint.items.shift();
    renderHints();
  }
  function renderHints() {
    if (!camHint) return;
    camHint.hidden = !hint.items.length;
    camHint.innerHTML = hint.items.map(x => `<div class="hint">${x.text}</div>`).join('');
  }
  function pruneHints(now) {
    const n = hint.items.length;
    hint.items = hint.items.filter(x => now - x.at <= HINT_KEEP);
    if (hint.items.length !== n) renderHints();
  }
  function clearHint() {
    hint.items = [];
    renderHints();
  }
  function hintAfterMiss(type) {
    const own = !!state.personal;   // 내 동작을 쓰는 중에는 아래 그림과 다를 수 있어 그림을 보라고 하지 않는다
    hint.misses[type] = (hint.misses[type] || 0) + 1;
    showHint(!own && hint.misses[type] >= MISS_REPEAT ? '아래 그림을 보고 다시 해 볼까요?' : '블록을 넣으려면 끝까지 그대로 있어 볼까요?', performance.now());
  }
  function updateHint(lm, res, now) {
    const tutorial = state.mode === 'tutorial';
    const can = (state.mode === 'play' || tutorial) && !state.paused && !state.personal &&
      !state.cand && !state.needNeutral && res.status === 'ok' && !res.type;
    let h = can ? G.nearMiss(lm, state.tracker) : null;
    if (h && tutorial && h.target !== state.tutorial.target) h = null;
    if (!h) {
      hint.text = null;
      return;
    }
    if (h.text !== hint.text) { hint.text = h.text; hint.since = now; return; }
    if (now - hint.since >= HINT_MS) showHint(h.text, now);
  }

  function handleGesture(res, now) {
    if (!inputAllowed(now)) { if (state.cand) clearCandidate(); return; }
    let type = res.type;
    if (state.mode === 'tutorial' && type !== state.tutorial.target) type = null;
    if (!type) {
      if (res.status === 'ok') { state.needNeutral = false; neutralHint(false); }   // 차렷(아무 명령도 아닌 자세)이 보였다
      if (state.cand) clearCandidate(true, 'gone');
      return;
    }
    if (state.needNeutral) { neutralHint(true); return; }   // 같은 자세를 계속 들고 있으면 블록이 또 들어가지 않게

    if (!state.cand || state.cand.type !== type) {
      if (state.cand) clearCandidate(true, 'gone');
      state.cand = { type, start: now, rev0: res.reversals || 0 };
      if (state.mode === 'play') {
        el.candPic.innerHTML = B2.figOf(type, { tight: 1 });
        el.candLabel.textContent = SHORT[type];
        el.cand.classList.add('show');
      }
      if (type === 'delete_all' && state.mode === 'play') renderBlocks(true);   // 미리 알림 (B-5)
      log('candidate_start', { type });
      return;
    }
    const ratio = (now - state.cand.start) / HOLD[type];
    if (state.mode === 'tutorial') drawGauge(el.ovGauge, ratio);
    else drawGauge(el.candGauge, ratio, type.startsWith('delete') ? C_DEL : C_MOVE);
    const wipeOk = type !== 'delete_all' || (res.reversals || 0) >= WIPE_MIN_REVERSALS;
    if (ratio >= 1 && wipeOk) confirm(type, now);
  }

  function markGone(evs) { for (const e of evs) if (e) e.gone = true; }

  function confirm(type, now) {
    state.lastConfirm = now;
    state.needNeutral = true;
    state.cand = null;
    hint.misses = {};
    clearHint();
    el.cand.classList.remove('show');
    drawGauge(el.candGauge, 0);
    sound.confirm();
    log('confirm', { type });

    if (state.mode === 'tutorial') { tutorialSuccess(); return; }
    const st = stage();
    const ev = { k: 'act', t: type, p: !!state.personal };
    state.events.push(ev);
    if (st.type === 'predict' && type !== 'run') {
      mazeSay('이번에는 코드를 바꾸지 않고 예측만 해요. 머리 위 동그라미로 시작해 봐요.');
      ev.k = 'blocked';
      log('edit_blocked_predict', { type });
      renderBlocks();
      return;
    }
    if (type === 'run') { runProgram('gesture'); return; }
    if (type === 'delete_one') {
      if (!state.program.length) { mazeSay('지울 블록이 없어요.'); renderBlocks(); return; }
      state.program.pop(); state.deleted++; markGone(state.progEv.splice(-1));
    } else if (type === 'delete_all') {
      state.deleted += state.program.length; state.program = []; markGone(state.progEv.splice(0));
    } else {
      state.program.push(type); state.added++; ev.k = 'add'; state.progEv.push(ev);
    }
    afterEdit();
  }

  // 편집하면 캐릭터를 출발점으로 되돌린다 (C-4)
  function afterEdit() {
    mazeSay('');   // 블록을 고치면 앞의 안내(길이 막혔어 등)는 치운다
    state.predictMark = null; state.runIdx = -1;
    if (state.blockedIdx >= state.program.length) state.blockedIdx = -1;   // 주황색 블록이 지워질 때까지 표시를 남긴다
    resetPlayer(false);
    renderBlocks();
  }

  // ── 실행 (T-8, T-9, C-8) ─────────────────────────────────────
  // 예측하기: 아이가 도착할 칸을 누르면 맞았는지 알려 준다. 확인은 실행으로 한다
  function guessCell(ev) {
    const st = stage();
    if (st.type !== 'predict' || state.mode !== 'play') return;
    const r = el.maze.getBoundingClientRect();
    const x = Math.floor((ev.clientX - r.left) / r.width * SIZE), y = Math.floor((ev.clientY - r.top) / r.height * SIZE);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const ok = x === st.predictEnd.x && y === st.predictEnd.y;
    state.guess = { x, y, ok };
    const text = ok ? '정답이에요! 시작하여 확인해 보세요.' : '블록을 하나씩 따라가 보고 다시 눌러 볼까요?';
    mazeSay(text, ok);
    if (ok) sound.success(); else sound.soft();
    log('predict_guess', { x, y, correct: ok });
  }
  function mazeSay(text, ok) {
    el.mazeSay.hidden = !text; el.mazeSay.textContent = text || '';
    el.mazeSay.classList.toggle('ok', !!ok);
  }

  function runProgram(source) {
    if (state.mode !== 'play') return;
    if (!state.program.length) { mazeSay('먼저 블록을 넣어 볼까요?'); return; }
    clearCandidate(false);
    clearHint();
    state.mode = 'running';
    state.attempt++;
    state.predictMark = null; state.blockedIdx = -1;
    resetPlayer(false);
    mazeSay('');
    log('run_start', { source, length: state.program.length, program: state.program.join(' ') });
    step(0);
  }

  function step(i) {
    const st = stage();
    if (i >= state.program.length) { finishRun(); return; }
    state.runIdx = i; renderBlocks();
    const c = state.program[i], p = state.player;
    if (c === 'forward') {
      const nx = p.x + DX[p.dir], ny = p.y + DY[p.dir];
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || st.grid[ny][nx] === 0) {
        state.blockedIdx = i; state.runIdx = -1; renderBlocks();
        sound.soft(); mazeSay('앗, 길이 막혔어요. 주황색 블록부터 고쳐 볼까요?');
        showHint('X자로 주황색 블록까지 지워 볼까요?', performance.now());
        log('run_end', { result: 'blocked', at: i });
        state.mode = 'play';
        return;
      }
      p.x = nx; p.y = ny;
    } else if (c === 'left') p.dir = (p.dir + 3) % 4;
    else p.dir = (p.dir + 1) % 4;
    sound.step();
    later(() => step(i + 1), STEP_MS);
  }

  function finishRun() {
    const st = stage(), p = state.player;
    state.runIdx = -1; renderBlocks();
    if (st.type === 'predict') {
      state.predictMark = { x: p.x, y: p.y };
      log('run_end', { result: 'end', x: p.x, y: p.y });
      mazeSay('여기에 도착했어요. 생각한 곳과 같았나요?');
      state.mode = 'summary';
      later(() => showSummary('predict'), 3500);
      return;
    }
    if (p.x === st.goal.x && p.y === st.goal.y) {
      log('run_end', { result: 'goal' });
      sound.success();
      state.wave = performance.now();   // 도착하면 깃발이 펄럭인다
      state.mode = 'summary';
      later(() => showSummary('goal'), 900);
    } else {
      log('run_end', { result: 'end', x: p.x, y: p.y });
      sound.soft(); mazeSay('도착하지 못했어요. 블록을 고쳐 볼까요?');
      showHint('블록을 더 넣거나 X자로 지워 볼까요?', performance.now());
      state.mode = 'play';
    }
  }

  // 활동 뒤 요약 (D-6, G11·P4): 카메라가 읽은 동작을 순서대로 보이고, 누르면 왜 그렇게 읽었는지 말해 준다.
  // 저절로 넘어가지 않는다. '다음 단계' 버튼이나 교사 → 로 넘어간다
  function showSummary(kind) {
    const title = kind === 'goal' ? '도착했어요!' : '예측해 봤어요!';
    showOverlay('', title, '', [['다음 단계', () => nextStage()]], false, kind === 'goal' ? 'var(--gr)' : '');
    el.ovText.hidden = true; el.ovSum.hidden = false;
    const evs = state.events;
    el.ovTl.innerHTML = evs.map((e, i) => {
      const move = ['forward', 'right', 'left'].includes(e.t) && e.k !== 'teacher';
      const cls = ['ev', e.k === 'miss' || e.k === 'blocked' ? 'miss' : '', e.k === 'add' && e.gone ? 'del' : ''].join(' ');
      const ic = move ? `<span class="blk ${e.t}">${B2.blockIcon(e.t)}</span>`
        : `<span class="act ${e.t === 'run' ? 'run' : ''}">${e.t === 'run' ? B2.ICONS.play(2) : e.t === 'delete_all' ? B2.ICONS.broom(2) : '<b>✕</b>'}</span>`;
      return `<button type="button" class="${cls}" data-i="${i}">${ic}<small>${WHY.label(e)}</small></button>`;
    }).join('');
    el.ovWhy.className = 'why empty'; el.ovWhy.textContent = '궁금한 그림을 눌러 보세요';
    el.ovTl.onclick = ev => {
      const b = ev.target.closest('.ev'); if (!b) return;
      el.ovTl.querySelectorAll('.ev').forEach(x => x.classList.toggle('sel', x === b));
      const e = evs[+b.dataset.i], text = WHY.text(e, HOLD);
      el.ovWhy.className = 'why';
      el.ovWhy.innerHTML = `<span class="pic">${B2.figOf(e.t, { tight: 1 })}</span><span>${text}</span>`;
      log('summary_why', { i: +b.dataset.i, k: e.k, type: e.t });
    };
    log('summary', { added: state.added, deleted: state.deleted, attempts: state.attempt, events: evs.map(e => `${e.k}:${e.t}${e.gone ? ':gone' : ''}`).join(' ') });
  }
  function nextStage() {
    state.attempt = 0;
    if (state.stageIdx < STAGES.length - 1) loadStage(state.stageIdx + 1);
    else { showOverlay('', '모든 단계를 마쳤어요!', '', [['처음부터', () => loadStage(0)]]); state.mode = 'summary'; }
  }

  // ── 덮개 화면: 그림 + 말풍선(글자가 한 자씩 나온다) ──────────
  // pose: '' 그림 없음, 'neutral' 차렷, 동작 이름이면 차렷 ↔ 동작을 번갈아 보여 준다 (D-1)
  // text 안의 {g:…} {k:…} {o:…} 는 초록·파랑·주황 글자
  let figTimer = null;
  function setOvPic(pose) {
    clearInterval(figTimer); el.ovPic.innerHTML = '';
    if (!pose) return;
    const k = window.PXS && PXS.px * 254 >= 500 ? 2 : 1;
    const a = B2.figOf('neutral', { k });
    el.ovPic.innerHTML = a;
    if (pose === 'neutral') return;
    if (pose === 'delete_all') {
      const fr = WIPE_FRAMES.map(t => B2.figOf(t, { k })); let i = 1;
      el.ovPic.innerHTML = fr[i];
      figTimer = setInterval(() => { i = (i + 1) % fr.length; el.ovPic.innerHTML = fr[i]; }, WIPE_MS);
      return;
    }
    const p = B2.figOf(pose, { k }); let on = false;
    figTimer = setInterval(() => { on = !on; el.ovPic.innerHTML = on ? p : a; }, 900);
  }
  function showOverlay(pose, title, text, buttons, gauge = false, color = '') {
    mazeSay('');
    setOvPic(pose);
    el.ovTitle.textContent = title; el.ovTitle.style.color = color || 'var(--sk)';
    B2.type(el.ovText, text);
    el.ovGauge.hidden = !gauge; drawGauge(el.ovGauge, 0);
    el.ovText.hidden = false; el.ovSum.hidden = true;
    el.ovButtons.innerHTML = '';
    for (const [label, fn] of buttons) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn;
      b.className = 'btn ' + (label.includes('교사') || label === '건너뛰기' ? 'sk' : 'go');
      el.ovButtons.appendChild(b);
    }
    el.overlay.hidden = false;
  }
  function hideOverlay() { el.overlay.hidden = true; clearInterval(figTimer); }

  // ── 처음 연습 (P1, D-1, D-2, F-2) ────────────────────────────
  function startTutorial(steps) {
    clearTimers(); clearCandidate(false);
    state.mode = 'tutorial';
    state.tutorial = { steps, i: 0, target: null };
    log('tutorial_start', { steps: steps.join(' ') });
    showTutorialStep();
  }
  function showTutorialStep() {
    const t = state.tutorial, s = t.steps[t.i];
    if (!s) { endTutorial(false); return; }
    if (s === 'intro') {
      t.target = null;
      const text = '몸으로 명령 {k:블록}을 넣어 길을 찾아요. 동작을 하나씩 배워 볼까요?';
      showOverlay('forward', '몸으로 길 찾기', text,
        [['시작', () => { t.i++; showTutorialStep(); }], ['건너뛰기', () => endTutorial(true)]]);
      return;
    }
    t.target = s;
    // D-2: 카메라가 잘못 볼 수 있다는 안내는 지우는 동작을 배울 때 함께 한다
    const why = s === 'delete_one' ? '카메라가 잘못 봐서 다른 블록이 들어갈 수도 있어요. 괜찮아요! 그럴 땐 이렇게 지워요. ' : '';
    showOverlay(s, LABEL[s], `${why}{g:${HOW[s]}} — {o:${HOLD[s] / 1000}초} 동안 ${s === 'delete_all' ? '계속' : '그대로'}!`, [['건너뛰기', () => endTutorial(true)]], true, 'var(--gr)');
  }
  function tutorialSuccess() {
    const t = state.tutorial;
    sound.success();
    log('tutorial_step_done', { target: t.target });
    t.target = null;
    later(() => { t.i++; showTutorialStep(); }, 1200);
  }
  function endTutorial(skipped) {
    log('tutorial_end', { skipped });
    state.tutorial = null;
    loadStage(state.stageIdx);
  }

  // ── 내 동작 맞추기 (P9, F-4·F-5) ─────────────────────────────
  // 활동 밖에서만 배운다. 모은 시범은 기록에 함께 남겨 학습·시험 분리 비교에 쓴다.
  const CALIB_READY = 3000, CALIB_TAKE = 2000, CALIB_MIN_FRAMES = 15;
  const P_NAME = { neutral: '차렷', ...LABEL };
  const P_HOW = { neutral: '두 팔을 내리고 바로 서기', ...HOW };

  function startCalib() {
    if (!['play', 'summary', 'tutorial'].includes(state.mode)) return;
    if (state.tutorial) { log('tutorial_end', { skipped: true }); state.tutorial = null; }
    clearTimers(); clearCandidate(false);
    state.mode = 'calib';
    state.calib = { i: 0, phase: 'intro', t: 0, frames: [], samples: [] };
    log('personal_start');
    const text = '네가 보여 주는 동작으로 카메라가 너를 알아보게 해. 활동하는 동안에는 바뀌지 않고, 언제든 처음으로 되돌릴 수 있어.';
    showOverlay('neutral', '내 동작 알려 주기', text,
      [['시작', () => calibStep()], ['그만두기(교사)', () => endCalib()]]);
  }
  function calibStep() {
    const c = state.calib, type = PE.CLASSES[c.i];
    if (!type) { finishCalib(); return; }
    c.phase = 'ready'; c.t = performance.now(); c.frames = [];
    showOverlay(type, P_NAME[type], `{g:${P_HOW[type]}} — 그대로 있어요`, [['그만두기(교사)', () => endCalib()]], true, 'var(--gr)');
  }
  function calibFrame(lm, now) {
    const c = state.calib, type = PE.CLASSES[c.i];
    if (c.phase === 'ready') {
      drawGauge(el.ovGauge, (now - c.t) / CALIB_READY, C_WAIT);
      if (now - c.t >= CALIB_READY) { c.phase = 'take'; c.t = now; }
      return;
    }
    if (c.phase !== 'take') return;
    const f = PE.features(lm);
    if (f) c.frames.push(f);
    drawGauge(el.ovGauge, (now - c.t) / CALIB_TAKE);
    if (now - c.t < CALIB_TAKE) return;
    c.phase = 'wait';
    if (c.frames.length < CALIB_MIN_FRAMES) {
      B2.type(el.ovText, '몸과 손이 잘 보이게 다시 해 봐요.');
      log('personal_retry', { type, reason: 'few_frames', n: c.frames.length });
      later(calibStep, 2000);
      return;
    }
    const clash = PE.overlaps(c.samples, type, c.frames);
    if (clash) {
      B2.type(el.ovText, `${P_NAME[clash]} 동작과 너무 비슷해요. 다시 해 봐요.`);
      log('personal_retry', { type, reason: 'overlap', with: clash });
      later(calibStep, 2500);
      return;
    }
    for (const fr of c.frames) c.samples.push({ type, f: fr.map(x => Math.round(x * 1000) / 1000) });
    log('personal_step', { type, n: c.frames.length });
    sound.confirm();
    later(() => { c.i++; calibStep(); }, 1200);
  }
  function finishCalib() {
    const samples = state.calib.samples;
    state.calib.phase = 'done';
    state.personal = { samples, at: new Date().toISOString() };
    try { localStorage.setItem('bcm_personal', JSON.stringify(state.personal)); } catch (e) { }
    log('personal_done', { samples });
    renderPersonal();
    const text = '다 배웠어. 이제 카메라가 네가 보여 준 동작으로 너를 알아봐. 모두 지우기는 원래대로 알아봐.';
    showOverlay('neutral', '다 배웠어', text, [['시작', () => endCalib()]], false, 'var(--gr)');
    sound.success();
  }
  function endCalib() {
    if (state.calib && state.calib.phase !== 'done') log('personal_cancel');
    state.calib = null;
    loadStage(state.stageIdx);
  }
  function resetPersonal() {
    if (!state.personal || state.mode === 'running' || state.mode === 'calib') return;
    state.personal = null;
    try { localStorage.removeItem('bcm_personal'); } catch (e) { }
    log('personal_reset');
    renderPersonal(); clearCandidate(false);
  }
  // 시범으로 판정하는 중임을 늘 보이고, 아이가 직접 맞추거나 되돌린다 (F-5, CH-3)
  function renderPersonal() {
    el.personal.hidden = !state.personal;
    el.personalBtn.innerHTML = state.personal ? `${B2.ICONS.prev(2)}원래대로` : `${B2.ICONS.target(2)}내 동작 알려 주기`;
    B2.layout.fitButtons();
  }

  // ── 아이가 쓰는 멈춤 (P7, E-1) ───────────────────────────────
  function setPaused(on) {
    state.paused = on;
    el.pause.classList.toggle('on', on);
    renderControls();
    clearCandidate(false); G.resetWipe(state.tracker);
    log(on ? 'input_pause' : 'input_resume');
  }
  function renderControls() {
    el.pause.innerHTML = state.paused ? `${B2.ICONS.play(2)}입력 다시 켜기` : `${B2.ICONS.pause(2)}입력 멈춤`;
    el.camera.innerHTML = `${B2.ICONS.cam(2)}${state.cameraOn ? '카메라 끄기' : '카메라 다시 켜기'}`;
    B2.layout.fitButtons();   // 글자가 길어지면 좁은 화면에서는 버튼 모양을 바꾼다
  }
  let camera = null;
  function setCamera(on) {
    clearHint();
    if (on === state.cameraOn) return;
    state.cameraOn = on;
    el.camera.classList.toggle('on', !on);
    renderControls();
    el.coverText.textContent = '카메라가 꺼져 있어요';
    clearCandidate(false); G.resetWipe(state.tracker);
    if (on) { el.cover.hidden = true; if (camera) startCameraSafely(); }
    else {
      // 카메라는 바로 끄고, 화면은 브라운관처럼 접혀 사라진 뒤 덮개를 씌운다
      if (camera && camera.stop) camera.stop();
      const s = el.video.srcObject;
      if (s) s.getTracks().forEach(tr => tr.stop());
    }
    B2.crtPower(camIn, on).then(ok => {
      if (!ok || state.cameraOn) return;
      camCtx.clearRect(0, 0, el.cam.width, el.cam.height);
      el.cover.hidden = false;
    });
    log(on ? 'camera_on' : 'camera_off');
  }

  // ── 카메라 프레임 처리 (P4: 관찰한 상태만 표시) ───────────────
  function setBadge(text, cls) { el.badge.innerHTML = '<i></i>' + text; el.badge.className = 'chipx badge ' + cls; }

  function onResults(results) {
    if (!state.cameraOn) return;
    const w = el.cam.width, h = el.cam.height;
    camCtx.save();
    camCtx.translate(w, 0); camCtx.scale(-1, 1);   // 거울처럼 보이게
    if (results.image) camCtx.drawImage(results.image, 0, 0, w, h);
    if (results.poseLandmarks && window.drawConnectors && window.POSE_CONNECTIONS) {
      drawConnectors(camCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: 'rgba(255,255,255,0.55)', lineWidth: 3 });
    }
    camCtx.restore();

    const now = performance.now();
    pruneHints(now);
    let res = G.classify(results.poseLandmarks, state.tracker, now);
    if (DEBUG) {
      if (!DEBUG.el) { DEBUG.el = document.createElement('pre'); DEBUG.el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:8px 10px;background:rgba(0,0,0,.75);color:#fff;font:13px/1.45 monospace;border-radius:6px;pointer-events:none'; document.body.appendChild(DEBUG.el); }
      DEBUG.el.textContent = `판정: ${res.status} / ${res.type || '-'}
` + G.debugInfo(results.poseLandmarks, state.tracker, now);
    }
    // 내 동작 맞추기를 했으면 칠판 지우기를 뺀 동작은 아이의 시범으로 판정한다 (F-4)
    if (state.personal && state.mode !== 'calib' && res.status === 'ok' && res.type !== 'delete_all') {
      const t = PE.predict(state.personal.samples, PE.features(results.poseLandmarks));
      res = { ...res, type: t === 'neutral' ? null : t };
    }
    const visible = res.status !== 'nobody';
    if (visible !== state.bodyVisible) {
      state.bodyVisible = visible;
      log(visible ? 'body_visible' : 'body_lost');
    }
    if (!visible) {
      setBadge('몸이 보이게 서 주세요', 'warn');
      if (state.cand) clearCandidate(true, 'body');   // 몸이 사라지면 후보를 처음으로 (C-5)
      return;
    }
    if (state.paused) { setBadge('입력을 멈췄어요', 'warn'); clearHint(); return; }
    if (res.status === 'lowvis') { setBadge('손이 잘 보이게 해 주세요', 'warn'); if (state.cand) clearCandidate(true, 'lowvis'); return; }
    setBadge(state.mode === 'running' ? '가는 중이에요' : '준비됐어요', 'ok');
    if (state.mode === 'calib') { calibFrame(results.poseLandmarks, now); return; }
    handleGesture(res, now);
    updateHint(results.poseLandmarks, res, now);
  }

  // ── 시작 ────────────────────────────────────────────────────
  function bindButtons() {
    el.pause.onclick = () => setPaused(!state.paused);
    el.camera.onclick = () => setCamera(!state.cameraOn);
    el.personalBtn.onclick = () => (state.personal ? resetPersonal() : startCalib());
    const teacherClear = () => {
      if (state.mode !== 'play' || stage().type === 'predict') return;
      state.deleted += state.program.length; state.program = []; markGone(state.progEv.splice(0));
      state.events.push({ k: 'teacher', t: 'delete_all' });
      log('confirm', { type: 'delete_all', source: 'teacher' }); afterEdit();
    };
    const T = {
      run: () => { if (state.mode === 'play' && state.program.length) state.events.push({ k: 'teacher', t: 'run' }); runProgram('teacher'); },
      clear: teacherClear,
      prev: () => loadStage(state.stageIdx - 1),
      next: () => loadStage(state.stageIdx + 1),
      tutorial: () => startTutorial(['intro', 'forward', 'right', 'left', 'delete_one', 'delete_all', 'run']),
      personal: startCalib,
      'personal-reset': resetPersonal,
      log: saveLog,
      close: () => {},
    };
    const setMenu = open => { el.teacherMenu.hidden = !open; el.teacherBtn.setAttribute('aria-expanded', String(open)); };
    el.teacherBtn.onclick = () => setMenu(el.teacherMenu.hidden);
    for (const [k, fn] of Object.entries(T)) $('t-' + k).onclick = () => { setMenu(false); fn(); };
    const KEYS = { ' ': 'run', c: 'clear', ArrowLeft: 'prev', ArrowRight: 'next', t: 'tutorial', p: 'personal', r: 'personal-reset', s: 'log' };
    document.addEventListener('keydown', e => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { setMenu(false); return; }
      const k = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!k) return;
      e.preventDefault(); if (document.activeElement) document.activeElement.blur();   // 스페이스가 화면 버튼을 같이 누르지 않게
      setMenu(false); T[k]();
    });
  }

  function startCamera() {
    if (!window.Pose || !window.Camera) { setBadge('카메라 도구를 불러오지 못했어요', 'warn'); return; }
    const pose = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${POSE_VER}/${f}` });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    pose.onResults(onResults);
    camera = new Camera(el.video, { onFrame: async () => { if (state.cameraOn) await pose.send({ image: el.video }); }, width: 640, height: 480 });
    startCameraSafely();   // 영상은 브라우저 안에서만 처리한다 (E-3)
  }
  function startCameraSafely() {
    Promise.resolve().then(() => camera.start()).catch(e => {
      setBadge('카메라를 켤 수 없어요. 연결과 권한을 확인해 주세요', 'warn');
      log('camera_error', { message: String(e && e.message || e) });
    });
  }

  // 버튼을 누르는 동안 한 칸 내려앉는다
  function bindPress() {
    document.addEventListener('pointerdown', e => { const b = e.target.closest('.btn'); if (b) b.classList.add('pressed'); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel'])
      document.addEventListener(ev, e => { const b = e.target.closest && e.target.closest('.btn'); if (b) b.classList.remove('pressed'); }, true);
  }

  function init() {
    el.version.textContent = `앱 v${APP_VERSION} · 동작 규칙 v${GESTURE_VERSION} · 화면 B2` + (HOLD.forward !== 2000 ? ` · 시험 유지 ${HOLD.forward / 1000}초` : '');
    B2.fillIcons(); B2.deco();
    addEventListener('resize', () => B2.layout());
    bindButtons(); bindPress();
    el.maze.addEventListener('click', guessCell);
    renderControls();
    let saved = 0;
    try { saved = Number(localStorage.getItem('bcm_stage')) || 0; } catch (e) { }
    state.stageIdx = Math.max(0, Math.min(STAGES.length - 1, saved));
    try { state.personal = JSON.parse(localStorage.getItem('bcm_personal')) || null; } catch (e) { }
    renderPersonal();
    log('session_start');
    loadStage(state.stageIdx);
    startTutorial(['intro', 'forward', 'right', 'left', 'delete_one', 'delete_all', 'run']);   // 앱을 열 때마다 연습부터 (10-30 사용자 결정)
    requestAnimationFrame(animate);
    startCamera();
  }

  window.BCM = { state, onResults, startCalib, resetPersonal, confirm, runProgram, loadStage, startTutorial, setPaused, setCamera, HOLD, renderBlocks, APP_VERSION, GESTURE_VERSION };
  init();
})();
