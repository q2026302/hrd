/**
 * 数字华容道求解器测试套件
 */

const SolverTester = (function() {
    /**
     * 格式化棋盘
     */
    function formatBoard(board, size) {
        if (!board) return '无效棋盘';
        let result = '\n';
        for (let i = 0; i < size; i++) {
            result += '  ';
            for (let j = 0; j < size; j++) {
                const val = board[i * size + j];
                if (val === size * size) {
                    result += ' 空 ';
                } else {
                    result += val.toString().padStart(2, ' ') + ' ';
                }
            }
            result += '\n';
        }
        return result;
    }

    /**
     * 生成测试用例
     */
    function generateTestCases() {
        return [
            // 3x3 测试用例
            {
                name: '3x3 - 目标状态',
                size: 3,
                board: [1, 2, 3, 4, 5, 6, 7, 8, 9],
                expectedSolvable: true,
                description: '已完成状态'
            },
            {
                name: '3x3 - 一步可解',
                size: 3,
                board: [1, 2, 3, 4, 5, 6, 7, 9, 8],
                expectedSolvable: true,
                description: '只需移动数字8'
            },
            {
                name: '3x3 - 简单乱序',
                size: 3,
                board: [1, 2, 3, 4, 5, 6, 9, 7, 8],
                expectedSolvable: true,
                description: '简单情况'
            },
            {
                name: '3x3 - 中等难度',
                size: 3,
                board: [2, 3, 6, 1, 5, 9, 4, 7, 8],
                expectedSolvable: true,
                description: '需要多步移动'
            },
            {
                name: '3x3 - 困难开局',
                size: 3,
                board: [8, 6, 7, 2, 5, 4, 3, 9, 1],
                expectedSolvable: true,
                description: '困难开局'
            },
            {
                name: '3x3 - 无解情况',
                size: 3,
                board: [1, 2, 3, 4, 5, 6, 8, 7, 9],
                expectedSolvable: false,
                description: '经典无解'
            },
            
            // 4x4 测试用例
            {
                name: '4x4 - 目标状态',
                size: 4,
                board: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
                expectedSolvable: true,
                description: '已完成状态'
            },
            {
                name: '4x4 - 一步可解',
                size: 4,
                board: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 15],
                expectedSolvable: true,
                description: '只需移动数字15'
            },
            {
                name: '4x4 - 简单乱序',
                size: 4,
                board: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 14, 15],
                expectedSolvable: true,
                description: '简单情况'
            },
            
            // 5x5 测试用例
            {
                name: '5x5 - 目标状态',
                size: 5,
                board: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
                expectedSolvable: true,
                description: '已完成状态'
            },
            {
                name: '5x5 - 一步可解',
                size: 5,
                board: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 24],
                expectedSolvable: true,
                description: '只需移动数字24'
            }
        ];
    }

    /**
     * 运行单个测试用例
     */
    async function runTestCase(testCase) {
        return new Promise((resolve) => {
            const { name, board, size, expectedSolvable } = testCase;
            
            try {
                // 测试可解性判断
                const solvable = PuzzleSolver.isSolvable(board, size);
                
                if (expectedSolvable !== undefined && solvable !== expectedSolvable) {
                    resolve({
                        ...testCase,
                        passed: false,
                        error: `可解性判断错误: 预期 ${expectedSolvable}, 实际 ${solvable}`
                    });
                    return;
                }
                
                if (!solvable) {
                    resolve({
                        ...testCase,
                        passed: true,
                        solvable: false,
                        time: 0
                    });
                    return;
                }
                
                // 执行求解
                const startTime = performance.now();
                const result = PuzzleSolver.solve(board, size);
                const endTime = performance.now();
                
                if (!result || !result.moves) {
                    resolve({
                        ...testCase,
                        passed: false,
                        error: '求解失败',
                        time: (endTime - startTime).toFixed(2)
                    });
                    return;
                }
                
                // 验证解的正确性
                const isValid = PuzzleSolver.verifySolution(board, result.moves, size);
                
                if (!isValid) {
                    resolve({
                        ...testCase,
                        passed: false,
                        error: '解验证失败',
                        time: (endTime - startTime).toFixed(2)
                    });
                    return;
                }
                
                resolve({
                    ...testCase,
                    passed: true,
                    solvable: true,
                    moves: result.moves,
                    steps: result.moves.length,
                    time: (endTime - startTime).toFixed(2)
                });
                
            } catch (error) {
                resolve({
                    ...testCase,
                    passed: false,
                    error: error.message
                });
            }
        });
    }

    /**
     * 运行所有测试（带UI回调）
     */
    async function runAllTestsWithUI(callbacks = {}) {
        const testCases = generateTestCases();
        const results = [];
        let passed = 0, failed = 0;
        
        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            
            if (callbacks.onTestStart) {
                callbacks.onTestStart(i + 1, testCases.length, testCase.name);
            }
            
            const result = await runTestCase(testCase);
            results.push(result);
            
            if (result.passed) {
                passed++;
            } else {
                failed++;
            }
            
            if (callbacks.onTestComplete) {
                callbacks.onTestComplete(result);
            }
            
            // 小延迟避免阻塞
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        if (callbacks.onAllComplete) {
            callbacks.onAllComplete({
                passed,
                failed,
                total: testCases.length
            });
        }
        
        return results;
    }

    /**
     * 按尺寸运行测试
     */
    async function runTestsBySize(size, callbacks = {}) {
        const testCases = generateTestCases().filter(tc => tc.size === size);
        const results = [];
        
        for (const testCase of testCases) {
            const result = await runTestCase(testCase);
            results.push(result);
            
            if (callbacks.onTestComplete) {
                callbacks.onTestComplete(result);
            }
        }
        
        return results;
    }

    return {
        formatBoard,
        generateTestCases,
        runTestCase,
        runAllTestsWithUI,
        runTestsBySize
    };
})();