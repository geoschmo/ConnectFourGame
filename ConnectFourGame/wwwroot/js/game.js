const ROWS = 6;
const COLUMNS = 7;
const PLAYER_TOKEN_KEY_PREFIX = "connect-four-player-token:";

const boardElement = document.getElementById("board");
const columnControlsElement = document.getElementById("column-controls");
const statusTextElement = document.getElementById("status-text");
const hintTextElement = document.getElementById("hint-text");
const turnIndicatorElement = document.getElementById("turn-indicator");
const modeSelectElement = document.getElementById("mode-select");
const difficultyFieldElement = document.getElementById("difficulty-field");
const difficultySelectElement = document.getElementById("difficulty-select");
const newGameButton = document.getElementById("new-game-btn");
const leaveRoomButton = document.getElementById("leave-room-btn");
const remotePanelElement = document.getElementById("remote-panel");
const createRoomButton = document.getElementById("create-room-btn");
const joinRoomButton = document.getElementById("join-room-btn");
const copyInviteButton = document.getElementById("copy-invite-btn");
const roomCodeInputElement = document.getElementById("room-code-input");
const inviteShellElement = document.getElementById("invite-shell");
const roomCodeDisplayElement = document.getElementById("room-code-display");

let board = createEmptyBoard();
let winningCells = [];
let currentPlayer = "R";
let gameMode = "cpu";
let difficulty = window.connectFourConfig?.selectedDifficulty || "normal";
let gameOver = false;

let connection = null;
let signalRReady = false;
let remoteRoomCode = "";
let localPlayerColor = null;
let remoteState = null;
let remoteMessage = "";

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

            if (winningCells.some(([winningRow, winningCol]) => winningRow === row && winningCol === col)) {
                cell.classList.add("winning");
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
        button.disabled = isColumnDisabled(col);
        button.addEventListener("click", () => handleMove(col));
        columnControlsElement.appendChild(button);
    }
}

function isColumnDisabled(col) {
    if (gameOver || isColumnFull(col)) {
        return true;
    }

    if (gameMode !== "remote") {
        return false;
    }

    return !canRemotePlayerMove();
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
    if (gameMode === "remote") {
        void remoteMove(col);
        return;
    }

    if (gameOver || isColumnFull(col)) {
        return;
    }

    const row = placeDisc(col, currentPlayer);
    if (row === null) {
        return;
    }

    finalizeLocalTurn(row, col, currentPlayer);
}

function finalizeLocalTurn(row, col, player) {
    winningCells = getWinningCells(board, row, col, player);
    if (winningCells.length > 0) {
        gameOver = true;
        updateStatus();
        renderBoard();
        renderColumnControls();
        return;
    }

    if (isBoardFull(board)) {
        gameOver = true;
        updateStatus();
        renderBoard();
        renderColumnControls();
        return;
    }

    currentPlayer = player === "R" ? "Y" : "R";
    updateStatus();
    renderBoard();
    renderColumnControls();

    if (gameMode === "cpu" && currentPlayer === "Y" && !gameOver) {
        hintTextElement.textContent = cpuHintText();
        window.setTimeout(cpuMove, 360);
    }
}

function updateStatus() {
    const isRedTurn = currentPlayer === "R";
    turnIndicatorElement.textContent = gameOver ? "Game over" : `${isRedTurn ? "Red" : "Yellow"} to move`;
    turnIndicatorElement.className = `turn-indicator ${gameOver ? "" : (isRedTurn ? "red" : "yellow")}`.trim();

    if (gameMode === "local") {
        updateLocalStatus();
        return;
    }

    if (gameMode === "cpu") {
        updateCpuStatus();
        return;
    }

    updateRemoteStatus();
}

function updateLocalStatus() {
    if (gameOver) {
        if (winningCells.length > 0) {
            statusTextElement.textContent = currentPlayer === "R" ? "Red wins." : "Yellow wins.";
            hintTextElement.textContent = "Start another round to keep the match going.";
            return;
        }

        statusTextElement.textContent = "Draw game.";
        hintTextElement.textContent = "The board filled before either side could connect four.";
        return;
    }

    statusTextElement.textContent = currentPlayer === "R" ? "Red player's turn." : "Yellow player's turn.";
    hintTextElement.textContent = "Take turns dropping a disc into any open column.";
}

function updateCpuStatus() {
    if (gameOver) {
        if (winningCells.length > 0) {
            statusTextElement.textContent = currentPlayer === "R" ? "You win." : "Computer wins.";
            hintTextElement.textContent = currentPlayer === "R"
                ? "Start another round to keep the match going."
                : "Look for earlier blocks on the next round.";
            return;
        }

        statusTextElement.textContent = "Draw game.";
        hintTextElement.textContent = "The board filled before either side could connect four.";
        return;
    }

    if (currentPlayer === "R") {
        statusTextElement.textContent = "Your turn. Pick a column.";
        hintTextElement.textContent = "Try to build threats in multiple directions at once.";
    } else {
        statusTextElement.textContent = "Computer thinking...";
        hintTextElement.textContent = cpuHintText();
    }
}

function updateRemoteStatus() {
    if (!signalRReady) {
        statusTextElement.textContent = "Connecting to multiplayer service...";
        hintTextElement.textContent = "Create a room or open an invite link once the connection is ready.";
        return;
    }

    if (!remoteRoomCode) {
        statusTextElement.textContent = "Create a room or join a room code.";
        hintTextElement.textContent = "Invite links use the same `?room=` flow as Battleship.";
        return;
    }

    if (remoteMessage) {
        hintTextElement.textContent = remoteMessage;
    }

    const colorName = localPlayerColor === "R" ? "Red" : localPlayerColor === "Y" ? "Yellow" : "Spectator";
    const roomState = remoteState;

    if (!roomState?.hasTwoPlayers) {
        statusTextElement.textContent = "Waiting for opponent to join...";
        hintTextElement.textContent = `Room ${remoteRoomCode}. You are ${colorName}. Share the invite link.`;
        return;
    }

    if (gameOver) {
        if (roomState?.winner === "R" || roomState?.winner === "Y") {
            const winnerName = roomState.winner === "R" ? "Red" : "Yellow";
            statusTextElement.textContent = roomState.winner === localPlayerColor ? "You win." : `${winnerName} wins.`;
            hintTextElement.textContent = "Use New Game to reset this room for another round.";
            return;
        }

        statusTextElement.textContent = "Draw game.";
        hintTextElement.textContent = "Use New Game to reset this room for another round.";
        return;
    }

    if (!localPlayerColor) {
        statusTextElement.textContent = `${currentPlayer === "R" ? "Red" : "Yellow"} to move.`;
        hintTextElement.textContent = `Room ${remoteRoomCode}.`;
        return;
    }

    if (currentPlayer === localPlayerColor) {
        statusTextElement.textContent = "Your turn. Pick a column.";
        hintTextElement.textContent = `Room ${remoteRoomCode}. You are ${colorName}.`;
    } else {
        statusTextElement.textContent = "Opponent's turn.";
        hintTextElement.textContent = `Room ${remoteRoomCode}. You are ${colorName}.`;
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

    finalizeLocalTurn(row, col, "Y");
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

function startLocalGame() {
    board = createEmptyBoard();
    winningCells = [];
    currentPlayer = "R";
    gameOver = false;
    difficulty = difficultySelectElement.value;
    remoteMessage = "";
    renderBoard();
    renderColumnControls();
    updateStatus();
}

function updateModeUI() {
    const isRemote = gameMode === "remote";
    const isCpu = gameMode === "cpu";

    remotePanelElement.classList.toggle("hidden", !isRemote);
    difficultyFieldElement.classList.toggle("hidden", !isCpu);
    leaveRoomButton.classList.toggle("hidden", !isRemote || !remoteRoomCode);
    inviteShellElement.classList.toggle("hidden", !remoteRoomCode);
}

async function ensureSignalRConnection() {
    if (connection && signalRReady) {
        return;
    }

    if (!window.signalR) {
        remoteMessage = "SignalR failed to load.";
        updateStatus();
        return;
    }

    if (!connection) {
        connection = new signalR.HubConnectionBuilder()
            .withUrl(window.connectFourConfig.gameHubUrl)
            .withAutomaticReconnect()
            .build();

        connection.on("GameStateUpdated", (state) => {
            applyRemoteState(state);
        });

        connection.onreconnecting(() => {
            signalRReady = false;
            remoteMessage = "Connection lost. Reconnecting...";
            renderColumnControls();
            updateStatus();
        });

        connection.onreconnected(async () => {
            signalRReady = true;
            remoteMessage = "Reconnected.";
            if (remoteRoomCode) {
                await joinRoom(remoteRoomCode, true);
            }
            updateStatus();
        });

        connection.onclose(() => {
            signalRReady = false;
            renderColumnControls();
            updateStatus();
        });
    }

    if (connection.state === "Connected") {
        signalRReady = true;
        return;
    }

    await connection.start();
    signalRReady = true;
}

async function disconnectRemoteConnection() {
    if (!connection || connection.state === "Disconnected") {
        signalRReady = false;
        return;
    }

    await connection.stop();
    signalRReady = false;
}

function applyRemoteState(state) {
    remoteState = state;
    board = state.board ?? createEmptyBoard();
    currentPlayer = state.currentPlayer ?? "R";
    gameOver = Boolean(state.gameOver);
    winningCells = Array.isArray(state.winningCells) ? state.winningCells : [];
    remoteRoomCode = state.roomCode ?? remoteRoomCode;
    roomCodeDisplayElement.textContent = remoteRoomCode || "------";
    updateModeUI();
    renderBoard();
    renderColumnControls();
    updateStatus();
}

function canRemotePlayerMove() {
    return Boolean(
        signalRReady
        && remoteRoomCode
        && remoteState?.hasTwoPlayers
        && !gameOver
        && localPlayerColor
        && currentPlayer === localPlayerColor
    );
}

function getStoredToken(roomCode) {
    return window.localStorage.getItem(`${PLAYER_TOKEN_KEY_PREFIX}${roomCode}`);
}

function setStoredToken(roomCode, token) {
    window.localStorage.setItem(`${PLAYER_TOKEN_KEY_PREFIX}${roomCode}`, token);
}

async function createRoom() {
    gameMode = "remote";
    modeSelectElement.value = "remote";
    updateModeUI();
    await ensureSignalRConnection();
    if (!signalRReady) {
        return;
    }

    const result = await connection.invoke("CreateRoom");
    if (!result.success) {
        remoteMessage = result.message || "Unable to create room.";
        updateStatus();
        return;
    }

    remoteRoomCode = result.roomCode;
    localPlayerColor = result.playerColor;
    setStoredToken(result.roomCode, result.playerToken);
    history.replaceState(null, "", `${window.location.pathname}?room=${result.roomCode}`);
    remoteMessage = "";
    roomCodeInputElement.value = result.roomCode;
    applyRemoteState(result.state);
}

async function joinRoom(roomCode, isReconnect = false) {
    const normalizedRoomCode = roomCode.trim().toUpperCase();
    if (!normalizedRoomCode || normalizedRoomCode.length !== 6) {
        remoteMessage = "Please enter a valid 6-character room code.";
        updateStatus();
        return;
    }

    gameMode = "remote";
    modeSelectElement.value = "remote";
    updateModeUI();
    await ensureSignalRConnection();
    if (!signalRReady) {
        return;
    }

    const playerToken = getStoredToken(normalizedRoomCode);
    const result = await connection.invoke("JoinRoom", normalizedRoomCode, playerToken);

    if (!result.success) {
        if (!isReconnect) {
            remoteMessage = result.message || "Unable to join room.";
            updateStatus();
        }
        return;
    }

    remoteRoomCode = result.roomCode;
    localPlayerColor = result.playerColor;
    setStoredToken(result.roomCode, result.playerToken);
    history.replaceState(null, "", `${window.location.pathname}?room=${result.roomCode}`);
    roomCodeInputElement.value = result.roomCode;
    remoteMessage = "";
    applyRemoteState(result.state);
}

async function remoteMove(column) {
    if (!canRemotePlayerMove()) {
        return;
    }

    const result = await connection.invoke("DropDisc", column);
    if (!result.success) {
        remoteMessage = result.message || "Move rejected.";
        updateStatus();
    }
}

async function restartRemoteGame() {
    if (!remoteRoomCode) {
        return;
    }

    await ensureSignalRConnection();
    if (!signalRReady) {
        return;
    }

    const result = await connection.invoke("RestartGame");
    if (!result.success) {
        remoteMessage = result.message || "Unable to restart the room.";
        updateStatus();
    }
}

async function leaveRemoteRoom() {
    await disconnectRemoteConnection();
    remoteRoomCode = "";
    localPlayerColor = null;
    remoteState = null;
    remoteMessage = "";
    board = createEmptyBoard();
    winningCells = [];
    currentPlayer = "R";
    gameOver = false;
    history.replaceState(null, "", window.location.pathname);
    updateModeUI();
    renderBoard();
    renderColumnControls();
    updateStatus();
}

function buildInviteUrl(roomCode) {
    return `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
}

async function copyInviteLink() {
    if (!remoteRoomCode) {
        return;
    }

    const inviteUrl = buildInviteUrl(remoteRoomCode);

    try {
        await navigator.clipboard.writeText(inviteUrl);
        remoteMessage = "Invite link copied.";
    } catch {
        remoteMessage = `Copy failed. Share this link: ${inviteUrl}`;
    }

    updateStatus();
}

async function handleModeChange() {
    gameMode = modeSelectElement.value;
    updateModeUI();

    if (gameMode === "remote") {
        await ensureSignalRConnection();
        if (window.connectFourConfig?.inviteRoomCode && !remoteRoomCode) {
            roomCodeInputElement.value = window.connectFourConfig.inviteRoomCode.toUpperCase();
            await joinRoom(window.connectFourConfig.inviteRoomCode);
        } else {
            updateStatus();
            renderColumnControls();
        }
        return;
    }

    await leaveRemoteRoom();
    startLocalGame();
}

async function handleNewGame() {
    if (gameMode === "remote") {
        await restartRemoteGame();
        return;
    }

    startLocalGame();
}

newGameButton.addEventListener("click", () => {
    void handleNewGame();
});
leaveRoomButton.addEventListener("click", () => {
    void leaveRemoteRoom();
});
modeSelectElement.addEventListener("change", () => {
    void handleModeChange();
});
difficultySelectElement.addEventListener("change", () => {
    if (gameMode === "cpu") {
        startLocalGame();
    }
});
createRoomButton.addEventListener("click", () => {
    void createRoom();
});
joinRoomButton.addEventListener("click", () => {
    void joinRoom(roomCodeInputElement.value);
});
copyInviteButton.addEventListener("click", () => {
    void copyInviteLink();
});
roomCodeInputElement.addEventListener("input", () => {
    roomCodeInputElement.value = roomCodeInputElement.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
});

renderBoard();
renderColumnControls();

if (window.connectFourConfig?.inviteRoomCode) {
    modeSelectElement.value = "remote";
    gameMode = "remote";
    updateModeUI();
    roomCodeInputElement.value = window.connectFourConfig.inviteRoomCode.toUpperCase();
    void handleModeChange();
} else {
    updateModeUI();
    startLocalGame();
}
