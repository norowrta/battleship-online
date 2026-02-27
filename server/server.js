const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));

// const server = http.createServer(app);
// const io = new Server(server, { cors: { origin: "http://localhost:5173" } });

// server.listen(3000, () => {
//   console.log("Server listening on port http://localhost:3000");
// });

const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

server.listen(port, "0.0.0.0", () => {
  console.log("Server listening on port " + port);
});

let games = {};
let waitingRoom = null;
let playerRooms = {};
let onlinePlayers = 0;

function generateEmptyBoard() {
  return Array.from({ length: 100 }, (_, i) => ({
    id: i,
    status: "empty",
    hasShip: false,
  }));
}

function checkWin(board) {
  const shipCells = board.filter((cell) => cell.hasShip === true);
  return shipCells.every((cell) => cell.status === "hit");
}

function startTurnTimer(roomId) {
  const game = games[roomId];
  if (!game) return;
  if (game.timerId) clearTimeout(game.timerId);
  if (game.isFinished) return;

  game.timerId = setTimeout(() => {
    console.log(`Time is up for room ${roomId}! Turn skipped.`);
    game.turn = game.turn === "player1" ? "player2" : "player1";

    io.to(game.player1.id).emit("update_game", {
      myBoard: game.player1.board,
      enemyBoard: game.player2.board,
      turn: game[game.turn].id,
      winner: null,
      role: "player1",
      enemySunkShips: game.player2.sunkShips,
    });

    io.to(game.player2.id).emit("update_game", {
      myBoard: game.player2.board,
      enemyBoard: game.player1.board,
      turn: game[game.turn].id,
      winner: null,
      role: "player2",
      enemySunkShips: game.player1.sunkShips,
    });

    startTurnTimer(roomId);
  }, 15000);
}

io.on("connection", (socket) => {
  onlinePlayers += 1;
  io.emit("online_count", onlinePlayers);
  console.log(
    `New player connected: ${socket.id}, online players: ${onlinePlayers}`,
  );

  socket.on("request_online_count", () =>
    socket.emit("online_count", onlinePlayers),
  );

  socket.on("player_ready", (data) => {
    if (waitingRoom !== null) {
      socket.join(waitingRoom);
      games[waitingRoom].player2 = {
        id: socket.id,
        board: data.board,
        ships: data.shipsState,
        sunkShips: [],
      };
      playerRooms[socket.id] = waitingRoom;

      console.log(`Player ${socket.id} connected. The game begins!`);
      const game = games[waitingRoom];

      io.to(game.player1.id).emit("update_game", {
        myBoard: game.player1.board,
        enemyBoard: generateEmptyBoard(),
        turn: game[game.turn].id,
        winner: null,
        role: "player1",
        enemySunkShips: [],
      });
      io.to(game.player2.id).emit("update_game", {
        myBoard: game.player2.board,
        enemyBoard: generateEmptyBoard(),
        turn: game[game.turn].id,
        winner: null,
        role: "player2",
        enemySunkShips: [],
      });

      startTurnTimer(waitingRoom);
      waitingRoom = null;
    } else {
      const roomId = "room_" + socket.id;
      socket.join(roomId);

      games[roomId] = {
        player1: {
          id: socket.id,
          board: data.board,
          ships: data.shipsState,
          sunkShips: [],
        },
        player2: null,
        turn: "player1",
      };

      playerRooms[socket.id] = roomId;
      waitingRoom = roomId;
      console.log(
        `Player created room ${roomId} and is waiting for an opponent...`,
      );
    }
  });

  socket.on("shoot", (cellId) => {
    const roomId = playerRooms[socket.id];
    if (!roomId) return;
    const game = games[roomId];
    if (!game || !game.player1 || !game.player2) return;

    const isPlayer1 = socket.id === game.player1.id;
    const defender = isPlayer1 ? game.player2 : game.player1;
    const attackerRole = isPlayer1 ? "player1" : "player2";

    if (game.turn !== attackerRole) return;

    const targetCell = defender.board.find((c) => c.id === cellId);
    if (
      !targetCell ||
      (targetCell.status !== "empty" && targetCell.status !== "ship")
    )
      return;

    let winner = null;

    if (targetCell.hasShip) {
      targetCell.status = "hit";
      const hitShip = defender.ships.find((ship) =>
        ship.coordinates.includes(cellId),
      );

      if (hitShip) {
        const isSunk = hitShip.coordinates.every(
          (coordId) =>
            defender.board.find((c) => c.id === coordId)?.status === "hit",
        );
        if (isSunk && !defender.sunkShips.includes(hitShip.name))
          defender.sunkShips.push(hitShip.name);
      }

      if (checkWin(defender.board)) {
        winner = socket.id;
        game.isFinished = true;
      }
    } else {
      targetCell.status = "miss";
      game.turn = attackerRole === "player1" ? "player2" : "player1";
    }

    io.to(game.player1.id).emit("update_game", {
      myBoard: game.player1.board,
      enemyBoard: game.player2.board,
      turn: game[game.turn].id,
      winner,
      role: "player1",
      enemySunkShips: game.player2.sunkShips,
    });
    io.to(game.player2.id).emit("update_game", {
      myBoard: game.player2.board,
      enemyBoard: game.player1.board,
      turn: game[game.turn].id,
      winner,
      role: "player2",
      enemySunkShips: game.player1.sunkShips,
    });

    startTurnTimer(roomId);
  });

  socket.on("restart_game", () => {
    const roomId = playerRooms[socket.id];
    if (roomId) {
      if (currentGame && currentGame.timerId) {
        clearTimeout(currentGame.timerId);
      }

      delete games[roomId];
      io.in(roomId).socketsLeave(roomId);
    }
  });

  socket.on("disconnect", () => {
    onlinePlayers -= 1;
    io.emit("online_count", onlinePlayers);
    console.log(
      `Player disconnected: ${socket.id}, online players ${onlinePlayers}`,
    );

    const roomId = playerRooms[socket.id];
    if (roomId) {
      const currentGame = games[roomId];
      if (currentGame) {
        if (currentGame.timerId) clearTimeout(currentGame.timerId);

        let winnerId = null;
        let remainingPlayerRole = null;

        if (
          currentGame.player1 &&
          currentGame.player1.id === socket.id &&
          currentGame.player2
        ) {
          winnerId = currentGame.player2.id;
          remainingPlayerRole = "player2";
        } else if (
          currentGame.player2 &&
          currentGame.player2.id === socket.id &&
          currentGame.player1
        ) {
          winnerId = currentGame.player1.id;
          remainingPlayerRole = "player1";
        }

        if (winnerId) {
          if (!currentGame.isFinished) {
            console.log(
              `Player ${socket.id} disconnected. Player ${winnerId} wins by forfeit.`,
            );
            io.to(winnerId).emit("opponent_disconnected", {
              message: "Opponent disconnected. You win!",
              winner: winnerId,
            });
            io.to(winnerId).emit("update_game", {
              myBoard:
                remainingPlayerRole === "player1"
                  ? currentGame.player1.board
                  : currentGame.player2.board,
              enemyBoard:
                remainingPlayerRole === "player1"
                  ? currentGame.player2.board
                  : currentGame.player1.board,
              turn: currentGame[currentGame.turn].id,
              winner: winnerId,
              role: remainingPlayerRole,
              enemySunkShips:
                remainingPlayerRole === "player1"
                  ? currentGame.player2.sunkShips
                  : currentGame.player1.sunkShips,
              disconnectWin: true,
            });
          }
        } else if (waitingRoom === roomId) {
          waitingRoom = null;
        }

        delete games[roomId];
        delete playerRooms[socket.id];
        if (winnerId) {
          delete playerRooms[winnerId];
          io.in(roomId).socketsLeave(roomId);
        }
      }
    }
  });
});
