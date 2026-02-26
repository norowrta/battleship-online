import { useState, useEffect } from "react";
import { socket } from "./socket";
import Header from "./components/Header/Header";
import Battleship from "./components/Battleship/Battleships";

export default function App() {
  const [win, setWin] = useState(
    () => Number(localStorage.getItem("win")) || 0,
  );
  const [lose, setLose] = useState(
    () => Number(localStorage.getItem("lose")) || 0,
  );

  const [onlinePlayers, setOnlinePlayers] = useState(0);

  useEffect(() => {
    localStorage.setItem("win", win);
  }, [win]);

  useEffect(() => {
    localStorage.setItem("lose", lose);
  }, [lose]);

  useEffect(() => {
    socket.emit("request_online_count");
    const handleOnlineCount = (n) => setOnlinePlayers(n);
    socket.on("online_count", handleOnlineCount);
    return () => socket.off("online_count", handleOnlineCount);
  }, []);

  return (
    <>
      <Header wins={win} loses={lose} onlinePlayers={onlinePlayers} />
      <Battleship setWin={setWin} setLose={setLose} />
    </>
  );
}
