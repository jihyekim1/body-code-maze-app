// 미로 단계 정의 (screen-and-stages-2026-10-27.md 5절)
// 좌표: 왼쪽 위 (0,0). 방향: 0 위, 1 오른쪽, 2 아래, 3 왼쪽. 캐릭터는 처음에 위를 본다.
// 길 칸은 정답 경로가 지나는 칸만 연다. 예측하기는 모든 칸을 연다.
(function () {
  const SIZE = 5;
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];

  function parse(code) {
    return code.trim().split(/\s+/).map(c => ({ F: 'forward', L: 'left', R: 'right' }[c]));
  }

  // 명령을 따라가며 지나는 칸과 끝 상태를 구한다 (벽 검사 없음)
  function trace(start, cmds) {
    const p = { ...start };
    const cells = [[p.x, p.y]];
    for (const c of cmds) {
      if (c === 'forward') { p.x += DX[p.dir]; p.y += DY[p.dir]; cells.push([p.x, p.y]); }
      else if (c === 'left') p.dir = (p.dir + 3) % 4;
      else if (c === 'right') p.dir = (p.dir + 1) % 4;
    }
    return { cells, end: p };
  }

  function makeGrid(open, cells) {
    const g = [];
    for (let y = 0; y < SIZE; y++) g.push(new Array(SIZE).fill(open ? 1 : 0));
    if (!open) for (const [x, y] of cells) g[y][x] = 1;
    return g;
  }

  // type: make 만들기 / predict 예측하기 / fix 고치기
  const RAW = [
    { type: 'make', start: [2, 4], solution: 'F F' },
    { type: 'make', start: [1, 4], solution: 'F F F' },
    { type: 'make', start: [1, 4], solution: 'F R F F' },
    { type: 'make', start: [3, 4], solution: 'F F L F F' },
    { type: 'predict', start: [1, 4], given: 'F F R F' },
    { type: 'predict', start: [3, 4], given: 'F L F F' },
    { type: 'fix', start: [2, 4], solution: 'F F', given: 'F F F' },
    { type: 'fix', start: [1, 4], solution: 'F R F F', given: 'F R F L' },
    { type: 'make', start: [0, 4], solution: 'F R F F L F F' },
    { type: 'make', start: [4, 4], solution: 'F F L F F R F F' },
    { type: 'predict', start: [1, 4], given: 'R F F L F' },
    { type: 'predict', start: [1, 4], given: 'F R F R F' },
    { type: 'fix', start: [3, 4], solution: 'F F L F F', given: 'F F L F R' },
    { type: 'fix', start: [0, 4], solution: 'F R F F L F F', given: 'F R F F R F F' },
    { type: 'make', start: [0, 4], solution: 'F F F R F F R F F L F F' },
  ];

  const STAGES = RAW.map((r, i) => {
    const start = { x: r.start[0], y: r.start[1], dir: 0 };
    const stage = { id: i + 1, type: r.type, start, given: r.given ? parse(r.given) : [] };
    if (r.type === 'predict') {
      stage.grid = makeGrid(true, []);
      stage.goal = null;
      stage.predictEnd = trace(start, stage.given).end;
    } else {
      const sol = parse(r.solution);
      const t = trace(start, sol);
      stage.grid = makeGrid(false, t.cells);
      stage.goal = { x: t.end.x, y: t.end.y };
      stage.solution = sol;
      stage.grid[stage.goal.y][stage.goal.x] = 2;
    }
    return stage;
  });

  window.BCM_STAGES = { SIZE, DX, DY, STAGES, trace, parse };
})();
