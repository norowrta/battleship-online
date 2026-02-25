import { useState, useEffect } from "react";
import Header from "./components/Header/Header";
import Battleship from "./components/Battleship/Battleships";

export default function App() {
  const [win, setWin] = useState(
    () => Number(localStorage.getItem("win")) || 0,
  );
  const [lose, setLose] = useState(
    () => Number(localStorage.getItem("lose")) || 0,
  );

  useEffect(() => {
    localStorage.setItem("win", win);
  }, [win]);

  useEffect(() => {
    localStorage.setItem("lose", lose);
  }, [lose]);

  return (
    <>
      <Header wins={win} loses={lose} />
      <Battleship setWin={setWin} setLose={setLose} />
    </>
  );
}
