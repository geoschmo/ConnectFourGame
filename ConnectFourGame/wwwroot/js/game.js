const ROWS = 6;
const COLUMNS = 7;
const SCORE_KEY = "connect-four-score";

const boardElement = document.getElementById("board");
const columnControlsElement = document.getElementById("column-controls");
const statusTextElement = document.getElementById("status-text");
const hintTextElement = document.getElementById("hint-text");
const turnIndicatorElement = document.getElementById("turn-indicator");
const modeSelectElement = document.getElementById("mode-select");
const difficultySelectElement = document.getElementById("difficulty-select");
const newGameButton = document.getElementById("new-game-btn");
const resetScoreButton = document.getElementById("reset-score-btn");
const scoreRedElement = document.getElementById("score-red");
const scoreDrawElement = document.getElementById("score-draw");
const scoreYellowElement = document.getElementById("score-yellow");

let board = [];
let currentPlayer = "R";
let gameMode = "cpu";
let difficulty = window.connectFourConfig?.selectedDifficulty || "normal";
let gameOver = false;
let scores = loadScores();

difficultySelectElement.value = difficulty;

function createEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
}

function renderBoard() {
    boardElement.innerHTML = "";
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLUMNS; col++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.setAttribute("role", "gridcell");
            cell.dataset.row = String(row);
            cell.dataset.col = String(col);

            const disc = document.createElement("div");
            disc.classList.add("disc");

            const value = board[row][col];
            if (value) {
                cell.classList.add("filled");
                disc.classList.add(value === "R" ? "red" : "yellow");
            }

            cell.appendChild(disc);
            boardElement.appendChild(cell);
        }
    }
}

function renderColumnControls() {
    columnControlsElement.innerHTML = "";
    for (let col = 0; col < COLUMNS; col++) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "column-btn";
        button.textContent = String(col + 1);
        button.disabled = isColumnFull(col) || gameOver;
        button.addEventListener("click", () => handleMove(col));
        columnControlsElement.appendChild(button);
    }
}

function updateScoreboard() {
    scoreRedElement.textContent = String(scores.red);
    scoreDrawElement.textContent = String(scores.draw);
    scoreYellowElement.textContent = String(scores.yellow);
}

function loadScores() {
    try {
        const stored = localStorage.getItem(SCORE_KEY);
        if (!stored) {
            return { red: 0, yellow: 0, draw: 0 };
        }

        const parsed = JSON.parse(stored);
        return {
            red: Number(parsed.red) || 0,
            yellow: Number(parsed.yellow) || 0,
            draw: Number(parsed.draw) || 0
        };
    } catch {
        return { red: 0, yellow: 0, draw: 0 };
    }
}

function saveScores() {
    try {
        localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
    } catch {
        // Ignore storage errors.
    }
}

function resetScores() {
    scores = { red: 0, yellow: 0, draw: 0 };
    saveScores();
    updateScoreboard();
}

function isColumnFull(col) {
    return board[0][col] !== null;
}

function getAvailableRow(col) {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (!board[row][col]) {
            return row;
        }
    }

    return -1;
}

function placeDisc(col, player) {
    const row = getAvailableRow(col);
    if (row === -1) {
        return null;
    }

    board[row][col] = player;
    return row;
}

function handleMove(col) {
    if (gameOver || isColumnFull(col)) {
        return;
    }

    const row = placeDisc(col, currentPlayer);
    if (row === null) {
        return;
    }

    finalizeTurn(row, col, currentPlayer);
}

function finalizeTurn(row, col, player) {
    renderBoard();

    const winnerCells = getWinningCells(board, row, col, player);
    if (winnerCells.length > 0) {
        markWinningCells(winnerCells);
        endGame(player);
        return;
    }

    if (isBoardFull(board)) {
        endGame(null);
        return;
    }

    currentPlayer = player === "R" ? "Y" : "R";
    updateStatus();
    renderColumnControls();

    if (gameMode === "cpu" && currentPlayer === "Y" && !gameOver) {
        hintTextElement.textContent = cpuHintText();
        window.setTimeout(cpuMove, 360);
    }
}

function updateStatus() {
    const isRedTurn = currentPlayer === "R";
    turnIndicatorElement.textContent = `${isRedTurn ? "Red" : "Yellow"} to move`;
    turnIndicatorElement.className = `turn-indicator ${isRedTurn ? "red" : "yellow"}`;

    if (gameMode === "local") {
        statusTextElement.textContent = `${isRedTurn ? "Red" : "Yellow"} player's turn.`;
        hintTextElement.textContent = "Take turns dropping a disc into any open column.";
        return;
    }

    if (isRedTurn) {
        statusTextElement.textContent = "Your turn. Pick a column.";
        hintTextElement.textContent = "Try to build threats in multiple directions at once.";
    } else {
        statusTextElement.textContent = "Computer thinking...";
    }
}

function endGame(winner) {
    gameOver = true;
    renderColumnControls();

    if (winner === "R") {
        scores.red += 1;
        saveScores();
        updateScoreboard();
        statusTextElement.textContent = gameMode === "cpu" ? "You win." : "Red wins.";
        hintTextElement.textContent = "Start another round to keep the match going.";
        turnIndicatorElement.textContent = "Game over";
        turnIndicatorElement.className = "turn-indicator red";
        return;
    }

    if (winner === "Y") {
        scores.yellow += 1;
        saveScores();
        updateScoreboard();
        statusTextElement.textContent = gameMode === "cpu" ? "Computer wins." : "Yellow wins.";
        hintTextElement.textContent = "Look for earlier blocks on the next round.";
        turnIndicatorElement.textContent = "Game over";
        turnIndicatorElement.className = "turn-indicator yellow";
        return;
    }

    scores.draw += 1;
    saveScores();
    updateScoreboard();
    statusTextElement.textContent = "Draw game.";
    hintTextElement.textContent = "The board filled before either side could connect four.";
    turnIndicatorElement.textContent = "Game over";
    turnIndicatorElement.className = "turn-indicator";
}

function markWinningCells(cells) {
    for (const [row, col] of cells) {
        const index = row * COLUMNS + col;
        const cell = boardElement.children[index];
        if (cell) {
            cell.classList.add("winning");
        }
    }
}

function isBoardFull(state) {
    return state[0].every((cell) => cell !== null);
}

function getWinningCells(state, row, col, player) {
    const directions = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1]
    ];

    for (const [rowStep, colStep] of directions) {
        const cells = [[row, col]];
        cells.push(...collectDirection(state, row, col, rowStep, colStep, player));
        cells.unshift(...collectDirection(state, row, col, -rowStep, -colStep, player));

        if (cells.length >= 4) {
            return cells.slice(0, 4);
        }
    }

    return [];
}

function collectDirection(state, startRow, startCol, rowStep, colStep, player) {
    const cells = [];
    let row = startRow + rowStep;
    let col = startCol + colStep;

    while (row >= 0 && row < ROWS && col >= 0 && col < COLUMNS && state[row][col] === player) {
        cells.push([row, col]);
        row += rowStep;
        col += colStep;
    }

    return cells;
}

function cloneBoard(state) {
    return state.map((row) => [...row]);
}

function getValidColumns(state) {
    return Array.from({ length: COLUMNS }, (_, col) => col).filter((col) => state[0][col] === null);
}

function findWinningMove(state, player) {
    for (const col of getValidColumns(state)) {
        const trialBoard = cloneBoard(state);
        const row = simulatePlace(trialBoard, col, player);
        if (row !== -1 && getWinningCells(trialBoard, row, col, player).length > 0) {
            return col;
        }
    }

    return null;
}

function simulatePlace(state, col, player) {
    for (let row = ROWS - 1; row >= 0; row--) {
        if (state[row][col] === null) {
            state[row][col] = player;
            return row;
        }
    }

    return -1;
}

function scoreColumnPreference(col) {
    return 3 - Math.abs(3 - col);
}

function cpuMove() {
    const col = chooseCpuColumn();
    const row = placeDisc(col, "Y");
    if (row === null) {
        return;
    }

    finalizeTurn(row, col, "Y");
}

function chooseCpuColumn() {
    const validColumns = getValidColumns(board);
    const winningMove = findWinningMove(board, "Y");
    if (winningMove !== null) {
        return winningMove;
    }

    const blockingMove = findWinningMove(board, "R");
    if (blockingMove !== null && difficulty !== "easy") {
        return blockingMove;
    }

    if (difficulty === "easy") {
        return validColumns[Math.floor(Math.random() * validColumns.length)];
    }

    if (difficulty === "normal") {
        const weighted = [...validColumns].sort((a, b) => scoreColumnPreference(a) - scoreColumnPreference(b));
        return weighted[weighted.length - 1];
    }

    let bestScore = Number.NEGATIVE_INFINITY;
    let bestColumn = validColumns[0];

    for (const col of validColumns) {
        const score = scoreMoveForHardMode(board, col);
        if (score > bestScore) {
            bestScore = score;
            bestColumn = col;
        }
    }

    return bestColumn;
}

function scoreMoveForHardMode(state, col) {
    const trialBoard = cloneBoard(state);
    const row = simulatePlace(trialBoard, col, "Y");
    if (row === -1) {
        return Number.NEGATIVE_INFINITY;
    }

    let score = scoreColumnPreference(col) * 4;

    for (const candidate of getValidColumns(trialBoard)) {
        const replyBoard = cloneBoard(trialBoard);
        const replyRow = simulatePlace(replyBoard, candidate, "R");
        if (replyRow !== -1 && getWinningCells(replyBoard, replyRow, candidate, "R").length > 0) {
            score -= 100;
        }
    }

    score += countPotentialLines(trialBoard, "Y") * 3;
    score -= countPotentialLines(trialBoard, "R") * 2;

    return score;
}

function countPotentialLines(state, player) {
    const directions = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1]
    ];

    let total = 0;

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLUMNS; col++) {
            for (const [rowStep, colStep] of directions) {
                const cells = [];
                for (let i = 0; i < 4; i++) {
                    const nextRow = row + rowStep * i;
                    const nextCol = col + colStep * i;
                    if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLUMNS) {
                        cells.length = 0;
                        break;
                    }

                    cells.push(state[nextRow][nextCol]);
                }

                if (cells.length === 4 && cells.every((value) => value === null || value === player)) {
                    total += cells.filter((value) => value === player).length;
                }
            }
        }
    }

    return total;
}

function cpuHintText() {
    if (difficulty === "easy") {
        return "Easy mode mostly reacts and leaves openings.";
    }

    if (difficulty === "hard") {
        return "Hard mode values center control and avoids obvious traps.";
    }

    return "Normal mode blocks direct threats and prefers strong columns.";
}

function startNewGame() {
    board = createEmptyBoard();
    currentPlayer = "R";
    gameOver = false;
    gameMode = modeSelectElement.value;
    difficulty = difficultySelectElement.value;
    renderBoard();
    renderColumnControls();
    updateStatus();
}

newGameButton.addEventListener("click", startNewGame);
resetScoreButton.addEventListener("click", resetScores);
modeSelectElement.addEventListener("change", startNewGame);
difficultySelectElement.addEventListener("change", startNewGame);

updateScoreboard();
startNewGame();
