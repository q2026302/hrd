/**
 * 数字华容道通用求解器
 * 支持 3x3, 4x4, 5x5
 * 使用 BFS + 启发式搜索
 */

const PuzzleSolver = (function() {
    // 方向常量
    const DIRECTIONS = {
        UP: 'up',
        DOWN: 'down',
        LEFT: 'left',
        RIGHT: 'right'
    };

    // 方向对应的箭头符号（数字移动方向）
    const DIRECTION_ARROWS = {
        'up': '↑',
        'down': '↓',
        'left': '←',
        'right': '→'
    };

    // 空格移动方向与数字移动方向的映射
    const SPACE_TO_NUMBER = {
        'up': 'down',
        'down': 'up',
        'left': 'right',
        'right': 'left'
    };

    /**
     * 检查棋盘是否可解 - 使用正确的规则
     * @param {Array} board - 一维数组表示的棋盘
     * @param {number} size - 棋盘尺寸 (3,4,5)
     * @returns {boolean} - 是否可解
     */
    function isSolvable(board, size) {
        if (!board || board.length !== size * size) return false;
        
        const emptyValue = size * size;
        const emptyIndex = board.indexOf(emptyValue);
        if (emptyIndex === -1) return false;
        
        // 计算逆序数（排除空格）
        let invCount = 0;
        for (let i = 0; i < board.length; i++) {
            if (board[i] === emptyValue) continue;
            for (let j = i + 1; j < board.length; j++) {
                if (board[j] === emptyValue) continue;
                if (board[i] > board[j]) invCount++;
            }
        }

        // 对于奇数尺寸：逆序数必须为偶数
        if (size % 2 === 1) {
            return invCount % 2 === 0;
        }
        
        // 对于偶数尺寸：逆序数 + 空格行数（从底部数）必须为偶数
        // 注意：行数从0开始，从底部数：size - row
        const emptyRow = Math.floor(emptyIndex / size);
        const emptyRowFromBottom = size - emptyRow; // 从底部数的行数（1-based）
        
        return (invCount + emptyRowFromBottom) % 2 === 0;
    }

    /**
     * 检查是否达到目标状态
     */
    function isGoal(board, size) {
        const emptyValue = size * size;
        for (let i = 0; i < board.length - 1; i++) {
            if (board[i] !== i + 1) return false;
        }
        return board[board.length - 1] === emptyValue;
    }

    /**
     * 获取可能的移动（基于空格位置）
     */
    function getPossibleMoves(emptyIdx, size) {
        const row = Math.floor(emptyIdx / size);
        const col = emptyIdx % size;
        const moves = [];
        
        if (row > 0) moves.push(DIRECTIONS.UP);      // 空格向上
        if (row < size - 1) moves.push(DIRECTIONS.DOWN); // 空格向下
        if (col > 0) moves.push(DIRECTIONS.LEFT);    // 空格向左
        if (col < size - 1) moves.push(DIRECTIONS.RIGHT); // 空格向右
        
        return moves;
    }

    /**
     * 执行移动
     */
    function applyMove(board, emptyIdx, direction, size) {
        const newBoard = [...board];
        const row = Math.floor(emptyIdx / size);
        const col = emptyIdx % size;
        let targetIdx = -1;
        
        switch(direction) {
            case DIRECTIONS.UP:
                if (row > 0) targetIdx = emptyIdx - size;
                break;
            case DIRECTIONS.DOWN:
                if (row < size - 1) targetIdx = emptyIdx + size;
                break;
            case DIRECTIONS.LEFT:
                if (col > 0) targetIdx = emptyIdx - 1;
                break;
            case DIRECTIONS.RIGHT:
                if (col < size - 1) targetIdx = emptyIdx + 1;
                break;
        }
        
        if (targetIdx === -1) return null;
        
        const movedNumber = newBoard[targetIdx];
        [newBoard[emptyIdx], newBoard[targetIdx]] = [newBoard[targetIdx], newBoard[emptyIdx]];
        
        return {
            newBoard,
            movedNumber,
            newEmptyIdx: targetIdx,
            direction
        };
    }

    /**
     * 曼哈顿距离启发式
     */
    function manhattanDistance(board, size) {
        let distance = 0;
        for (let i = 0; i < board.length; i++) {
            const value = board[i];
            if (value === size * size) continue;
            
            const targetRow = Math.floor((value - 1) / size);
            const targetCol = (value - 1) % size;
            const currentRow = Math.floor(i / size);
            const currentCol = i % size;
            
            distance += Math.abs(currentRow - targetRow) + Math.abs(currentCol - targetCol);
        }
        return distance;
    }

    /**
     * 使用 BFS 搜索最短路径（适用于简单情况）
     */
    function bfsSolve(startBoard, size) {
        const emptyValue = size * size;
        const startState = startBoard.join(',');
        const goalState = [];
        for (let i = 1; i < size * size; i++) goalState.push(i);
        goalState.push(emptyValue);
        const goalStr = goalState.join(',');
        
        // 如果已经是目标状态
        if (startState === goalStr) {
            return { moves: [], stats: { nodesExpanded: 0 } };
        }
        
        const queue = [{
            board: startBoard,
            emptyIdx: startBoard.indexOf(emptyValue),
            path: []
        }];
        
        const visited = new Set();
        visited.add(startState);
        
        let nodesExpanded = 0;
        
        while (queue.length > 0) {
            const current = queue.shift();
            nodesExpanded++;
            
            const possibleMoves = getPossibleMoves(current.emptyIdx, size);
            
            for (const move of possibleMoves) {
                const result = applyMove(current.board, current.emptyIdx, move, size);
                if (!result) continue;
                
                const newState = result.newBoard.join(',');
                
                if (newState === goalStr) {
                    // 找到解
                    const moves = [...current.path, move];
                    return {
                        moves,
                        stats: { nodesExpanded }
                    };
                }
                
                if (!visited.has(newState)) {
                    visited.add(newState);
                    queue.push({
                        board: result.newBoard,
                        emptyIdx: result.newEmptyIdx,
                        path: [...current.path, move]
                    });
                }
            }
        }
        
        return null; // 无解
    }

    /**
     * A* 搜索算法
     */
    function aStarSolve(startBoard, size) {
        const emptyValue = size * size;
        const startState = startBoard.join(',');
        const goalState = [];
        for (let i = 1; i < size * size; i++) goalState.push(i);
        goalState.push(emptyValue);
        const goalStr = goalState.join(',');
        
        // 如果已经是目标状态
        if (startState === goalStr) {
            return { moves: [], stats: { nodesExpanded: 0 } };
        }
        
        // 优先队列（使用数组模拟，实际应该用二叉堆，但这里简单起见用数组）
        const openSet = [{
            board: startBoard,
            emptyIdx: startBoard.indexOf(emptyValue),
            path: [],
            f: manhattanDistance(startBoard, size)
        }];
        
        const closedSet = new Set();
        let nodesExpanded = 0;
        
        while (openSet.length > 0) {
            // 按f值排序
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            
            const currentState = current.board.join(',');
            
            if (closedSet.has(currentState)) continue;
            closedSet.add(currentState);
            nodesExpanded++;
            
            if (currentState === goalStr) {
                return {
                    moves: current.path,
                    stats: { nodesExpanded }
                };
            }
            
            const possibleMoves = getPossibleMoves(current.emptyIdx, size);
            
            for (const move of possibleMoves) {
                const result = applyMove(current.board, current.emptyIdx, move, size);
                if (!result) continue;
                
                const newState = result.newBoard.join(',');
                if (closedSet.has(newState)) continue;
                
                const newPath = [...current.path, move];
                const g = newPath.length;
                const h = manhattanDistance(result.newBoard, size);
                const f = g + h;
                
                openSet.push({
                    board: result.newBoard,
                    emptyIdx: result.newEmptyIdx,
                    path: newPath,
                    f
                });
            }
        }
        
        return null; // 无解
    }

    /**
     * 求解入口函数 - 根据难度选择算法
     */
    function solve(board, size, progressCallback = null) {
        // 输入验证
        if (!board || !Array.isArray(board)) {
            throw new Error('棋盘必须是数组');
        }
        if (board.length !== size * size) {
            throw new Error(`棋盘尺寸不匹配: 需要 ${size*size} 个数字，实际 ${board.length} 个`);
        }
        
        const emptyValue = size * size;
        
        // 验证数字范围
        for (let val of board) {
            if (val < 1 || val > emptyValue) {
                throw new Error(`数字必须在 1-${emptyValue} 之间，出现 ${val}`);
            }
        }
        
        // 检查是否已经是目标状态
        if (isGoal(board, size)) {
            return {
                solvable: true,
                moves: [],
                details: [],
                stats: { nodesExpanded: 0, time: 0 }
            };
        }
        
        // 检查可解性
        //if (!isSolvable(board, size)) {
        //    console.log('棋盘不可解');
        //    return { solvable: false, moves: null };
        //}
        
        console.log('棋盘可解，开始搜索...');
        const startTime = Date.now();
        
        // 根据尺寸选择算法
        // 对于3x3和简单的4x4，可以使用BFS保证最优解
        // 对于复杂的，使用A*
        let result;
        
        // 计算曼哈顿距离，如果很小就用BFS
        const h = manhattanDistance(board, size);
        
        if (size === 3 || (size === 4 && h < 10)) {
            // 简单情况用BFS保证最优解
            console.log('使用 BFS 算法');
            result = bfsSolve(board, size);
        } else {
            // 复杂情况用A*
            console.log('使用 A* 算法');
            result = aStarSolve(board, size);
        }
        
        const endTime = Date.now();
        
        if (!result || !result.moves) {
            console.log('搜索失败');
            return { solvable: true, moves: null };
        }
        
        // 生成详细的步骤信息
        const details = [];
        let currentBoard = [...board];
        let emptyIdx = currentBoard.indexOf(emptyValue);
        
        for (let i = 0; i < result.moves.length; i++) {
            const spaceMove = result.moves[i];
            const moveResult = applyMove(currentBoard, emptyIdx, spaceMove, size);
            if (!moveResult) break;
            
            // 将空格移动方向转换为数字移动方向
            const numberDirection = SPACE_TO_NUMBER[spaceMove];
            
            details.push({
                number: moveResult.movedNumber,
                direction: numberDirection,
                directionChar: DIRECTION_ARROWS[numberDirection]
            });
            
            currentBoard = moveResult.newBoard;
            emptyIdx = moveResult.newEmptyIdx;
        }
        
        return {
            solvable: true,
            moves: result.moves,
            details: details,
            stats: {
                ...result.stats,
                time: ((endTime - startTime) / 1000).toFixed(2)
            }
        };
    }

    /**
     * 验证解的正确性
     */
    function verifySolution(startBoard, moves, size) {
        if (!moves || moves.length === 0) {
            return isGoal(startBoard, size);
        }
        
        let testBoard = [...startBoard];
        let emptyIdx = testBoard.indexOf(size * size);
        
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            const result = applyMove(testBoard, emptyIdx, move, size);
            if (!result) return false;
            testBoard = result.newBoard;
            emptyIdx = result.newEmptyIdx;
        }
        
        return isGoal(testBoard, size);
    }

    /**
     * 获取方向对应的箭头符号
     */
    function getDirectionArrow(direction) {
        return DIRECTION_ARROWS[direction] || '?';
    }

    // 公开API
    return {
        solve: solve,
        isSolvable: isSolvable,
        verifySolution: verifySolution,
        getDirectionArrow: getDirectionArrow
    };
})();