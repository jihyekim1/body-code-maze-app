// 개인별 동작 맞추기 (P9, F-4·F-5)
// 따로 마련한 연습 단계에서 모은 아이의 시범으로 작은 최근접 이웃 분류기를 만든다.
// 활동 중에는 배우지 않는다. 칠판 지우기는 움직이는 동작이라 규칙 판정을 그대로 쓴다.
(function () {
  const VIS = 0.5;
  const POINTS = [0, 11, 12, 13, 14, 15, 16, 19, 20];   // 코, 어깨, 팔꿈치, 손목, 검지 끝
  const K = 5;
  const REJECT = 0.8;      // 가장 가까운 시범과 관절 하나라도 이만큼(어깨 폭 단위) 떨어지면 판정하지 않음
  const TOO_CLOSE = 0.35;  // 새 시범의 평균이 다른 동작의 평균과 이만큼 가까우면 다시 시범
  const CLASSES = ['neutral', 'forward', 'right', 'left', 'delete_one', 'run'];

  const v = p => (p && p.visibility !== undefined ? p.visibility : 1);

  // 어깨 가운데를 원점, 어깨 폭을 1로 맞춘 관절 좌표. 관절이 흐리면 null
  function features(lm) {
    if (!lm) return null;
    const ls = lm[11], rs = lm[12];
    if (POINTS.some(i => v(lm[i]) < VIS)) return null;
    const sw = Math.abs(ls.x - rs.x);
    if (sw < 0.03) return null;
    const cx = (ls.x + rs.x) / 2, cy = (ls.y + rs.y) / 2, cz = ((ls.z || 0) + (rs.z || 0)) / 2;
    const f = [];
    for (const i of POINTS) f.push((lm[i].x - cx) / sw, (lm[i].y - cy) / sw, ((lm[i].z || 0) - cz) / sw);
    return f;
  }

  // 관절별 거리의 평균(이웃 고르기용)과 최댓값(거부용)
  function dists(a, b) {
    let s = 0, m = 0;
    for (let i = 0; i < a.length; i += 3) {
      const d = Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]);
      s += d; m = Math.max(m, d);
    }
    return { mean: s / (a.length / 3), max: m };
  }
  const dist = (a, b) => dists(a, b).mean;

  function mean(fs) {
    const m = new Array(fs[0].length).fill(0);
    for (const f of fs) f.forEach((x, i) => { m[i] += x / fs.length; });
    return m;
  }

  // 새 시범이 이미 배운 다른 동작과 겹치는지 본다. 겹치면 그 동작 이름을 돌려준다
  function overlaps(samples, type, fs) {
    const m = mean(fs);
    for (const c of CLASSES) {
      if (c === type) continue;
      const other = samples.filter(s => s.type === c).map(s => s.f);
      if (other.length && dist(m, mean(other)) < TOO_CLOSE) return c;
    }
    return null;
  }

  // 반환: 'neutral' | 동작 이름 | null(어느 시범과도 멀거나 표가 갈림)
  function predict(samples, f) {
    if (!f || !samples.length) return null;
    const near = samples.map(s => ({ type: s.type, ...dists(s.f, f) })).sort((a, b) => a.mean - b.mean).slice(0, K);
    if (near[0].max > REJECT) return null;
    const votes = {};
    for (const n of near) votes[n.type] = (votes[n.type] || 0) + 1;
    const [best, count] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    return count > K / 2 ? best : null;
  }

  window.BCM_PERSONAL = { features, predict, overlaps, CLASSES, REJECT, TOO_CLOSE };
})();
