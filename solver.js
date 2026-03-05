const PuzzleSolver = (function () {
  const DIRECTIONS = { UP: "up", DOWN: "down", LEFT: "left", RIGHT: "right" };
  const DIRECTION_ARROWS = { up: "↑", down: "↓", left: "←", right: "→" };
  const SPACE_TO_NUMBER = { up: "down", down: "up", left: "right", right: "left" };
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

  const DEFAULT_LIMITS = { timeLimitMs: 3000, maxMoves: 100 };

  function getDirectionArrow(direction) {
    return DIRECTION_ARROWS[direction] || "?";
  }

  function isGoal(board, size) {
    const emptyValue = size * size;
    for (let i = 0; i < board.length - 1; i++) {
      if (board[i] !== i + 1) return false;
    }
    return board[board.length - 1] === emptyValue;
  }

  function countInversions(board, size) {
    const emptyValue = size * size;
    let inv = 0;
    for (let i = 0; i < board.length; i++) {
      const a = board[i];
      if (a === emptyValue) continue;
      for (let j = i + 1; j < board.length; j++) {
        const b = board[j];
        if (b === emptyValue) continue;
        if (a > b) inv++;
      }
    }
    return inv;
  }

  // 标准目标：空格在右下；空格值=size*size；合法移动为与空格相邻交换
  function isSolvable(board, size) {
    if (!board || board.length !== size * size) return false;

    const emptyValue = size * size;
    const emptyIndex = board.indexOf(emptyValue);
    if (emptyIndex === -1) return false;

    const inv = countInversions(board, size);

    if (size % 2 === 1) return inv % 2 === 0;

    const rowFromTop0 = Math.floor(emptyIndex / size);
    const blankRowFromBottom = size - rowFromTop0; // 1-based
    return (inv + blankRowFromBottom) % 2 === 1;
  }

  function buildGoalPos(size) {
    const n = size * size;
    const goalRow = new Array(n + 1);
    const goalCol = new Array(n + 1);
    for (let v = 1; v <= n; v++) {
      const idx = v - 1;
      goalRow[v] = Math.floor(idx / size);
      goalCol[v] = idx % size;
    }
    return { goalRow, goalCol };
  }

  function manhattan(board, size, goalRow, goalCol) {
    const emptyValue = size * size;
    let d = 0;
    for (let i = 0; i < board.length; i++) {
      const v = board[i];
      if (v === emptyValue) continue;
      const r = Math.floor(i / size);
      const c = i % size;
      d += Math.abs(r - goalRow[v]) + Math.abs(c - goalCol[v]);
    }
    return d;
  }

  function linearConflict(board, size, goalRow, goalCol) {
    const emptyValue = size * size;
    let conflict = 0;

    for (let r = 0; r < size; r++) {
      const base = r * size;
      for (let i = 0; i < size; i++) {
        const a = board[base + i];
        if (a === emptyValue) continue;
        if (goalRow[a] !== r) continue;
        for (let j = i + 1; j < size; j++) {
          const b = board[base + j];
          if (b === emptyValue) continue;
          if (goalRow[b] !== r) continue;
          if (goalCol[a] > goalCol[b]) conflict += 2;
        }
      }
    }

    for (let c = 0; c < size; c++) {
      for (let i = 0; i < size; i++) {
        const a = board[i * size + c];
        if (a === emptyValue) continue;
        if (goalCol[a] !== c) continue;
        for (let j = i + 1; j < size; j++) {
          const b = board[j * size + c];
          if (b === emptyValue) continue;
          if (goalCol[b] !== c) continue;
          if (goalRow[a] > goalRow[b]) conflict += 2;
        }
      }
    }

    return conflict;
  }

  function heuristic(board, size, goalRow, goalCol) {
    return manhattan(board, size, goalRow, goalCol) + linearConflict(board, size, goalRow, goalCol);
  }

  function getMoves(emptyIdx, size, prevMove) {
    const r = Math.floor(emptyIdx / size);
    const c = emptyIdx % size;
    const moves = [];
    if (r > 0) moves.push("up");
    if (r < size - 1) moves.push("down");
    if (c > 0) moves.push("left");
    if (c < size - 1) moves.push("right");
    if (prevMove) {
      const back = OPPOSITE[prevMove];
      const k = moves.indexOf(back);
      if (k !== -1) moves.splice(k, 1);
    }
    return moves;
  }

  function applyMoveInPlace(board, emptyIdx, move, size) {
    let target = -1;
    switch (move) {
      case "up": target = emptyIdx - size; break;
      case "down": target = emptyIdx + size; break;
      case "left": target = emptyIdx - 1; break;
      case "right": target = emptyIdx + 1; break;
      default: return null;
    }
    const movedNumber = board[target];
    board[emptyIdx] = movedNumber;
    board[target] = size * size;
    return { movedNumber, newEmptyIdx: target };
  }

  function undoMoveInPlace(board, emptyIdxBefore, emptyIdxAfter, movedNumber, emptyValue) {
    board[emptyIdxAfter] = movedNumber;
    board[emptyIdxBefore] = emptyValue;
  }

  // 3x3 用 A*（最优且通常很快），这里保留简单实现（用字符串key）
  class MinHeap {
    constructor() { this.a = []; }
    push(x) {
      const a = this.a; a.push(x);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].f <= a[i].f) break;
        [a[p], a[i]] = [a[i], a[p]];
        i = p;
      }
    }
    pop() {
      const a = this.a;
      if (!a.length) return null;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        while (true) {
          let l = i * 2 + 1, r = l + 1, m = i;
          if (l < a.length && a[l].f < a[m].f) m = l;
          if (r < a.length && a[r].f < a[m].f) m = r;
          if (m === i) break;
          [a[m], a[i]] = [a[i], a[m]];
          i = m;
        }
      }
      return top;
    }
    get size() { return this.a.length; }
  }

  function aStarSolve(startBoard, size, limits) {
    const emptyValue = size * size;
    const { goalRow, goalCol } = buildGoalPos(size);

    const goal = [];
    for (let i = 1; i < emptyValue; i++) goal.push(i);
    goal.push(emptyValue);
    const goalKey = goal.join(",");

    const startKey = startBoard.join(",");
    if (startKey === goalKey) return { moves: [], stats: { nodesExpanded: 0 } };

    const heap = new MinHeap();
    const gScore = new Map();
    const parent = new Map();

    const t0 = performance.now ? performance.now() : Date.now();
    let nodesExpanded = 0;

    heap.push({
      key: startKey,
      board: startBoard.slice(),
      emptyIdx: startBoard.indexOf(emptyValue),
      g: 0,
      f: heuristic(startBoard, size, goalRow, goalCol),
    });
    gScore.set(startKey, 0);

    while (heap.size) {
      const now = performance.now ? performance.now() : Date.now();
      if (now - t0 > limits.timeLimitMs) {
        return { moves: null, stats: { nodesExpanded, timeout: true } };
      }

      const cur = heap.pop();
      if (!cur) break;
      nodesExpanded++;

      if (cur.g > limits.maxMoves) {
        return { moves: null, stats: { nodesExpanded, maxMovesReached: true } };
      }

      if (cur.key === goalKey) {
        const moves = [];
        let k = goalKey;
        while (k !== startKey) {
          const p = parent.get(k);
          if (!p) break;
          moves.push(p.move);
          k = p.prevKey;
        }
        moves.reverse();
        return { moves, stats: { nodesExpanded } };
      }

      const moves = getMoves(cur.emptyIdx, size, null);
      for (const mv of moves) {
        const nb = cur.board.slice();
        const res = applyMoveInPlace(nb, cur.emptyIdx, mv, size);
        if (!res) continue;

        const nk = nb.join(",");
        const ng = cur.g + 1;

        const best = gScore.get(nk);
        if (best !== undefined && ng >= best) continue;

        gScore.set(nk, ng);
        parent.set(nk, { prevKey: cur.key, move: mv });

        const nf = ng + heuristic(nb, size, goalRow, goalCol);
        heap.push({ key: nk, board: nb, emptyIdx: res.newEmptyIdx, g: ng, f: nf });
      }
    }

    return { moves: null, stats: { nodesExpanded } };
  }

  // 4x4/5x5 用 IDA*（最优；加 maxMoves/timeLimit 防卡死）
  function idaStarSolve(startBoard, size, limits, onProgress) {
    const emptyValue = size * size;
    const { goalRow, goalCol } = buildGoalPos(size);

    const board = startBoard.slice();
    let emptyIdx = board.indexOf(emptyValue);

    const t0 = performance.now ? performance.now() : Date.now();
    const stats = { nodesExpanded: 0 };

    let bound = heuristic(board, size, goalRow, goalCol);
    if (bound > limits.maxMoves) {
      return { moves: null, stats: { ...stats, maxMovesReached: true } };
    }

    const path = [];

    function dfs(g, bound, prevMove) {
      stats.nodesExpanded++;

      const now = performance.now ? performance.now() : Date.now();
      if (now - t0 > limits.timeLimitMs) return Infinity; // timeout

      if (g > limits.maxMoves) return Infinity;

      const h = heuristic(board, size, goalRow, goalCol);
      const f = g + h;
      if (f > bound) return f;
      if (h === 0) return true;

      if (onProgress && (stats.nodesExpanded % 10000 === 0)) {
        onProgress({ nodesExpanded: stats.nodesExpanded, depth: g, bound });
      }

      const moves = getMoves(emptyIdx, size, prevMove);

      // move ordering: smaller h first
      const cands = [];
      for (const mv of moves) {
        const emptyBefore = emptyIdx;
        const res = applyMoveInPlace(board, emptyIdx, mv, size);
        if (!res) continue;
        emptyIdx = res.newEmptyIdx;

        cands.push({
          mv,
          h: heuristic(board, size, goalRow, goalCol),
          movedNumber: res.movedNumber,
          emptyBefore,
          emptyAfter: emptyIdx,
        });

        undoMoveInPlace(board, emptyBefore, emptyIdx, res.movedNumber, emptyValue);
        emptyIdx = emptyBefore;
      }
      cands.sort((a, b) => a.h - b.h);

      let min = Infinity;
      for (const c of cands) {
        const emptyBefore = emptyIdx;
        const res = applyMoveInPlace(board, emptyIdx, c.mv, size);
        emptyIdx = res.newEmptyIdx;

        path.push(c.mv);
        const t = dfs(g + 1, bound, c.mv);
        if (t === true) return true;
        if (t < min) min = t;
        path.pop();

        undoMoveInPlace(board, emptyBefore, emptyIdx, res.movedNumber, emptyValue);
        emptyIdx = emptyBefore;
      }
      return min;
    }

    while (true) {
      if (bound > limits.maxMoves) {
        return { moves: null, stats: { ...stats, maxMovesReached: true } };
      }

      const t = dfs(0, bound, null);
      if (t === true) return { moves: path.slice(), stats };
      if (t === Infinity) {
        const now = performance.now ? performance.now() : Date.now();
        const timedOut = now - t0 > limits.timeLimitMs;
        return { moves: null, stats: { ...stats, timeout: timedOut, maxMovesReached: !timedOut } };
      }
      bound = t;
    }
  }

  function verifySolution(startBoard, moves, size) {
    if (!moves || moves.length === 0) return isGoal(startBoard, size);

    const board = startBoard.slice();
    const emptyValue = size * size;
    let emptyIdx = board.indexOf(emptyValue);

    for (const mv of moves) {
      const res = applyMoveInPlace(board, emptyIdx, mv, size);
      if (!res) return false;
      emptyIdx = res.newEmptyIdx;
    }
    return isGoal(board, size);
  }

  function normalizeThirdArg(progressCallbackOrConfig) {
    // 兼容：null / function / configObject
    if (!progressCallbackOrConfig) {
      return { limits: { ...DEFAULT_LIMITS }, onProgress: null };
    }
    if (typeof progressCallbackOrConfig === "function") {
      return { limits: { ...DEFAULT_LIMITS }, onProgress: progressCallbackOrConfig };
    }
    if (typeof progressCallbackOrConfig === "object") {
      const cfg = progressCallbackOrConfig;
      const limits = {
        timeLimitMs: Number.isFinite(cfg.timeLimitMs) ? cfg.timeLimitMs : DEFAULT_LIMITS.timeLimitMs,
        maxMoves: Number.isFinite(cfg.maxMoves) ? cfg.maxMoves : DEFAULT_LIMITS.maxMoves,
      };
      const onProgress = typeof cfg.onProgress === "function" ? cfg.onProgress : null;
      return { limits, onProgress };
    }
    return { limits: { ...DEFAULT_LIMITS }, onProgress: null };
  }

  function solve(board, size, progressCallback = null) {
    if (!board || !Array.isArray(board)) throw new Error("棋盘必须是数组");
    if (board.length !== size * size) {
      throw new Error(`棋盘尺寸不匹配: 需要 ${size * size} 个数字，实际 ${board.length} 个`);
    }

    const emptyValue = size * size;
    const seen = new Set();
    for (const v of board) {
      if (v < 1 || v > emptyValue) throw new Error(`数字必须在 1-${emptyValue} 之间，出现 ${v}`);
      if (seen.has(v)) throw new Error(`棋盘数字重复: ${v}`);
      seen.add(v);
    }

    const { limits, onProgress } = normalizeThirdArg(progressCallback);

    if (isGoal(board, size)) {
      return { solvable: true, moves: [], details: [], stats: { nodesExpanded: 0, time: 0 } };
    }

    if (!isSolvable(board, size)) {
      return { solvable: false, moves: null, details: [], stats: { nodesExpanded: 0, time: 0 } };
    }

    const t0 = performance.now ? performance.now() : Date.now();

    let result;
    if (size === 3) result = aStarSolve(board, size, limits);
    else result = idaStarSolve(board, size, limits, onProgress);

    const t1 = performance.now ? performance.now() : Date.now();

    if (!result || !result.moves) {
      return {
        solvable: true,
        moves: null,
        details: [],
        stats: {
          nodesExpanded: result?.stats?.nodesExpanded ?? 0,
          time: ((t1 - t0) / 1000).toFixed(2),
          timeout: !!result?.stats?.timeout,
          maxMovesReached: !!result?.stats?.maxMovesReached,
        },
      };
    }

    // 生成 details（数字移动方向）
    const details = [];
    const replay = board.slice();
    let emptyIdx = replay.indexOf(emptyValue);

    for (const spaceMove of result.moves) {
      const movedIdx =
        spaceMove === "up" ? emptyIdx - size :
        spaceMove === "down" ? emptyIdx + size :
        spaceMove === "left" ? emptyIdx - 1 :
        emptyIdx + 1;

      const movedNumber = replay[movedIdx];
      const res = applyMoveInPlace(replay, emptyIdx, spaceMove, size);
      if (!res) break;
      emptyIdx = res.newEmptyIdx;

      const numberDirection = SPACE_TO_NUMBER[spaceMove];
      details.push({
        number: movedNumber,
        direction: numberDirection,
        directionChar: DIRECTION_ARROWS[numberDirection],
      });
    }

    return {
      solvable: true,
      moves: result.moves,
      details,
      stats: {
        nodesExpanded: result.stats.nodesExpanded,
        time: ((t1 - t0) / 1000).toFixed(2),
      },
    };
  }

  return { solve, isSolvable, verifySolution, getDirectionArrow };
})();

// ---- Global export (Browser main thread + WebWorker) ----
(function exportPuzzleSolverGlobal() {
  // globalThis works in both window and worker
  const g =
    (typeof globalThis !== "undefined") ? globalThis :
    (typeof window !== "undefined") ? window :
    (typeof self !== "undefined") ? self :
    null;

  if (g) g.PuzzleSolver = g.PuzzleSolver || PuzzleSolver;
})();

// ---- Optional: Worker-backed proxy (keeps UI responsive) ----
PuzzleSolver.createWorkerProxy = function createWorkerProxy(workerUrl) {
  if (typeof Worker === "undefined") {
    return Promise.reject(new Error("Worker not supported"));
  }

  const w = new Worker(workerUrl);
  let seq = 1;
  const pending = new Map();

  w.onmessage = (ev) => {
    const msg = ev && ev.data;
    if (!msg || !msg.id) return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error || "Worker call failed"));
  };

  w.onerror = (err) => {
    for (const [, p] of pending) p.reject(err instanceof Error ? err : new Error(String(err)));
    pending.clear();
  };

  function call(method, args) {
    const id = seq++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      w.postMessage({ id, method, args: Array.isArray(args) ? args : [] });
    });
  }

  return Promise.resolve({
    solve(board, size, options) { return call("solve", [board, size, options || null]); },
    isSolvable(board, size) { return call("isSolvable", [board, size]); },
    verifySolution(board, moves, size) { return call("verifySolution", [board, moves, size]); },
    getDirectionArrow(direction) { return call("getDirectionArrow", [direction]); },
    terminate() { try { w.terminate(); } catch (_) {} },
  });
};
