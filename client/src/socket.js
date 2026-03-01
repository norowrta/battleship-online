// import { io } from "socket.io-client";

// export const socket = io("http://localhost:3000", {});

import { io } from "socket.io-client";

export const socket = io("wss://battleship-kxaf.onrender.com", {
  transports: ["websocket"],
});
