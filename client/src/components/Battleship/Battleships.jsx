import { useState, useEffect } from "react";
import { DndContext } from "@dnd-kit/core";
import { io } from "socket.io-client";
import DraggableShip from "./DraggableShip.jsx";
import DroppableCell from "./DroppableCell.jsx";
import Icon from "../Icon";
import css from "./battleships.module.css";
import shipsTemplate from "./ships.json";

const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const socket = io("http://localhost:3000");

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

  const [gamePhase, setGamePhase] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [playerRole, setPlayerRole] = useState(null);

  const [activeId, setActiveId] = useState(null);
  const [previewCells, setPreviewCells] = useState([]);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    socket.on("update_game", (data) => {
      setBoard(data.myBoard);
      setOppBoard(data.enemyBoard);
      setCurrentTurn(data.turn);
      setPlayerRole(data.role);
      setDestroyedShips(data.enemySunkShips);

      setIsWaiting(false);
      setGamePhase(true);

      if (data.winner) {
        if (data.winner === socket.id) {
          alert("You won!");
          setWin((prev) => prev + 1);
        } else {
          alert("You lost!");
          setLose((prev) => prev + 1);
        }
       setGamePhase(false);
       setIsGameOver(true);
      }
    });

    return () => socket.off("update_game");
  }, [setWin, setLose]);

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

  async function startGame() {
    const allPlaced = shipsState.every((ship) => ship.placed === true);
    if (!allPlaced) {
      alert("Please place all ships!");
      return;
    }

    socket.emit("player_ready", { board, shipsState });
    setIsWaiting(true);
  }

  function handleShoot(cellId) {
    if (!gamePhase) return;
    socket.emit("shoot", cellId);
  }

  async function handleRestart() {
    try {
      socket.emit("restart_game");
      setBoard(generateEmptyBoard());
      setOppBoard(generateEmptyBoard());
      setShipsState(structuredClone(shipsTemplate));
      setDestroyedShips([]);
      setIsGameOver(false);
      setGamePhase(false);
    } catch (err) {
      console.error(err);
    }
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
    setShowHint(true);
  }

  function handleDragOver(event) {
    const { active, over } = event;
    if (!over) return setPreviewCells([]);

    const activeShip = shipsState.find((s) => s.name === active.id);
    if (!activeShip) return;

    const dropCellId = parseInt(over.id);
    setPreviewCells(
      calculateCoordinates(dropCellId, activeShip.size, activeShip.orientation),
    );
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    setPreviewCells([]);

    if (!over) return;

    const shipName = active.id;
    const dropCellId = parseInt(over.id);
    const currentShip = shipsState.find((s) => s.name === shipName);

    const x = dropCellId % 10;
    const y = Math.floor(dropCellId / 10);

    if (currentShip.orientation === "horizontal" && x + currentShip.size > 10)
      return;
    if (currentShip.orientation === "vertical" && y + currentShip.size > 10)
      return;

    const newCoordinates = calculateCoordinates(
      dropCellId,
      currentShip.size,
      currentShip.orientation,
    );

    const isOverlapping = shipsState.some((otherShip) => {
      if (otherShip.name === shipName || !otherShip.placed) return false;

      return newCoordinates.some((coord) => {
        const halo = getSurroundingCells(coord);
        return halo.some((haloId) => otherShip.coordinates.includes(haloId));
      });
    });

    if (isOverlapping) return;

    setShipsState((prev) =>
      prev.map((ship) =>
        ship.name === shipName
          ? { ...ship, placed: true, coordinates: newCoordinates }
          : ship,
      ),
    );

    setBoard((prevBoard) =>
      prevBoard.map((cell) => {
        const isNewCell = newCoordinates.includes(cell.id);
        const isOldCell =
          currentShip.placed && currentShip.coordinates.includes(cell.id);

        if (isNewCell) return { ...cell, hasShip: true, status: "ship" };
        if (isOldCell) return { ...cell, hasShip: false, status: "empty" };
        return cell;
      }),
    );
    setShowHint(false);
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
      if (iconName === "boatMiddle") iconName = "boatMiddleHit";
      if (iconName === "boatBack") iconName = "boatBackHit";
      if (iconName === "boatFront") iconName = "boatFrontHit";
    }

    const rotationAngle =
      shipAtCell.orientation === "vertical" ? "180deg" : "90deg";

    return (
      <Icon
        name={iconName}
        width="32px"
        height="32px"
        className={css.cellIcon}
        style={{
          transform: `rotate(${rotationAngle})`,
          display: "block",
        }}
      />
    );
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
                    {letters.map((letter) => (
                      <div key={letter} className={css.label}>
                        {letter}
                      </div>
                    ))}
                  </div>
                  <div className={css.numbers}>
                    {numbers.map((num) => (
                      <div key={num} className={css.label}>
                        {num}
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
                    <p className={`${css.hint} ${showHint && css.hintShowed}`}>
                      Press the "Spacebar" while holding a ship to change its
                      orientation
                    </p>
                  </div>
                )}
              </div>

              <div className={css.vl}></div>

              <div className={css.contentPart}>
                <div className={css.playersWrapper}>
                  <span className={css.playerTxt}>Opponent</span>
                </div>

                <div className={css.wrapper}>
                  <div className={css.letters}>
                    {letters.map((letter) => (
                      <div key={letter} className={css.label}>
                        {letter}
                      </div>
                    ))}
                  </div>
                  <div className={css.numbers}>
                    {numbers.map((num) => (
                      <div key={num} className={css.label}>
                        {num}
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
                        {item.status === "hit" && (
                          <Icon
                            name="hit"
                            width="32px"
                            height="32px"
                            className={`${css.cellIcon} ${css.popAnimation}`}
                          />
                        )}
                        {item.status === "miss" && (
                          <Icon
                            name="miss"
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
                    {[
                      "Battleship (4)",
                      "Submarine (3)",
                      "Cruiser (2)",
                      "Aircraft Carrier (5)",
                      "Destroyer (3)",
                    ].map((shipName) => (
                      <a
                        key={shipName}
                        href="#"
                        className={`${css.shipyardDestroyed} ${destroyedShips.includes(shipName) ? css.destroyedShip : ""}`}
                      >
                        {shipName}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!gamePhase && !isWaiting && (
            <button className={css.buttonPlay} onClick={startGame}>
              Play
            </button>
          )}

          {isGameOver && (
            <button className={css.buttonPlay} onClick={handleRestart}>
              Restart
            </button>
          )}

          {isWaiting && (
            <span className={css.waitingOpponent}>
              Waiting for an opponent...
            </span>
          )}

          {gamePhase && (
            <span
              className={`${css.currentTurn} ${currentTurn === socket.id ? css.turnMy : css.turnEnemy}`}
            >
              {currentTurn === socket.id ? "Your turn" : "Opponent's move..."}
            </span>
          )}
        </div>
      </section>
    </DndContext>
  );
}
