import shipsTemplate from "./ships.json";

const X_SIZE = 10;
const Y_SIZE = 10;
const TOTAL_CELLS = X_SIZE * Y_SIZE;

let gameState = {
  phase: "setup", // "setup", "playing", "finished";
  turn: "player", // "player", "bot"
  winner: null,
};

let ships = initializeShips();
let board = createBoard();
let botBoard = [];
let botShips = [];
let botState = {
  tried: new Set(),
  hits: [],
  queue: [],
  orientation: null,
  skipOnce: new Set(),
};

function initializeShips() {
  return structuredClone(shipsTemplate).map((s) => ({
    ...s,
    placed: false,
    coordinates: [],
    orientation: "horizontal",
  }));
}

function createBoard() {
  return Array.from({ length: TOTAL_CELLS }, (_, i) => ({
    id: i,
    x: i % X_SIZE,
    y: Math.floor(i / X_SIZE),
    hasShip: false,
    status: "empty",
  }));
}

function setBoard(newBoard) {
  board = newBoard;
}

function setShips(newShips) {
  ships = newShips;
}

function fullReset() {
  board = createBoard();
  ships = initializeShips();
  botBoard = [];
  botShips = [];
  botState = {
    tried: new Set(),
    hits: [],
    queue: [],
    orientation: null,
    skipOnce: new Set(),
  };
  gameState = { phase: "setup", turn: "player", winner: null };
  return { board, ships };
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getSurroundingCells(id) {
  const x = id % 10;
  const y = Math.floor(id / 10);
  const surrounding = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
        surrounding.push(ny * 10 + nx);
      }
    }
  }
  return surrounding;
}

function placeShipsRandomly() {
  let localBoard = createBoard();
  let localShips = initializeShips();
  let occupied = new Set();
  const MAX_ATTEMPTS = 1000;
  let shipIndex = 0;

  while (shipIndex < localShips.length) {
    const ship = localShips[shipIndex];
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < MAX_ATTEMPTS) {
      attempts++;
      const orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
      const startX =
        orientation === "horizontal"
          ? randomNumber(0, X_SIZE - ship.size)
          : randomNumber(0, X_SIZE - 1);
      const startY =
        orientation === "vertical"
          ? randomNumber(0, Y_SIZE - ship.size)
          : randomNumber(0, Y_SIZE - 1);
      const startId = startY * X_SIZE + startX;

      const newCoords = Array.from({ length: ship.size }, (_, i) =>
        orientation === "horizontal" ? startId + i : startId + i * X_SIZE,
      );

      if (newCoords.some((id) => occupied.has(id))) continue;

      ship.coordinates = newCoords;
      ship.orientation = orientation;
      ship.placed = true;

      newCoords.forEach((id) => {
        localBoard[id].hasShip = true;
        localBoard[id].status = "ship";
        getSurroundingCells(id).forEach((haloId) => occupied.add(haloId));
      });

      placed = true;
      shipIndex++;
    }

    if (!placed) {
      occupied.clear();
      shipIndex = 0;
      localShips = initializeShips();
      localBoard = createBoard();
    }
  }
  return { board: localBoard, ships: localShips };
}

function startGame() {
  const botData = placeShipsRandomly();
  botBoard = botData.board;
  botShips = botData.ships;
  gameState = { phase: "playing", turn: "player", winner: null };
  botState = {
    tried: new Set(),
    hits: [],
    queue: [],
    orientation: null,
    skipOnce: new Set(),
  };
  return gameState;
}

function registerHitOnShip(cellId, shipList) {
  const ship = shipList.find((s) => s.coordinates.includes(cellId));
  if (!ship) return null;
  ship.hitCount = (ship.hitCount || 0) + 1;
  if (ship.hitCount === ship.size) ship.sunk = true;
  return ship;
}

function botshootGap(missId) {
  neighbors(missId).forEach((item) => {
    botState.skipOnce.add(item);
  });
}

function playerShoot(cellId) {
  if (gameState.phase !== "playing" || gameState.turn !== "player") return null;

  const cell = botBoard.find((c) => c.id === cellId);
  if (!cell || cell.status === "hit" || cell.status === "miss") return null;

  let sunkShip = null;

  if (cell.hasShip) {
    cell.status = "hit";
    gameState.turn = "player";

    const ship = registerHitOnShip(cell.id, botShips);
    if (ship && ship.sunk) sunkShip = ship;

    if (checkWin(botShips)) {
      gameState.phase = "finished";
      gameState.winner = "player";
      return {
        updatedCell: cell,
        gameState,
        hit: true,
        sunkShip,
        gameFinished: true,
      };
    }

    return {
      updatedCell: cell,
      gameState,
      hit: true,
      sunkShip,
      gameFinished: false,
    };
  } else {
    cell.status = "miss";
    gameState.turn = "bot";

    return {
      updatedCell: cell,
      gameState,
      hit: false,
      sunkShip: null,
      gameFinished: false,
    };
  }
}

function bot() {
  let targetCell = null;

  while (botState.queue.length > 0) {
    const nextId = botState.queue.shift();
    if (!botState.tried.has(nextId)) {
      targetCell = board.find((c) => c.id === nextId);
      break;
    }
  }

  // if (!targetCell) {
  //   let availableCells = board.filter(
  //     (c) =>
  //       !botState.tried.has(c.id) &&
  //       (c.status === "empty" || c.status === "ship"),
  //   );

  //   if (botState.skipOnce.size > 0) {
  //     availableCells = availableCells.filter(
  //       (c) => !botState.skipOnce.has(c.id),
  //     );
  //   }

  //   targetCell = availableCells[randomNumber(0, availableCells.length - 1)];

  //   botState.skipOnce.clear();
  // }

  if (!targetCell) {
    targetCell = getSmartTargetCell();

    botState.skipOnce.clear();
  }

  return botShoot(targetCell);
}

function botShoot(targetCell) {
  if (!targetCell) return null;

  botState.tried.add(targetCell.id);
  let sunkShip = null;

  if (targetCell.hasShip) {
    targetCell.status = "hit";
    gameState.turn = "bot";
    botState.hits.push(targetCell.id);

    if (botState.hits.length >= 2) {
      const firstHit = botState.hits[0];
      botState.orientation =
        Math.floor(firstHit / X_SIZE) === Math.floor(targetCell.id / X_SIZE)
          ? "horizontal"
          : "vertical";

      botState.queue = botState.queue.filter((id) =>
        botState.orientation === "horizontal"
          ? Math.floor(id / X_SIZE) === Math.floor(firstHit / X_SIZE)
          : id % X_SIZE === firstHit % X_SIZE,
      );
    }

    const ship = registerHitOnShip(targetCell.id, ships);

    if (ship && ship.sunk) {
      sunkShip = ship;
      botState.queue = [];
      botState.hits = [];
      botState.orientation = null;

      ship.coordinates.forEach((id) => {
        getSurroundingCells(id).forEach((cellId) => botState.tried.add(cellId));
      });
    } else {
      let ns = neighbors(targetCell.id);
      if (botState.orientation === "horizontal")
        ns = ns.filter(
          (id) =>
            Math.floor(id / X_SIZE) === Math.floor(targetCell.id / X_SIZE),
        );
      else if (botState.orientation === "vertical")
        ns = ns.filter((id) => id % X_SIZE === targetCell.id % X_SIZE);

      ns.forEach((id) => {
        if (!botState.tried.has(id) && !botState.queue.includes(id))
          botState.queue.push(id);
      });
    }

    if (checkWin(ships)) {
      gameState.phase = "finished";
      gameState.winner = "bot";
      return {
        hit: true,
        miss: false,
        updatedCell: targetCell,
        sunkShip,
        gameFinished: true,
        gameState,
      };
    }

    gameState.turn = "player";
    return {
      hit: true,
      miss: false,
      updatedCell: targetCell,
      sunkShip,
      gameFinished: false,
      gameState,
    };
  }

  targetCell.status = "miss";

  botshootGap(targetCell.id);

  gameState.turn = "player";
  return {
    hit: false,
    miss: true,
    updatedCell: targetCell,
    gameFinished: false,
    gameState,
  };
}

function neighbors(id) {
  const x = id % X_SIZE;
  const y = Math.floor(id / X_SIZE);
  const finalIds = [];

  if (y > 0) finalIds.push((y - 1) * X_SIZE + x);
  if (x < X_SIZE - 1) finalIds.push(y * X_SIZE + (x + 1));
  if (y < Y_SIZE - 1) finalIds.push((y + 1) * X_SIZE + x);
  if (x > 0) finalIds.push(y * X_SIZE + (x - 1));

  return finalIds;
}

function checkWin(shipList) {
  return shipList.every((s) => s.sunk);
}

function getSmartTargetCell() {
  let densityMap = Array(TOTAL_CELLS).fill(0);
  let aliveShips = ships.filter((ship) => !ship.sunk);

  aliveShips.forEach((ship) => {
    let size = ship.size;

    for (let y = 0; y < Y_SIZE; y++) {
      for (let x = 0; x < X_SIZE; x++) {
        if (x + size <= X_SIZE) {
          let canPlaceH = true;
          let tempIdsH = [];

          for (let i = 0; i < size; i++) {
            let id = y * X_SIZE + (x + i);

            if (botState.tried.has(id)) {
              canPlaceH = false;
              break;
            }
            tempIdsH.push(id);
          }

          if (canPlaceH) {
            tempIdsH.forEach((id) => {
              densityMap[id]++;
            });
          }
        }

        if (y + size <= Y_SIZE) {
          let canPlaceV = true;
          let tempIdsV = [];

          for (let i = 0; i < size; i++) {
            let id = (y + i) * X_SIZE + x;

            if (botState.tried.has(id)) {
              canPlaceV = false;
              break;
            }
            tempIdsV.push(id);
          }

          if (canPlaceV) {
            tempIdsV.forEach((id) => {
              densityMap[id]++;
            });
          }
        }
      }
    }
  });

  for (let i = 0; i < TOTAL_CELLS; i++) {
    let x = i % X_SIZE;
    let y = Math.floor(i / X_SIZE);

    if ((x + y) % 2 !== 0) {
      densityMap[i] = 0;
    }
  }

  // let maxScore = -1;
  // let bestCellId = null;

  // for (let i = 0; i < TOTAL_CELLS; i++) {
  //   if (!botState.tried.has(i) && densityMap[i] > maxScore) {
  //     maxScore = densityMap[i];
  //     bestCellId = i;
  //   }
  // }

  // if (bestCellId === null) {
  //   let availableCells = board.filter((c) => !botState.tried.has(c.id));
  //   bestCellId =
  //     availableCells[Math.floor(Math.random() * availableCells.length)].id;
  // }

  let candidates = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (!botState.tried.has(i)) {
      candidates.push({ id: i, score: densityMap[i] });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const RANDOMIZE_LEVEL = 5;

  let topCandidates = candidates.slice(
    0,
    Math.min(RANDOMIZE_LEVEL, candidates.length),
  );

  let bestCellId = null;
  if (topCandidates.length > 0) {
    let randomIndex = Math.floor(Math.random() * topCandidates.length);
    bestCellId = topCandidates[randomIndex].id;
  }

  if (bestCellId === null) {
    let availableCells = board.filter((c) => !botState.tried.has(c.id));
    bestCellId =
      availableCells[Math.floor(Math.random() * availableCells.length)].id;
  }

  return board.find((c) => c.id === bestCellId);
}

export {
  placeShipsRandomly,
  playerShoot,
  bot,
  fullReset,
  startGame,
  setBoard,
  setShips,
};
