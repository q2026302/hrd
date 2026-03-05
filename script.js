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

    // 计时相关
    let timerInterval = null;
    let timerSeconds = 0;
    let isTimerRunning = false;        // 第一次移动后开始
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
        return board.indexOf(EMPTY_VALUE);
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

    // 页面内提示条
    function ensureToastEl() {
        let el = document.getElementById('gameToast');
        if (el) return el;

        el = document.createElement('div');
        el.id = 'gameToast';
        el.style.position = 'fixed';
        el.style.left = '50%';
        el.style.top = '16px';
        el.style.transform = 'translateX(-50%)';
        el.style.zIndex = '9999';
        el.style.maxWidth = '92vw';
        el.style.padding = '10px 14px';
        el.style.borderRadius = '12px';
        el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.18)';
        el.style.fontSize = '14px';
        el.style.lineHeight = '1.4';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        el.style.transition = 'opacity 180ms ease, transform 180ms ease';
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

        const colors = {
            success: { bg: '#ecfdf5', border: '#a7f3d0', fg: '#065f46' },
            info: { bg: '#eff6ff', border: '#bfdbfe', fg: '#1e40af' },
            warning: { bg: '#fffbeb', border: '#fde68a', fg: '#92400e' },
            error: { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b' }
        };
        const c = colors[type] || colors.info;

        el.style.background = c.bg;
        el.style.border = `1px solid ${c.border}`;
        el.style.color = c.fg;
        el.innerHTML = `<div style="font-weight:700; margin-bottom:2px;">${title}</div><div>${message}</div>`;

        // show
        el.style.opacity = '1';
        el.style.transform = 'translateX(-50%) translateY(0)';

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
            `用时 ${formatTime(timerSeconds)}，共 ${moveHistory.length} 步（可点“开局”继续）`,
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

    // 计时器控制
    function startTimerIfNeeded() {
        if (!isTimerRunning) {
            isTimerRunning = true;
            timerInterval = setInterval(() => {
                timerSeconds++;
                updateTimerDisplay();
            }, 1000);
        }
    }
    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        isTimerRunning = false;
    }
    function resetTimerAndCount(resetSteps = true) {
        stopTimer();
        timerSeconds = 0;
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
        timerDisplay.textContent = `⏱️ ${formatTime(timerSeconds)}`;
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

    // 渲染棋盘
    function renderBoard() {
        let html = '';
        for (let i = 0; i < TOTAL_TILES; i++) {
            const value = currentBoard[i];
            const isEmpty = (value === EMPTY_VALUE);
            const numberText = isEmpty ? '' : value;
            html += `<div class="tile ${isEmpty ? 'empty' : ''}" data-index="${i}">${numberText}</div>`;
        }
        boardEl.innerHTML = html;

        // 锁定时不给 tile 绑定事件（从根源避免误触/拖拽）
        if (isBoardLocked) return;

        const tiles = document.querySelectorAll('.tile:not(.empty)');
        tiles.forEach(tile => {
            tile.addEventListener('mousedown', startDrag);
            tile.addEventListener('click', handleClick);
        });
    }

    // 点击移动
    function handleClick(e) {
        if (isBoardLocked) return;
        if (isDragging) return;

        const tile = e.currentTarget;
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
    function startDrag(e) {
        if (isBoardLocked) return;
        if (e.button !== 0) return;
        e.preventDefault();

        const tile = e.currentTarget;
        dragStartIndex = parseInt(tile.dataset.index);
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        isDragging = true;
        tile.classList.add('dragging');
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', endDrag);
    }
    function onDrag(e) {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            const tile = document.querySelector(`.tile[data-index="${dragStartIndex}"]`);
            if (tile) tile.style.transform = `translate(${dx}px, ${dy}px) scale(0.96)`;
        }
    }
    function endDrag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const startTile = document.querySelector(`.tile[data-index="${dragStartIndex}"]`);
        if (startTile) {
            startTile.style.transform = '';
            startTile.classList.remove('dragging');
        }

        const elementsAtCursor = document.elementsFromPoint(e.clientX, e.clientY);
        let targetTile = null;
        for (const el of elementsAtCursor) {
            if (el.classList && el.classList.contains('tile')) {
                targetTile = el;
                break;
            }
        }

        if (targetTile && !isBoardLocked) {
            const targetIndex = parseInt(targetTile.dataset.index);
            const emptyIdx = findEmptyIndex(currentBoard);
            if (targetIndex === emptyIdx) {
                performMove(dragStartIndex, emptyIdx);
            }
        }

        isDragging = false;
        dragStartIndex = -1;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', endDrag);
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

        updateDisplay();
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
                timerSeconds = 0;
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
            timerSeconds = 0;
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

        // 第一次进入：简单开局
        setNewBoard(generateInitialEasyBoard(BOARD_SIZE));

        // 提前初始化 Solver（减少首次点击求解延迟）
        SolverAPI.init().catch(console.warn);
    })();
})();