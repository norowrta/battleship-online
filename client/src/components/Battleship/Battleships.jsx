import { useState, useEffect } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import DraggableShip from "./DraggableShip.jsx";
import DroppableCell from "./DroppableCell.jsx";
import Icon from "../Icon";
import css from "./battleships.module.css";
import "animate.css";
import shipsTemplate from "./ships.json";
import {
  playerShoot,
  bot,
  fullReset,
  startGame,
  setBoard as setBotBoard,
  setShips as setBotShips,
} from "./bot.js";
import { socket } from "../../socket.js";

const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

import shipPlacement from "../../assets/ship-placement.svg";

function calculateCoordinates(startId, size, orientation) {
  return Array.from({ length: size }, (_, i) =>
    orientation === "horizontal" ? startId + i : startId + i * 10,
  );
}

function generateEmptyBoard() {
  return Array.from({ length: 100 }, (_, i) => ({
    id: i,
    status: "empty",
    hasShip: false,
  }));
}

export default function Battleship({ setWin, setLose }) {
  const [board, setBoard] = useState(generateEmptyBoard);
  const [oppBoard, setOppBoard] = useState(generateEmptyBoard);
  const [shipsState, setShipsState] = useState(() =>
    structuredClone(shipsTemplate),
  );
  const [destroyedShips, setDestroyedShips] = useState([]);

  const [gameMode, setGameMode] = useState(null);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [gamePhase, setGamePhase] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  const [currentTurn, setCurrentTurn] = useState(null);
  const [playerRole, setPlayerRole] = useState(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [stopwatchValue, setStopwatchValue] = useState(0);

  const [activeId, setActiveId] = useState(null);
  const [previewCells, setPreviewCells] = useState([]);

  useEffect(() => {
    socket.on("update_game", (data) => {
      setBoard(data.myBoard);
      setOppBoard(data.enemyBoard);
      setCurrentTurn(data.turn);
      setPlayerRole(data.role);
      setDestroyedShips(data.enemySunkShips);

      setTimeLeft(15);
      setIsWaiting(false);

      if (data.disconnectWin) {
        setGamePhase(false);
        setIsGameOver(true);
        return;
      }

      setGamePhase(true);

      if (data.winner && !data.disconnectWin) {
        setTimeout(() => {
          if (data.winner === socket.id) {
            alert("You won!");
            setWin((prev) => prev + 1);
          } else {
            alert("You lost!");
            setLose((prev) => prev + 1);
          }
        }, 150);
        setGamePhase(false);
        setIsGameOver(true);
      }
    });

    socket.on("opponent_disconnected", (data) => {
      alert(data.message);
      setWin((prev) => prev + 1);
      setGamePhase(false);
      setIsGameOver(true);
    });

    return () => {
      socket.off("update_game");
      socket.off("opponent_disconnected");
    };
  }, [setWin, setLose]);

  useEffect(() => {
    let timerInterval;
    if (gamePhase && gameMode === "multiplayer") {
      timerInterval = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [gamePhase, gameMode]);

  useEffect(() => {
    let intervalId;
    if (isWaiting) {
      intervalId = setInterval(() => {
        setStopwatchValue((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isWaiting]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.code === "Space" && activeId) {
        event.preventDefault();
        setShipsState((prevShips) =>
          prevShips.map((ship) =>
            ship.name === activeId
              ? {
                  ...ship,
                  orientation:
                    ship.orientation === "horizontal"
                      ? "vertical"
                      : "horizontal",
                }
              : ship,
          ),
        );
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeId]);

  function startMultiplayerGame() {
    if (!shipsState.every((ship) => ship.placed === true)) {
      return alert("Please place all ships!");
    }
    setGameMode("multiplayer");
    socket.emit("player_ready", { board, shipsState });
    setIsWaiting(true);
    setStopwatchValue(0);
  }

  function startBotGame() {
    if (!shipsState.every((ship) => ship.placed === true)) {
      return alert("Please place all ships!");
    }
    setGameMode("bot");
    fullReset();
    setBotBoard(structuredClone(board));
    setBotShips(structuredClone(shipsState));
    startGame();
    setIsWaiting(false);
    setGamePhase(true);
    setCurrentTurn(socket.id);
  }

  function handleShoot(cellId) {
    if (!gamePhase) return;
    if (gameMode === "multiplayer") {
      socket.emit("shoot", cellId);
    } else if (gameMode === "bot") {
      botTurn(cellId);
    }
  }

  function botTurn(cellId) {
    if (isBotThinking || currentTurn !== socket.id) return;
    setIsBotThinking(true);

    const playerResult = playerShoot(cellId);
    if (!playerResult) return setIsBotThinking(false);

    setOppBoard((prev) =>
      prev.map((c) =>
        c.id === playerResult.updatedCell.id ? playerResult.updatedCell : c,
      ),
    );

    if (playerResult.sunkShip) {
      setDestroyedShips((prev) => [...prev, playerResult.sunkShip.name]);
    }

    if (playerResult.gameFinished) {
      setTimeout(() => {
        alert("You won!");
        setWin((prev) => prev + 1);
        setGamePhase(false);
        setIsGameOver(true);
      }, 300);
      return setIsBotThinking(false);
    }

    if (playerResult.hit) {
      setCurrentTurn(socket.id);
      setIsBotThinking(false);
      return;
    }

    setCurrentTurn("bot");

    function executeBotShooting() {
      setTimeout(() => {
        const botShot = bot();

        setBoard((prev) =>
          prev.map((c) =>
            c.id === botShot.updatedCell.id ? botShot.updatedCell : c,
          ),
        );

        if (botShot.gameFinished) {
          setTimeout(() => {
            alert("Bot won!");
            setLose((prev) => prev + 1);
            setGamePhase(false);
            setIsGameOver(true);
          }, 300);
          return setIsBotThinking(false);
        }

        if (botShot.hit) {
          executeBotShooting();
        } else {
          setCurrentTurn(socket.id);
          setIsBotThinking(false);
        }
      }, 600);
    }

    executeBotShooting();
  }

  function handleRestart() {
    if (gameMode === "multiplayer") {
      socket.emit("restart_game");
    } else if (gameMode === "bot") {
      fullReset();
    }
    setBoard(generateEmptyBoard());
    setOppBoard(generateEmptyBoard());
    setShipsState(structuredClone(shipsTemplate));
    setDestroyedShips([]);
    setIsGameOver(false);
    setGamePhase(false);
    setIsWaiting(false);
    setCurrentTurn(null);
    setPlayerRole(null);
    setGameMode(null);
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

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragOver(event) {
    const { active, over } = event;
    if (!over) return setPreviewCells([]);
    const activeShip = shipsState.find((s) => s.name === active.id);
    if (!activeShip) return;
    setPreviewCells(
      calculateCoordinates(
        parseInt(over.id),
        activeShip.size,
        activeShip.orientation,
      ),
    );
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    setPreviewCells([]);
    if (!over) return;

    const shipName = active.id;
    const currentShip = shipsState.find((s) => s.name === shipName);
    const dropCellId = parseInt(over.id);
    const x = dropCellId % 10;
    const y = Math.floor(dropCellId / 10);

    if (currentShip.orientation === "horizontal" && x + currentShip.size > 10)
      return;
    if (currentShip.orientation === "vertical" && y + currentShip.size > 10)
      return;

    const newCoords = calculateCoordinates(
      dropCellId,
      currentShip.size,
      currentShip.orientation,
    );

    const isOverlapping = shipsState.some((otherShip) => {
      if (otherShip.name === shipName || !otherShip.placed) return false;
      return newCoords.some((coord) => {
        const halo = getSurroundingCells(coord);
        return halo.some((haloId) => otherShip.coordinates.includes(haloId));
      });
    });

    if (isOverlapping) return;

    setShipsState((prev) =>
      prev.map((ship) =>
        ship.name === shipName
          ? { ...ship, placed: true, coordinates: newCoords }
          : ship,
      ),
    );

    setBoard((prev) =>
      prev.map((cell) => {
        if (newCoords.includes(cell.id))
          return { ...cell, hasShip: true, status: "ship" };
        if (currentShip.placed && currentShip.coordinates.includes(cell.id))
          return { ...cell, hasShip: false, status: "empty" };
        return cell;
      }),
    );
  }

  function getShipContent(cell) {
    const shipAtCell = shipsState.find(
      (ship) => ship.placed && ship.coordinates.includes(cell.id),
    );
    if (!shipAtCell) return null;

    const indexInShip = shipAtCell.coordinates.indexOf(cell.id);
    let iconName = "boatMiddle";
    if (indexInShip === 0) iconName = "boatBack";
    if (indexInShip === shipAtCell.size - 1) iconName = "boatFront";

    if (cell.status === "hit") {
      iconName += "Hit";
    }

    const rotationAngle =
      shipAtCell.orientation === "vertical" ? "180deg" : "90deg";

    return (
      <Icon
        name={iconName}
        width="32px"
        height="32px"
        className={css.cellIcon}
        style={{ transform: `rotate(${rotationAngle})`, display: "block" }}
      />
    );
  }

  function formatStopwatch(secondsTotal) {
    const minutes = Math.floor(secondsTotal / 60);
    const seconds = String(secondsTotal % 60).padStart(2, "0");
    return minutes > 0 ? `${minutes}:${seconds}` : `${secondsTotal}s`;
  }

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <section className={css.section}>
        <div className={css.sectionContainer}>
          <div className={css.content}>
            <div className={css.container}>
              <div className={css.contentPart}>
                <div
                  className={`${css.playersWrapper} ${playerRole === "player1" ? css.playerBlue : css.playerRed}`}
                >
                  <span className={css.playerTxt}>Your fleet</span>
                </div>
                <div className={css.wrapper}>
                  <div className={css.letters}>
                    {letters.map((l) => (
                      <div key={l} className={css.label}>
                        {l}
                      </div>
                    ))}
                  </div>
                  <div className={css.numbers}>
                    {numbers.map((n) => (
                      <div key={n} className={css.label}>
                        {n}
                      </div>
                    ))}
                  </div>
                  <div className={css.grid}>
                    {board.map((item) => (
                      <DroppableCell
                        key={item.id}
                        id={item.id}
                        previewCells={previewCells}
                      >
                        {getShipContent(item)}
                        {item.status === "miss" && (
                          <div
                            className={`${css.cellBotMiss} ${css.popAnimation}`}
                          >
                            <Icon name="botMiss" width="32px" height="32px" />
                          </div>
                        )}
                      </DroppableCell>
                    ))}
                  </div>
                </div>

                {!gamePhase && !isWaiting && (
                  <div className={css.shipyard}>
                    <h3 className={css.shipyardTitle}>Shipyard</h3>
                    <div className={css.shipyardShips}>
                      {shipsState.map((ship) =>
                        !ship.placed ? (
                          <DraggableShip key={ship.name} ship={ship} />
                        ) : null,
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className={css.vl}></div>

              {gameMode !== null ? (
                <div className={css.contentPart}>
                  <div className={css.playersWrapper}>
                    <span className={css.playerTxt}>Opponent</span>
                  </div>
                  <div className={css.wrapper}>
                    <div className={css.letters}>
                      {letters.map((l) => (
                        <div key={l} className={css.label}>
                          {l}
                        </div>
                      ))}
                    </div>
                    <div className={css.numbers}>
                      {numbers.map((n) => (
                        <div key={n} className={css.label}>
                          {n}
                        </div>
                      ))}
                    </div>
                    <div className={css.grid}>
                      {oppBoard.map((item) => (
                        <div
                          key={item.id}
                          className={`${css.cell} ${css.cellEnemy}`}
                          onClick={() => handleShoot(item.id)}
                        >
                          {(item.status === "hit" ||
                            item.status === "miss") && (
                            <Icon
                              name={item.status}
                              width="32px"
                              height="32px"
                              className={`${css.cellIcon} ${css.popAnimation}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={css.shipyard}>
                    <h3 className={css.shipyardTitle}>Graveyard</h3>
                    <div className={css.graveyardShips}>
                      {shipsTemplate.map((ship) => (
                        <span
                          key={ship.name}
                          className={`${css.shipyardDestroyed} ${destroyedShips.includes(ship.name) ? `${css.destroyedShip} animate__animated animate__flash` : ""}`}
                        >
                          {ship.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={css.instructions}>
                  <div className={css.hint}>
                    <span
                      role="img"
                      aria-label="anchor"
                      className={css.hintSymbol}
                    >
                      &#x1F4A1;
                    </span>
                    <div className={css.hintTxtWrapper}>
                      <span className={css.hintTitle}>Hint</span>

                      <p className={css.hintTxt}>
                        Press the space bar while holding
                        <br /> the ship to change its orientation
                      </p>
                    </div>
                  </div>

                  <img
                    src={shipPlacement}
                    alt=""
                    className={css.instructionsImg}
                  />
                </div>
              )}
            </div>
          </div>

          {!gamePhase && !isWaiting && !isGameOver && (
            <div className={css.playButtons}>
              <button className={css.buttonPlay} onClick={startMultiplayerGame}>
                Play Multiplayer
              </button>
              <button className={css.buttonPlay} onClick={startBotGame}>
                Play against bot
              </button>
            </div>
          )}

          {isGameOver && (
            <button className={css.buttonPlay} onClick={handleRestart}>
              Restart
            </button>
          )}
          {isWaiting && (
            <span className={css.waitingOpponent}>
              Waiting for an opponent… {formatStopwatch(stopwatchValue)}
            </span>
          )}
          {gamePhase && (
            <span
              className={`${css.currentTurn} ${currentTurn === socket.id ? css.turnMy : css.turnEnemy}`}
            >
              {currentTurn === socket.id
                ? `Your turn${gameMode === "multiplayer" ? ` (${timeLeft}s)` : ""}`
                : `Opponent's move...${gameMode === "multiplayer" ? ` (${timeLeft}s)` : ""}`}
            </span>
          )}
        </div>
      </section>
      <DragOverlay dropAnimation={null}>
        {activeId ? (
          <DraggableShip
            ship={shipsState.find((s) => s.name === activeId)}
            isOverlay={true}
          />
        ) : null}
      </DragOverlay>

      <p className={css.license}>
        UI Design by
        <a
          href="https://www.figma.com/community/file/954838223155879312/battleship"
          className={css.licenseAuthor}
          target="_blank"
          rel="noreferrer"
        >
          Unfold
        </a>
        /
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          className={css.licenseLink}
          target="_blank"
          rel="noreferrer"
        >
          CC BY 4.0
        </a>
      </p>
    </DndContext>
  );
}
