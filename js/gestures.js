// 몸동작 판정 (screen-and-stages-2026-10-27.md 2절)
// MediaPipe Pose 관절 좌표(영상 좌우 반전 전)를 받아 명령 후보 하나를 돌려준다.
// 모든 거리는 어깨 폭(sw) 비율이다. 영상 좌표에서 사람의 오른쪽은 x가 작은 쪽이다.
(function () {
  const VIS = 0.5;
  const WIPE_AMP = 0.35;   // 칠판 지우기 왕복 폭 (sw)
  const WIPE_HANDS = 2.0;  // 두 손목 사이 최대 간격 (sw). 칠판 지우듯 손을 벌려도 되게 (2026-10-29, 1.2→2.0)
  const WIPE_GAP = 1500;   // 방향 바뀜 사이 최대 간격 (ms). 천천히 크게 문질러도 끊기지 않게 (2026-10-29, 800→1500)

  const v = p => (p && p.visibility !== undefined ? p.visibility : 1);

  function createWipeTracker() {
    return { dir: 0, anchor: null, extreme: null, reversals: [] };
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
    const chest = lw.y > shoulderY - 0.2 * sw && rw.y > shoulderY - 0.2 * sw && lw.y < hipY && rw.y < hipY;
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
    if (level && notWide && front && !crossed) return { status: 'ok', type: 'forward' };

    return { status: 'ok', type: null };
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

  window.BCM_GESTURES = { classify, createWipeTracker, resetWipe, debugInfo, WIPE_AMP, WIPE_GAP };
})();
