(function () {
    // 动态配置
    let BOARD_SIZE = 3;              // 默认3x3
    let TOTAL_TILES = 9;
    let EMPTY_VALUE;                 // 根据尺寸动态设置: size*size
    let GOAL_STATE = [];

    let currentBoard = [];
    let goalBoard = [];
    let initialBoard = [];

    // 移动记录
    let moveHistory = [];
    let moveDirections = [];

    // 求解基准记录（在“点击求解”时快照）
    let baseMoveHistory = [];
    let baseMoveDirections = [];

    // 求解相关
    let solutionMoves = [];
    let solutionDetails = [];
    let currentStepIndex = -1;
    let hasSolution = false;

    // 拖动相关
    let isDragging = false;
    let dragStartIndex = -1;
    let dragStartX = 0;
    let dragStartY = 0;

    // 计时相关（用 Date.now() 差值，避免 setInterval 漂移）
    let timerInterval = null;
    let timerStartTime = 0;     // 计时开始的 Date.now()
    let timerAccumulated = 0;   // 暂停前累计的秒数
    let isTimerRunning = false; // 第一次移动后开始
    let moveCount = 0;

    // 通关锁定
    let isBoardLocked = false;

    // DOM 元素
    const boardEl = document.getElementById('board');
    const moveRecord = document.getElementById('moveRecord');
    const stepsContainer = document.getElementById('stepsContainer');
    const moveCountDisplay = document.getElementById('moveCountDisplay');
    const timerDisplay = document.getElementById('timerDisplay');
    const gridSizeSelect = document.getElementById('gridSizeSelect');

    const startDropdown = document.getElementById('startDropdown');
    const startBtn = document.getElementById('startBtn');
    const startDropdownContent = document.getElementById('startDropdownContent');

    const solveBtn = document.getElementById('solveBtn');

    // 标签页
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabRecord = document.getElementById('tabRecord');
    const tabSteps = document.getElementById('tabSteps');

    // 弹窗
    const modal = document.getElementById('inputModal');
    const modalInputGrid = document.getElementById('modalInputGrid');
    const modalError = document.getElementById('modalError');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const modalHint = document.getElementById('modalHint');

    // ===== Solver API adapter (WebWorker first, fallback to main) =====
    const SolverAPI = (() => {
        let solver = null;
        let solverMode = "init"; // "worker" | "main"

        async function init() {
            if (solver) return solver;

            if (typeof window.PuzzleSolver === "undefined" || !window.PuzzleSolver) {
                throw new Error("PuzzleSolver not found. Ensure solver.js is loaded before script.js");
            }

            try {
                if (typeof window.PuzzleSolver.createWorkerProxy === "function") {
                    solver = await window.PuzzleSolver.createWorkerProxy("./solver.worker.js");
                    solverMode = "worker";
                    return solver;
                }
            } catch (e) {
                console.warn("Worker init failed, falling back to main thread:", e);
            }

            solver = window.PuzzleSolver;
            solverMode = "main";
            return solver;
        }

        function mode() { return solverMode; }

        async function solve(board, size, options = null) {
            const s = await init();
            return s.solve(board, size, options);
        }

        return { init, mode, solve };
    })();

    // ----- 辅助函数 -----
    function idxToRowCol(idx) {
        return { row: Math.floor(idx / BOARD_SIZE), col: idx % BOARD_SIZE };
    }
    function rowColToIdx(row, col) {
        return row * BOARD_SIZE + col;
    }
    function findEmptyIndex(board) {
        const idx = board.indexOf(EMPTY_VALUE);
        // 兼容 localStorage 中 null/undefined 的情况
        if (idx < 0) {
            for (let i = 0; i < board.length; i++) {
                if (board[i] == null) { board[i] = EMPTY_VALUE; return i; }
            }
        }
        return idx;
    }
    function copyBoard(board) {
        return board.slice();
    }
    function boardsEqual(b1, b2) {
        return b1.every((v, i) => v === b2[i]);
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 页面内提示条（样式已移至 CSS）
    function ensureToastEl() {
        let el = document.getElementById('gameToast');
        if (el) return el;

        el = document.createElement('div');
        el.id = 'gameToast';
        document.body.appendChild(el);
        return el;
    }

    let toastTimer = null;
    function showToast(type, title, message, autoHideMs = 2200) {
        const el = ensureToastEl();
        if (toastTimer) {
            clearTimeout(toastTimer);
            toastTimer = null;
        }

        el.className = type; // success / info / warning / error
        el.innerHTML = `<div class="toast-title">${title}</div><div>${message}</div>`;

        // show
        requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateX(-50%) translateY(0)';
        });

        if (autoHideMs && autoHideMs > 0) {
            toastTimer = setTimeout(() => {
                el.style.opacity = '0';
                el.style.transform = 'translateX(-50%) translateY(-6px)';
                toastTimer = null;
            }, autoHideMs);
        }
    }

    function lockBoard(locked) {
        isBoardLocked = !!locked;
        if (isBoardLocked) boardEl.classList.add('locked');
        else boardEl.classList.remove('locked');
    }

    function checkWinAndHandle() {
        if (!boardsEqual(currentBoard, goalBoard)) return false;
        if (isBoardLocked) return true; // 已处理过

        stopTimer();
        lockBoard(true);

        showToast(
            'success',
            '通关成功',
            `用时 ${formatTime(getElapsedSeconds())}，共 ${moveHistory.length} 步（可点“开局”继续）`,
            3500
        );

        return true;
    }

    // 初始化目标状态 [1,2,3,...,EMPTY]
    function generateGoalState(size) {
        const arr = [];
        for (let i = 1; i < size * size; i++) arr.push(i);
        arr.push(EMPTY_VALUE);
        return arr;
    }

    // “简单开局”：3x3 固定；其它尺寸少量合法随机步
    function generateInitialEasyBoard(size) {
        if (size === 3) {
            return [1, 2, 3, 4, 5, 6, 7, 9, 8];
        }
        const board = copyBoard(goalBoard);
        const steps = 12 + size * 2;
        let emptyIdx = board.indexOf(size * size);

        for (let step = 0; step < steps; step++) {
            const neighbors = [];
            const r = Math.floor(emptyIdx / size);
            const c = emptyIdx % size;
            if (r > 0) neighbors.push((r - 1) * size + c);
            if (r < size - 1) neighbors.push((r + 1) * size + c);
            if (c > 0) neighbors.push(r * size + (c - 1));
            if (c < size - 1) neighbors.push(r * size + (c + 1));
            const next = neighbors[Math.floor(Math.random() * neighbors.length)];
            [board[emptyIdx], board[next]] = [board[next], board[emptyIdx]];
            emptyIdx = next;
        }
        if (boardsEqual(board, goalBoard)) {
            const neighbors = [];
            const r = Math.floor(emptyIdx / size);
            const c = emptyIdx % size;
            if (r > 0) neighbors.push((r - 1) * size + c);
            if (r < size - 1) neighbors.push((r + 1) * size + c);
            if (c > 0) neighbors.push(r * size + (c - 1));
            if (c < size - 1) neighbors.push(r * size + (c + 1));
            const next = neighbors[Math.floor(Math.random() * neighbors.length)];
            [board[emptyIdx], board[next]] = [board[next], board[emptyIdx]];
        }
        return board;
    }

    // 重置所有数据 (尺寸变更时)
    function reinitializeBoard(newSize) {
        BOARD_SIZE = newSize;
        TOTAL_TILES = newSize * newSize;
        EMPTY_VALUE = TOTAL_TILES;      // 空格用最大值表示
        GOAL_STATE = generateGoalState(newSize);

        currentBoard = copyBoard(GOAL_STATE);
        goalBoard = copyBoard(GOAL_STATE);
        initialBoard = copyBoard(GOAL_STATE);

        moveHistory = [];
        moveDirections = [];
        clearSolution();
        resetTimerAndCount(true);
        lockBoard(false);
        updateDisplay();
        boardEl.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
    }

    // 计时器控制（基于 Date.now() 差值）
    function getElapsedSeconds() {
        if (!isTimerRunning) return timerAccumulated;
        return timerAccumulated + Math.floor((Date.now() - timerStartTime) / 1000);
    }
    function startTimerIfNeeded() {
        if (!isTimerRunning) {
            isTimerRunning = true;
            timerStartTime = Date.now();
            timerInterval = setInterval(updateTimerDisplay, 500);
        }
    }
    function stopTimer() {
        if (isTimerRunning) {
            timerAccumulated = getElapsedSeconds();
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        isTimerRunning = false;
    }
    function resetTimerAndCount(resetSteps = true) {
        stopTimer();
        timerAccumulated = 0;
        timerStartTime = 0;
        isTimerRunning = false;
        if (resetSteps) {
            moveCount = 0;
            moveHistory = [];
            moveDirections = [];
        }
        updateTimerDisplay();
        updateMoveCountDisplay();
    }
    function updateTimerDisplay() {
        timerDisplay.textContent = `⏱️ ${formatTime(getElapsedSeconds())}`;
    }
    function updateMoveCountDisplay() {
        moveCount = moveHistory.length;
        moveCountDisplay.textContent = `🚶 ${moveCount} 步`;
    }

    // 清除求解
    function clearSolution() {
        hasSolution = false;
        solutionMoves = [];
        solutionDetails = [];
        currentStepIndex = -1;
        baseMoveHistory = [];
        baseMoveDirections = [];
        updateStepsDisplay();
    }

    // 更新显示
    function updateDisplay() {
        renderBoard();
        updateMoveRecord();
        updateStepsDisplay();
        updateMoveCountDisplay();
    }

    // 渲染棋盘（全量重写 + 事件委托）
    function renderBoard() {
        let html = '';
        for (let i = 0; i < TOTAL_TILES; i++) {
            const value = currentBoard[i];
            const isEmpty = (value === EMPTY_VALUE || value == null);
            // 修复：如果值无效（null/undefined），视为空格并修正 currentBoard
            if (value == null && value !== EMPTY_VALUE) {
                currentBoard[i] = EMPTY_VALUE;
            }
            html += `<div class="tile${isEmpty ? ' empty' : ''}" data-index="${i}">${isEmpty ? '' : value}</div>`;
        }
        boardEl.innerHTML = html;

        // 锁定时不绑定事件
        if (isBoardLocked) return;

        // 事件委托：只绑定一次
        if (!boardEl._delegated) {
            boardEl.addEventListener('mousedown', (e) => {
                const tile = e.target.closest('.tile:not(.empty)');
                if (tile) startDrag(tile, e);
            });
            boardEl.addEventListener('touchstart', (e) => {
                const tile = e.target.closest('.tile:not(.empty)');
                if (tile) startDrag(tile, e);
            }, { passive: false });
            boardEl.addEventListener('click', (e) => {
                const tile = e.target.closest('.tile:not(.empty)');
                if (tile) handleClick(tile, e);
            });
            boardEl._delegated = true;
        }
    }

    // 点击移动（支持事件委托）
    function handleClick(tile, e) {
        if (isBoardLocked) return;
        if (_lastDragMove) { _lastDragMove = false; return; }

        const index = parseInt(tile.dataset.index);
        const emptyIdx = findEmptyIndex(currentBoard);

        const fromRowCol = idxToRowCol(index);
        const emptyRowCol = idxToRowCol(emptyIdx);
        const rowDiff = Math.abs(fromRowCol.row - emptyRowCol.row);
        const colDiff = Math.abs(fromRowCol.col - emptyRowCol.col);
        const isAdjacent = (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);

        if (isAdjacent) {
            performMove(index, emptyIdx);
        }
    }

    // 拖动开始
    function startDrag(tile, e) {
        if (isBoardLocked) return;
        if (e.button !== undefined && e.button !== 0) return;
        // 注意：不在 mousedown 时 preventDefault，否则 click 事件不会触发

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        dragStartIndex = parseInt(tile.dataset.index);
        dragStartX = clientX;
        dragStartY = clientY;
        dragMoved = false;
        tile.classList.add('dragging');

        // 触摸事件需要阻止默认行为（防滚动），鼠标事件不阻止（保留 click）
        if (e.touches) {
            e.preventDefault();
            document.addEventListener('touchmove', onDrag, { passive: false });
            document.addEventListener('touchend', endDrag);
            document.addEventListener('touchcancel', endDrag);
        } else {
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', endDrag);
        }
    }

    let dragMoved = false;
    let _lastDragMove = false;  // 标记是否刚完成拖拽移动

    function onDrag(e) {
        if (dragStartIndex < 0) return;
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = clientX - dragStartX;
        const dy = clientY - dragStartY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            dragMoved = true;
            isDragging = true;  // 只在真正拖动时才标记
            const tile = boardEl.children[dragStartIndex];
            if (tile) tile.style.transform = `translate(${dx}px, ${dy}px) scale(0.96)`;
        }
    }

    function endDrag(e) {
        if (dragStartIndex < 0) return;
        e.preventDefault();

        const startTile = boardEl.children[dragStartIndex];

        if (dragMoved) {
            const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

            // 清除 transform 和 dragging 样式
            if (startTile) {
                startTile.style.transform = '';
                startTile.classList.remove('dragging');
            }

            // 用坐标计算目标格子（空格有 pointer-events:none，elementsFromPoint 检测不到）
            const rect = boardEl.getBoundingClientRect();
            const padLeft = parseFloat(getComputedStyle(boardEl).paddingLeft) || 4;
            const padTop = parseFloat(getComputedStyle(boardEl).paddingTop) || 4;
            const innerW = rect.width - padLeft * 2;
            const innerH = rect.height - padTop * 2;
            const cellW = innerW / BOARD_SIZE;
            const cellH = innerH / BOARD_SIZE;
            const relX = clientX - rect.left - padLeft;
            const relY = clientY - rect.top - padTop;
            const col = Math.floor(relX / cellW);
            const row = Math.floor(relY / cellH);

            if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
                const targetIndex = row * BOARD_SIZE + col;
                const emptyIdx = findEmptyIndex(currentBoard);
                if (targetIndex === emptyIdx) {
                    _lastDragMove = true;
                    performMove(dragStartIndex, emptyIdx);
                }
            }
        } else if (e.changedTouches) {
            // 触摸事件不会产生合成 click，所以触摸点击在这里处理
            if (startTile) startTile.classList.remove('dragging');
            const index = parseInt(startTile.dataset.index);
            const emptyIdx = findEmptyIndex(currentBoard);
            const fromRowCol = idxToRowCol(index);
            const emptyRowCol = idxToRowCol(emptyIdx);
            const rowDiff = Math.abs(fromRowCol.row - emptyRowCol.row);
            const colDiff = Math.abs(fromRowCol.col - emptyRowCol.col);
            if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
                performMove(index, emptyIdx);
            }
        } else {
            // 鼠标点击：清理 dragging 样式，让 click 事件处理移动
            if (startTile) startTile.classList.remove('dragging');
        }

        dragStartIndex = -1;
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('touchend', endDrag);
        document.removeEventListener('touchcancel', endDrag);
    }

    // 执行移动
    function performMove(fromIdx, toIdx) {
        if (isBoardLocked) return false;
        if (fromIdx === toIdx) return false;

        const emptyIdx = findEmptyIndex(currentBoard);
        if (toIdx !== emptyIdx) return false;

        const fromRowCol = idxToRowCol(fromIdx);
        const emptyRowCol = idxToRowCol(emptyIdx);
        const rowDiff = Math.abs(fromRowCol.row - emptyRowCol.row);
        const colDiff = Math.abs(fromRowCol.col - emptyRowCol.col);
        const isAdjacent = (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
        if (!isAdjacent) return false;

        // 第一次有效移动：启动计时器
        if (!isTimerRunning && moveHistory.length === 0) {
            startTimerIfNeeded();
        }

        const movedNumber = currentBoard[fromIdx];
        [currentBoard[fromIdx], currentBoard[emptyIdx]] = [currentBoard[emptyIdx], currentBoard[fromIdx]];
        const direction = getMoveDirection(fromIdx, emptyIdx);

        if (hasSolution) {
            if (isMoveMatchingSolution(movedNumber, direction)) currentStepIndex++;
            else clearSolution();
        }

        moveHistory.push(movedNumber);
        moveDirections.push(direction);

        renderBoard();
        updateMoveRecord();
        updateStepsDisplay();
        updateMoveCountDisplay();
        saveGameState(); // 自动保存
        checkWinAndHandle();
        return true;
    }

    // 方向字符
    function getMoveDirection(fromIdx, toIdx) {
        const from = idxToRowCol(fromIdx);
        const to = idxToRowCol(toIdx);
        if (to.row - from.row === 1) return '↓';
        if (to.row - from.row === -1) return '↑';
        if (to.col - from.col === 1) return '→';
        if (to.col - from.col === -1) return '←';
        return '?';
    }

    // 检查移动是否与求解匹配
    function isMoveMatchingSolution(movedNumber, direction) {
        if (!hasSolution || currentStepIndex >= solutionMoves.length - 1) return false;
        const nextStepIndex = currentStepIndex + 1;
        if (nextStepIndex >= solutionDetails.length) return false;
        const expectedStep = solutionDetails[nextStepIndex];
        return expectedStep.number === movedNumber && expectedStep.directionChar === direction;
    }

    // 更新移动记录显示
    function updateMoveRecord() {
        if (moveHistory.length === 0) {
            moveRecord.innerHTML = '<div style="text-align:center; color:#7e6b55;">暂无移动记录</div>';
            return;
        }
        let html = '';
        for (let i = 0; i < moveHistory.length; i++) {
            const isCurrent = (i === moveHistory.length - 1);
            html += `<div class="move-item ${isCurrent ? 'current' : ''}">${moveHistory[i]}${moveDirections[i]}</div>`;
        }
        moveRecord.innerHTML = html;
    }

    // 更新步骤显示
    function updateStepsDisplay() {
        if (!hasSolution || solutionMoves.length === 0 || solutionDetails.length === 0) {
            stepsContainer.innerHTML = '<div class="empty-message">点击求解查看步骤</div>';
            return;
        }
        const totalSteps = solutionMoves.length;
        let html = '<div class="steps-header"><div class="steps-count">📋 求解步骤 ' + totalSteps + '</div>';
        html += '<div class="steps-nav">';
        html += '<button id="prevStepBtn" ' + (currentStepIndex <= -1 ? 'disabled' : '') + '>◀ 上</button>';
        html += '<span id="stepPosition">' + (currentStepIndex === -1 ? '起' : (currentStepIndex + 1)) + '/' + totalSteps + '</span>';
        html += '<button id="nextStepBtn" ' + (currentStepIndex >= totalSteps - 1 ? 'disabled' : '') + '>下 ▶</button>';
        html += '</div></div>';
        html += '<div class="steps-list" id="stepsList">';
        html += `<div class="step-badge start ${currentStepIndex === -1 ? 'current' : ''}" data-step-index="-1">起</div>`;
        for (let i = 0; i < solutionDetails.length; i++) {
            const detail = solutionDetails[i];
            let statusClass = (i === currentStepIndex) ? 'current' : (i < currentStepIndex ? 'executed' : 'pending');
            html += `<div class="step-badge ${statusClass}" data-step-index="${i}">${detail.number}${detail.directionChar}</div>`;
        }
        html += '</div>';
        stepsContainer.innerHTML = html;

        document.getElementById('prevStepBtn')?.addEventListener('click', prevStep);
        document.getElementById('nextStepBtn')?.addEventListener('click', nextStep);
        document.querySelectorAll('.step-badge').forEach(badge => {
            badge.addEventListener('click', function () {
                const index = parseInt(this.dataset.stepIndex);
                if (!isNaN(index)) jumpToStep(index, false);
            });
        });
    }

    // 步骤跳转
    function jumpToStep(stepIndex, isManualStep = false) {
        if (!hasSolution) return;
        if (stepIndex < -1 || stepIndex >= solutionMoves.length) return;

        const baseHistory = baseMoveHistory.slice();
        const baseDirections = baseMoveDirections.slice();

        if (stepIndex === -1) {
            currentBoard = copyBoard(initialBoard);
            moveHistory = baseHistory;
            moveDirections = baseDirections;
            currentStepIndex = -1;

            lockBoard(false);

            if (!isManualStep) {
                stopTimer();
                timerAccumulated = 0;
                isTimerRunning = false;
                updateTimerDisplay();
            }

            updateDisplay();
            return;
        }

        // 重建到指定步骤
        let tempBoard = copyBoard(initialBoard);
        let tempHistory = [];
        let tempDirections = [];

        for (let i = 0; i <= stepIndex; i++) {
            const dir = solutionMoves[i];
            const emptyIdx = findEmptyIndex(tempBoard);
            const { row, col } = idxToRowCol(emptyIdx);
            let targetIdx;
            if (dir === 'up') targetIdx = rowColToIdx(row - 1, col);
            else if (dir === 'down') targetIdx = rowColToIdx(row + 1, col);
            else if (dir === 'left') targetIdx = rowColToIdx(row, col - 1);
            else targetIdx = rowColToIdx(row, col + 1);

            const movedNumber = tempBoard[targetIdx];
            const arrow = dir === 'up' ? '↓' : dir === 'down' ? '↑' : dir === 'left' ? '→' : '←';

            [tempBoard[emptyIdx], tempBoard[targetIdx]] = [tempBoard[targetIdx], tempBoard[emptyIdx]];

            tempHistory.push(movedNumber);
            tempDirections.push(arrow);
        }

        currentBoard = tempBoard;
        moveHistory = baseHistory.concat(tempHistory);
        moveDirections = baseDirections.concat(tempDirections);
        currentStepIndex = stepIndex;

        if (isManualStep && !isTimerRunning) startTimerIfNeeded();

        if (!isManualStep) {
            stopTimer();
            timerAccumulated = 0;
            isTimerRunning = false;
            updateTimerDisplay();
        }

        lockBoard(false);
        updateDisplay();

        checkWinAndHandle();
    }

    function prevStep() {
        if (currentStepIndex > -1) jumpToStep(currentStepIndex - 1, true);
    }
    function nextStep() {
        if (currentStepIndex < solutionMoves.length - 1) jumpToStep(currentStepIndex + 1, true);
    }

    // 求解 - 使用独立求解器（异步，Worker优先）
    async function solvePuzzle() {
        solveBtn.disabled = true;
        const oldText = solveBtn.textContent;
        solveBtn.textContent = '⚡ 求解中...';

        try {
            if (boardsEqual(currentBoard, goalBoard)) {
                showToast('info', '提示', '已经是完成状态', 1800);
                return;
            }

            const result = await SolverAPI.solve(currentBoard, BOARD_SIZE, {
                timeLimitMs: 3000,
                maxMoves: 100,
                onProgress: null
            });

            if (!result) {
                showToast('error', '错误', '求解器返回错误', 2200);
                return;
            }

            if (!result.solvable) {
                showToast('warning', '无解', '当前棋盘无解', 2400);
                return;
            }

            if (result.moves === null) {
                const timeout = result.stats && result.stats.timeout;
                const maxMovesReached = result.stats && result.stats.maxMovesReached;
                const reason = timeout ? '超时' : (maxMovesReached ? '达到最大步数限制' : '未知原因');
                showToast('warning', '求解失败', `（${reason}）`, 2600);
                return;
            }

            if (!result.moves || result.moves.length === 0) {
                showToast('info', '提示', '已经是完成状态', 1800);
                return;
            }

            solutionMoves = result.moves;
            initialBoard = copyBoard(currentBoard);
            solutionDetails = result.details || [];
            currentStepIndex = -1;
            hasSolution = true;

            baseMoveHistory = moveHistory.slice();
            baseMoveDirections = moveDirections.slice();

            updateStepsDisplay();
            tabBtns[1].click();
        } catch (e) {
            console.error(e);
            showToast('error', '求解异常', (e && e.message) ? e.message : String(e), 2800);
        } finally {
            solveBtn.disabled = false;
            solveBtn.textContent = oldText;
        }
    }

    // 随机打乱：合法随机步，保证可解
    function randomBoard(mode) {
        let board = copyBoard(goalBoard);

        let steps;
        if (mode === 'easy') steps = 20 + BOARD_SIZE * 5;
        else if (mode === 'hard') steps = 200 + BOARD_SIZE * 50;
        else steps = 80 + BOARD_SIZE * 20;

        let emptyIdx = findEmptyIndex(board);
        let lastIdx = -1;

        for (let i = 0; i < steps; i++) {
            const neighbors = [];
            const { row, col } = idxToRowCol(emptyIdx);
            if (row > 0) neighbors.push(rowColToIdx(row - 1, col));
            if (row < BOARD_SIZE - 1) neighbors.push(rowColToIdx(row + 1, col));
            if (col > 0) neighbors.push(rowColToIdx(row, col - 1));
            if (col < BOARD_SIZE - 1) neighbors.push(rowColToIdx(row, col + 1));

            const filtered = neighbors.filter(n => n !== lastIdx);
            const choices = filtered.length > 0 ? filtered : neighbors;
            const next = choices[Math.floor(Math.random() * choices.length)];

            [board[emptyIdx], board[next]] = [board[next], board[emptyIdx]];
            lastIdx = emptyIdx;
            emptyIdx = next;
        }

        setNewBoard(board);
    }

    // 设置新棋盘
    function setNewBoard(newBoard) {
        currentBoard = copyBoard(newBoard);
        initialBoard = copyBoard(newBoard);

        lockBoard(false);
        clearSolution();
        resetTimerAndCount(true);

        updateDisplay();
    }

    // 重置到初始
    function resetToInitial() {
        currentBoard = copyBoard(initialBoard);

        lockBoard(false);
        clearSolution();
        resetTimerAndCount(true);

        updateDisplay();
    }

    // 手动弹窗
    function openModal() {
        modalHint.innerHTML = `<span>空</span> 表示空格 (1~${BOARD_SIZE * BOARD_SIZE - 1}各一次)`;
        let html = '';
        for (let r = 0; r < BOARD_SIZE; r++) {
            html += '<div class="modal-input-row">';
            for (let c = 0; c < BOARD_SIZE; c++) {
                html += `<input type="text" class="modal-input-cell" id="modal_${r}_${c}" maxlength="2" placeholder="空">`;
            }
            html += '</div>';
        }
        modalInputGrid.innerHTML = html;

        // 填充当前值
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const idx = r * BOARD_SIZE + c;
                const val = currentBoard[idx];
                const inp = document.getElementById(`modal_${r}_${c}`);
                if (val === EMPTY_VALUE) inp.value = '';
                else inp.value = val;
                inp.classList.remove('invalid');
            }
        }

        modalError.classList.remove('show');
        modal.style.display = 'flex';
    }

    function closeModal() {
        modal.style.display = 'none';
        modalError.classList.remove('show');
    }

    function showError() {
        modalError.classList.add('show');
        setTimeout(() => {
            modalError.classList.remove('show');
        }, 2000);
    }

    function applyModalInput() {
        let newBoard = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const inp = document.getElementById(`modal_${r}_${c}`);
                let val = inp.value.trim();
                if (val === '') {
                    newBoard.push(EMPTY_VALUE);
                } else {
                    const num = parseInt(val);
                    if (isNaN(num) || num < 1 || num >= EMPTY_VALUE) {
                        showError();
                        return;
                    }
                    newBoard.push(num);
                }
            }
        }

        // 校验
        const counts = new Array(EMPTY_VALUE + 1).fill(0);
        newBoard.forEach(v => counts[v]++);
        if (counts[EMPTY_VALUE] !== 1) {
            showError();
            return;
        }
        for (let i = 1; i < EMPTY_VALUE; i++) {
            if (counts[i] !== 1) {
                showError();
                return;
            }
        }

        setNewBoard(newBoard);
        closeModal();
    }

    // 开局下拉
    function toggleStartDropdown() {
        startDropdownContent.classList.toggle('show');
    }
    function closeStartDropdown() {
        startDropdownContent.classList.remove('show');
    }

    // 事件绑定
    startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStartDropdown();
    });

    startDropdownContent.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.action;
            closeStartDropdown();

            if (action === 'reset') resetToInitial();
            else if (action === 'manual') openModal();
            else if (action === 'easy') randomBoard('easy');
            else if (action === 'random') randomBoard('random');
            else if (action === 'hard') randomBoard('hard');
        });
    });

    document.addEventListener('click', (e) => {
        if (!startDropdown.contains(e.target)) closeStartDropdown();
    });

    solveBtn.addEventListener('click', solvePuzzle);

    // 撤销按钮
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
        undoBtn.addEventListener('click', undoMove);
    }

    modalCancelBtn.addEventListener('click', closeModal);
    modalConfirmBtn.addEventListener('click', applyModalInput);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // 标签页切换
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.tab === 'record') {
                tabRecord.classList.add('active');
                tabSteps.classList.remove('active');
            } else {
                tabSteps.classList.add('active');
                tabRecord.classList.remove('active');
            }
        });
    });

    document.addEventListener('selectstart', (e) => e.preventDefault());

    // ===== 键盘操作支持 =====
    document.addEventListener('keydown', (e) => {
        if (isBoardLocked) return;
        if (modal.style.display === 'flex') return; // 弹窗打开时不响应

        const emptyIdx = findEmptyIndex(currentBoard);
        const { row, col } = idxToRowCol(emptyIdx);
        let targetIdx = -1;

        // 方向键：移动空格（反向 = 移动数字）
        switch (e.key) {
            case 'ArrowUp':    if (row < BOARD_SIZE - 1) targetIdx = rowColToIdx(row + 1, col); break;
            case 'ArrowDown':  if (row > 0) targetIdx = rowColToIdx(row - 1, col); break;
            case 'ArrowLeft':  if (col < BOARD_SIZE - 1) targetIdx = rowColToIdx(row, col + 1); break;
            case 'ArrowRight': if (col > 0) targetIdx = rowColToIdx(row, col - 1); break;
            case 'z': case 'Z':
                if (e.ctrlKey || e.metaKey) { undoMove(); e.preventDefault(); }
                return;
            default: return;
        }

        if (targetIdx >= 0) {
            e.preventDefault();
            performMove(targetIdx, emptyIdx);
        }
    });

    // ===== 撤销功能 =====
    function undoMove() {
        if (moveHistory.length === 0) return;
        if (isBoardLocked) return;

        // 清除求解状态（撤销后解法失效）
        if (hasSolution) clearSolution();

        // 弹出最后一步
        const lastNumber = moveHistory.pop();
        const lastDirection = moveDirections.pop();

        // 反向移动：找到 lastNumber 的当前位置，移到空格
        const emptyIdx = findEmptyIndex(currentBoard);
        const { row: eRow, col: eCol } = idxToRowCol(emptyIdx);

        // 根据方向反推数字原来的位置
        let numIdx = -1;
        switch (lastDirection) {
            case '↑': numIdx = rowColToIdx(eRow + 1, eCol); break; // 数字向上=空格向下
            case '↓': numIdx = rowColToIdx(eRow - 1, eCol); break;
            case '←': numIdx = rowColToIdx(eRow, eCol + 1); break;
            case '→': numIdx = rowColToIdx(eRow, eCol - 1); break;
        }

        if (numIdx >= 0 && numIdx < TOTAL_TILES) {
            [currentBoard[numIdx], currentBoard[emptyIdx]] = [currentBoard[emptyIdx], currentBoard[numIdx]];
            renderBoard();
            updateMoveRecord();
            updateMoveCountDisplay();
            saveGameState();
        }

        // 如果撤销到0步，停止计时
        if (moveHistory.length === 0) {
            stopTimer();
            timerAccumulated = 0;
            updateTimerDisplay();
        }
    }

    // ===== localStorage 持久化 =====
    const STORAGE_KEY = 'hrd_game_state';

    function saveGameState() {
        try {
            const state = {
                board: currentBoard,
                initial: initialBoard,
                size: BOARD_SIZE,
                moves: moveHistory,
                directions: moveDirections,
                elapsed: getElapsedSeconds(),
                isRunning: isTimerRunning,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) { /* ignore */ }
    }

    function loadGameState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const state = JSON.parse(raw);
            if (!state.board || !state.size) return false;

            BOARD_SIZE = state.size;
            TOTAL_TILES = state.size * state.size;
            EMPTY_VALUE = TOTAL_TILES;
            GOAL_STATE = generateGoalState(state.size);
            goalBoard = copyBoard(GOAL_STATE);

            currentBoard = copyBoard(state.board);
            // 修复：确保 board 中没有 null/undefined
            for (let i = 0; i < currentBoard.length; i++) {
                if (currentBoard[i] == null) currentBoard[i] = EMPTY_VALUE;
            }
            initialBoard = state.initial ? copyBoard(state.initial) : copyBoard(state.board);
            moveHistory = state.moves || [];
            moveDirections = state.directions || [];
            timerAccumulated = state.elapsed || 0;

            gridSizeSelect.value = String(state.size);
            boardEl.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
            lockBoard(false);
            updateDisplay();

            if (state.isRunning && moveHistory.length > 0) {
                startTimerIfNeeded();
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    // 在每次移动后自动保存
    const _origPerformMove = performMove;
    // performMove 已经在上面定义了，我们在它末尾加 saveGameState 调用
    // 通过包装 updateDisplay 间接实现

    // 网格尺寸变更
    gridSizeSelect.addEventListener('change', (e) => {
        const newSize = parseInt(e.target.value);
        reinitializeBoard(newSize);
        setNewBoard(generateInitialEasyBoard(BOARD_SIZE));
    });

    // 初始化
    (function init() {
        reinitializeBoard(3);
        gridSizeSelect.value = '3';

        // 尝试加载保存的游戏状态
        if (!loadGameState()) {
            // 没有保存状态：第一次进入用简单开局
            setNewBoard(generateInitialEasyBoard(BOARD_SIZE));
        }

        // 提前初始化 Solver（减少首次点击求解延迟）
        SolverAPI.init().catch(console.warn);
    })();
})();