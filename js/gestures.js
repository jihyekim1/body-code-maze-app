// 몸동작 판정 (screen-and-stages-2026-10-27.md 2절)
// MediaPipe Pose 관절 좌표(영상 좌우 반전 전)를 받아 명령 후보 하나를 돌려준다.
// 모든 거리는 어깨 폭(sw) 비율이다. 영상 좌표에서 사람의 오른쪽은 x가 작은 쪽이다.
(function () {
  const VIS = 0.5;
  const WIPE_AMP = 0.35;   // 칠판 지우기 왕복 폭 (sw)
  const WIPE_HANDS = 2.0;  // 두 손목 사이 최대 간격 (sw). 칠판 지우듯 손을 벌려도 되게 (2026-10-29, 1.2→2.0)
  const WIPE_GAP = 1500;   // 방향 바뀜 사이 최대 간격 (ms). 천천히 크게 문질러도 끊기지 않게 (2026-10-29, 800→1500)
  const WIPE_TOP = 0.6;    // 칠판 지우기를 인정하는 어깨 위 높이 (sw). 전문가 검토 뒤 0.2→0.6, '앞으로'의 높이 범위와 맞춤 (2026-11-07)
  const ELBOW_MAX = 0.7;   // '앞으로'에서 팔꿈치가 어깨 높이에서 벗어나도 되는 폭 (sw). 아래팔만 세워 흔드는 자세를 거른다 (2026-11-07)
  const MOVE_WIN = 500;    // 손이 움직이는지 볼 시간 (ms)
  const MOVE_RANGE = 0.25; // 이 시간 동안 손목이 좌우로 이만큼(sw) 넘게 오가면 움직이는 손으로 본다

  const v = p => (p && p.visibility !== undefined ? p.visibility : 1);

  function createWipeTracker() {
    return { dir: 0, anchor: null, extreme: null, reversals: [], hist: [] };
  }

  function resetWipe(t) {
    t.dir = 0; t.anchor = null; t.extreme = null; t.reversals = [];
  }

  // 두 손 가운데 x의 좌우 왕복을 센다. 왕복 폭이 WIPE_AMP 이상일 때만 방향 바뀜으로 본다.
  function updateWipe(t, x, sw, now) {
    const amp = WIPE_AMP * sw;
    if (t.anchor === null) { t.anchor = x; t.extreme = x; return; }
    if (t.dir === 0) {
      if (Math.abs(x - t.anchor) > amp) { t.dir = Math.sign(x - t.anchor); t.extreme = x; }
      return;
    }
    if ((x - t.extreme) * t.dir > 0) { t.extreme = x; return; }
    if (Math.abs(x - t.extreme) > amp) {
      t.reversals.push(now);
      t.dir = -t.dir;
      t.extreme = x;
    }
  }

  // 몸 가운데를 기준으로 손목의 좌우 위치를 기록해, 최근에 손이 얼마나 오갔는지 돌려준다.
  // 몸이 흔들리는 것은 세지 않는다.
  function handMotion(t, lx, rx, now) {
    t.hist.push({ now, lx, rx });
    while (t.hist.length && now - t.hist[0].now > MOVE_WIN) t.hist.shift();
    return motionOf(t);
  }
  function motionOf(t) {
    const range = a => Math.max(...a) - Math.min(...a);
    return {
      l: range(t.hist.map(h => h.lx)),
      r: range(t.hist.map(h => h.rx)),
      mid: range(t.hist.map(h => (h.lx + h.rx) / 2)),
    };
  }

  // 팔꿈치가 안 보이면 이 조건으로 막지 않는다
  function elbowsUp(lm, shoulderY, sw) {
    return [lm[13], lm[14]].every(e => !e || v(e) < VIS || Math.abs(e.y - shoulderY) < ELBOW_MAX * sw);
  }

  function wipeActive(t, now) {
    const last = t.reversals[t.reversals.length - 1];
    return last !== undefined && now - last < WIPE_GAP;
  }

  // 반환: { status: 'nobody' | 'lowvis' | 'ok', type: null | 'forward' | 'right' | 'left' | 'delete_one' | 'delete_all' | 'run', reversals }
  function classify(lm, tracker, now) {
    if (!lm) { resetWipe(tracker); return { status: 'nobody', type: null }; }
    const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
    const li = lm[19], ri = lm[20];
    if (v(ls) < VIS || v(rs) < VIS) { resetWipe(tracker); return { status: 'nobody', type: null }; }

    const sw = Math.abs(ls.x - rs.x);
    if (sw < 0.03) { resetWipe(tracker); return { status: 'nobody', type: null }; }
    if (v(lw) < VIS || v(rw) < VIS || v(nose) < VIS) {
      // 문지르는 중 손이 잠깐 흐려져도(빠른 움직임 잔상) 센 것을 버리지 않는다 (2026-10-29)
      if (wipeActive(tracker, now)) return { status: 'ok', type: 'delete_all', reversals: tracker.reversals.length };
      return { status: 'lowvis', type: null };   // 세던 왕복은 그대로 두고 이 장면만 건너뛴다
    }

    const shoulderY = (ls.y + rs.y) / 2;
    // 가슴 높이의 아래 경계. 엉덩이 관절은 외투 등 옷에 가려 잘못 잡히기 쉬워 쓰지 않고,
    // 늘 어깨 기준으로 정한다 (P6·B-7, 2026-10-29)
    const hipY = shoulderY + 1.6 * sw;
    const bodyMid = (ls.x + rs.x) / 2;
    const midX = (lw.x + rw.x) / 2;
    const wristGap = Math.hypot(lw.x - rw.x, lw.y - rw.y);

    // 실행: 머리 위 동그라미 (두 손목이 코보다 위, 두 검지 끝이 만남)
    const above = lw.y < nose.y - 0.2 * sw && rw.y < nose.y - 0.2 * sw;
    const fingerGap = li && ri ? Math.hypot(li.x - ri.x, li.y - ri.y) : wristGap;
    if (above && (fingerGap < 0.5 * sw || wristGap < 0.5 * sw) && Math.abs(midX - bodyMid) < 0.6 * sw) {
      resetWipe(tracker);
      return { status: 'ok', type: 'run' };
    }

    // 칠판 지우기: 두 손이 가슴 높이에서 함께 좌우로 왕복
    const motion = handMotion(tracker, (lw.x - bodyMid) / sw, (rw.x - bodyMid) / sw, now);
    const chest = lw.y > shoulderY - WIPE_TOP * sw && rw.y > shoulderY - WIPE_TOP * sw && lw.y < hipY && rw.y < hipY;
    if (chest && wristGap < WIPE_HANDS * sw) updateWipe(tracker, midX, sw, now);
    else resetWipe(tracker);
    if (chest && wipeActive(tracker, now)) {
      return { status: 'ok', type: 'delete_all', reversals: tracker.reversals.length };
    }

    // 직전 지우기: 가슴 앞에서 손목이 실제로 엇갈린 X자 (왼손목이 몸 오른쪽 = x가 더 작음)
    const crossed = lw.x < rw.x;
    const xZone = lw.y > shoulderY + 0.3 * sw && rw.y > shoulderY + 0.3 * sw && lw.y < hipY && rw.y < hipY;
    if (crossed && xZone && Math.abs(midX - bodyMid) < 0.6 * sw) {
      return { status: 'ok', type: 'delete_one' };
    }

    // 회전: 한 팔만 어깨 높이에서 옆으로
    const rOut = Math.abs(rw.y - rs.y) < 0.5 * sw && rw.x < rs.x - 0.8 * sw;
    const lOut = Math.abs(lw.y - ls.y) < 0.5 * sw && lw.x > ls.x + 0.8 * sw;
    const lDown = lw.y > shoulderY + 0.6 * sw;
    const rDown = rw.y > shoulderY + 0.6 * sw;
    if (rOut && !lOut && lDown) return { status: 'ok', type: 'right' };
    if (lOut && !rOut && rDown) return { status: 'ok', type: 'left' };

    // 전진: 두 팔을 앞으로 나란히 (어깨 높이, 옆으로 벌어지지 않음, 몸 앞으로 나옴)
    const level = Math.abs(lw.y - ls.y) < 0.6 * sw && Math.abs(rw.y - rs.y) < 0.6 * sw;
    const notWide = rw.x > rs.x - 0.6 * sw && lw.x < ls.x + 0.6 * sw;
    const front = lw.z !== undefined && rw.z !== undefined ? (lw.z < ls.z - 0.1 && rw.z < rs.z - 0.1) : true;
    // 손을 흔드는 중에는 '앞으로'로 보지 않는다 (P3, 전문가 검토 뒤 추가 2026-11-07)
    const moving = Math.max(motion.l, motion.r) > MOVE_RANGE;
    if (level && notWide && front && !crossed && !moving && elbowsUp(lm, shoulderY, sw)) return { status: 'ok', type: 'forward' };

    return { status: 'ok', type: null };
  }

  // 동작이 명령이 되지 못했을 때 무엇을 고치면 되는지 찾는다 (P5, 전문가 검토 뒤 추가 2026-11-07).
  // 판정에는 쓰지 않는다. classify의 조건 가운데 하나만 어긋난 자세에만 답하고,
  // 팔을 내리고 있거나 한 팔로 가리키는 자세처럼 명령하려는지 알 수 없을 때는 말하지 않는다.
  // 반환: null 또는 { target: 하려던 것으로 보이는 동작, text: 아이에게 보일 말 }
  function nearMiss(lm, tracker) {
    if (!lm) return null;
    const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16], li = lm[19], ri = lm[20];
    const sw = Math.abs(ls.x - rs.x);
    if (sw < 0.03) return null;
    const shoulderY = (ls.y + rs.y) / 2, bodyMid = (ls.x + rs.x) / 2, hipY = shoulderY + 1.6 * sw;
    const dyL = (lw.y - ls.y) / sw, dyR = (rw.y - rs.y) / sw;
    const outL = (lw.x - ls.x) / sw, outR = (rs.x - rw.x) / sw;
    const lDown = dyL > 0.6, rDown = dyR > 0.6;
    const crossed = lw.x < rw.x;
    const midOff = Math.abs((lw.x + rw.x) / 2 - bodyMid) / sw;
    const wristGap = Math.hypot(lw.x - rw.x, lw.y - rw.y) / sw;
    const say = (target, text) => ({ target, text });

    // 시작: 두 손이 머리 위에 있는데 만나지 않음
    if (lw.y < nose.y - 0.2 * sw && rw.y < nose.y - 0.2 * sw) {
      if (midOff >= 0.6) return say('run', '두 손을 머리 바로 위로 모아 볼까요?');
      const gap = li && ri ? Math.hypot(li.x - ri.x, li.y - ri.y) / sw : wristGap;
      return gap < 1.5 ? say('run', '두 손끝을 머리 위에서 맞대 볼까요?') : null;
    }

    // 모두 지우기: 두 손이 움직이는데 함께 움직이지 않음
    const m = tracker && tracker.hist.length ? motionOf(tracker) : null;
    if (m && Math.min(m.l, m.r) > MOVE_RANGE && m.mid < 0.2 && lw.y < hipY && rw.y < hipY) {
      return say('delete_all', '두 손을 같은 쪽으로 함께 움직여 볼까요?');
    }

    // 오른쪽·왼쪽: 한 팔이 옆으로 나왔는데 조건 하나가 어긋남
    for (const [target, out, dy, otherOut, otherDown] of [['right', outR, dyR, outL, lDown], ['left', outL, dyL, outR, rDown]]) {
      if (otherOut >= 0.4) continue;
      if (out > 0.8 && Math.abs(dy) >= 0.5 && Math.abs(dy) < 1.5 && otherDown) return say(target, '팔을 어깨 높이로 맞춰 볼까요?');
      if (out > 0.8 && Math.abs(dy) < 0.5 && !otherDown) return say(target, '다른 팔은 내려 볼까요?');
      if (out > 0.3 && out <= 0.8 && Math.abs(dy) < 0.5 && otherDown) return say(target, '팔을 옆으로 더 쭉 펴 볼까요?');
    }

    // 하나 지우기: 손목이 거의 만났거나, 엇갈렸는데 높이가 다름
    const inX = lw.y > shoulderY + 0.3 * sw && rw.y > shoulderY + 0.3 * sw && lw.y < hipY && rw.y < hipY;
    if (crossed && lw.y <= shoulderY + 0.3 * sw && rw.y <= shoulderY + 0.3 * sw) return say('delete_one', '엇갈린 손을 가슴 앞으로 내려 볼까요?');
    if (!crossed && inX && wristGap < 0.35 && midOff < 0.6) return say('delete_one', '두 손목을 서로 엇갈려 볼까요?');
    if (crossed) return null;

    // 앞으로: 두 팔이 함께 올라왔는데 높이·너비·앞뒤 중 하나가 어긋남
    const levelL = Math.abs(dyL) < 0.6, levelR = Math.abs(dyR) < 0.6;
    const notWide = outR < 0.6 && outL < 0.6;
    const front = lw.z !== undefined && rw.z !== undefined ? (lw.z < ls.z - 0.1 && rw.z < rs.z - 0.1) : true;
    if (levelL && levelR && !notWide) return say('forward', '두 팔을 앞으로 모아 볼까요?');
    if (levelL && levelR && front && !elbowsUp(lm, shoulderY, sw)) return say('forward', '두 팔을 쭉 펴 볼까요?');
    if (levelL && levelR && !front) return say('forward', '두 팔을 앞으로 쭉 뻗어 볼까요?');
    if (notWide && front && dyL >= 0.6 && dyL < 1.5 && dyR >= 0.6 && dyR < 1.5) return say('forward', '두 팔을 어깨 높이까지 올려 볼까요?');
    if (notWide && front && dyL <= -0.6 && dyL > -1.2 && dyR <= -0.6 && dyR > -1.2) return say('forward', '두 팔을 어깨 높이로 내려 볼까요?');
    return null;
  }

  // 진단용(주소에 ?debug=1): 칠판 지우기 조건을 어디서 못 넘는지 보여 준다. 판정에는 쓰지 않는다
  function debugInfo(lm, tracker, now) {
    if (!lm) return 'no body';
    const ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
    const sw = Math.abs(ls.x - rs.x) || 1e-6, shoulderY = (ls.y + rs.y) / 2, hipY = shoulderY + 1.6 * sw;
    const f = n => n.toFixed(2);
    const wristGap = Math.hypot(lw.x - rw.x, lw.y - rw.y) / sw;
    const inBand = p => p.y > shoulderY - 0.2 * sw && p.y < hipY;
    const last = tracker.reversals[tracker.reversals.length - 1];
    return [
      `손목 보임 L ${f(v(lw))} R ${f(v(rw))} (0.50 이상)`,
      `손 높이(어깨=0) L ${f((lw.y - shoulderY) / sw)} R ${f((rw.y - shoulderY) / sw)} (-0.20~1.60) ${inBand(lw) && inBand(rw) ? 'OK' : 'X'}`,
      `두 손 간격 ${f(wristGap)} (${WIPE_HANDS.toFixed(2)} 미만) ${wristGap < WIPE_HANDS ? 'OK' : 'X'}`,
      `가운데 x ${f(((lw.x + rw.x) / 2 - (ls.x + rs.x) / 2) / sw)} · 왕복 폭 기준 ${WIPE_AMP}`,
      `방향 바뀜 ${tracker.reversals.length}번 (확정엔 3번) · 마지막 뒤 ${last === undefined ? '-' : Math.round(now - last) + 'ms'} (${WIPE_GAP} 안)`,
    ].join('\n');
  }

  window.BCM_GESTURES = { classify, nearMiss, createWipeTracker, resetWipe, debugInfo, WIPE_AMP, WIPE_GAP };
})();
