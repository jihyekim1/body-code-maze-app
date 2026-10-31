// 활동 뒤 '카메라가 읽은 동작' 설명 (G11·P4, 결정표 D-6)
// 설명은 판정 규칙(js/gestures.js)을 아이 말로 옮긴 것이다. 주어는 카메라가 본 것이고,
// 아이의 의도나 조명 같은 관측할 수 없는 원인은 말하지 않는다 (P4·P5).
(function () {
  const SEEN = {
    forward: '두 팔이 어깨 높이로 앞으로 나와 있었어요',
    right: '오른팔만 어깨 높이로 옆에 나와 있었어요',
    left: '왼팔만 어깨 높이로 옆에 나와 있었어요',
    delete_one: '두 손목이 가슴 앞에서 엇갈려 있었어요',
    delete_all: '두 손이 가슴 앞에서 왼쪽 오른쪽으로 오갔어요',
    run: '두 손이 머리 위에서 만났어요',
  };
  const NAME = { forward: '앞으로', right: '오른쪽', left: '왼쪽', delete_one: '하나 지우기', delete_all: '모두 지우기', run: '시작' };
  const AS = { forward: "'앞으로'로", right: "'오른쪽'으로", left: "'왼쪽'으로", delete_one: "'하나 지우기'로", delete_all: "'모두 지우기'로", run: "'시작'으로" };
  const LOST = {
    gone: '그 동작이 보이지 않게 되어서',
    body: '몸이 화면에서 잘 보이지 않아서',
    lowvis: '손이 잘 보이지 않아서',
  };
  // 넣지 않은 후보 중 이만큼(유지 시간에 대한 비율) 넘게 본 것만 줄에 보인다. 잠깐 스친 후보는 뺀다
  const MISS_MIN = 0.5;

  // ev: { k: 'add'|'act'|'blocked'|'miss'|'teacher', t: 동작, p: 내 동작 맞추기 사용, gone: 나중에 지워짐, ms, why }
  function text(ev, hold) {
    const { k, t } = ev;
    if (k === 'teacher') return t === 'run' ? '선생님이 시작했어요.' : '선생님이 블록을 모두 지웠어요.';
    if (k === 'miss') {
      return `카메라가 '${NAME[t]}' 동작을 ${(ev.ms / 1000).toFixed(1)}초 봤어요. ` +
        `${hold[t] / 1000}초가 되기 전에 ${LOST[ev.why] || LOST.gone} 넣지 않았어요.`;
    }
    const seen = ev.p && t !== 'delete_all'
      ? `내가 보여 준 '${NAME[t]}' 동작과 가장 비슷했어요`
      : SEEN[t];
    let s = `${seen}. 그래서 ${AS[t]} 읽었어요.`;
    if (k === 'blocked') s += ' 예측하기라서 블록은 넣지 않았어요.';
    if (k === 'add' && ev.gone) s += ' 그다음 지웠어요.';
    return s;
  }
  function label(ev) {
    if (ev.k === 'miss') return '넣지 않음';
    if (ev.k === 'blocked') return '안 넣음';
    if (ev.k === 'teacher') return '선생님';
    if (ev.k === 'add' && ev.gone) return '지움';
    return '';
  }

  window.BCM_WHY = { text, label, MISS_MIN, NAME };
})();
