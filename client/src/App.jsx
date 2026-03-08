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
  const [inQueue, setInQueue] = useState(0);

  useEffect(() => {
    localStorage.setItem("win", win);
  }, [win]);

  useEffect(() => {
    localStorage.setItem("lose", lose);
  }, [lose]);

  useEffect(() => {
    socket.emit("request_online_count");
    const handleOnlineCount = (n) => setOnlinePlayers(n);
    const handleQueueCount = (n) => setInQueue(n);
    const handleStatsUpdate = (online, queue) => {
      setOnlinePlayers(online);
      setInQueue(queue);
    };

    socket.on("online_count", handleOnlineCount);
    socket.on("in_queue", handleQueueCount);
    socket.on("stats_update", handleStatsUpdate);

    return () => {
      socket.off("online_count", handleOnlineCount);
      socket.off("in_queue", handleQueueCount);
      socket.off("stats_update", handleStatsUpdate);
    };
  }, []);

  return (
    <>
      <Header wins={win} loses={lose} onlinePlayers={onlinePlayers} inQueue={inQueue} />
      <Battleship setWin={setWin} setLose={setLose} />
    </>
  );
}
