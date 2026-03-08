# ⚓ Fullstack Multiplayer Battleship

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)

A classic Battleship game built from scratch with real-time multiplayer, an AI bot, and drag-and-drop fleet placement.

🎯 **[PLAY THE LIVE DEMO HERE](https://battleship-client-cvqs.onrender.com/)**

![Battleship Gameplay Preview](https://github.com/user-attachments/assets/258fb91e-d739-4427-9d0c-5bdc3e8bdd1b)

## ✨ Features
* **Real-time Multiplayer:** Play against other people online using Socket.io.
* **Smart AI Bot:** Play against a computer if no one is online (or if you just want to practice).
* **Drag-and-Drop Placement:** Smooth ship positioning and rotation using `@dnd-kit/core`.
* **Responsive Design:** Fully playable and optimized for both desktop and mobile devices.
* **Secure Server Logic (Anti-Cheat):** The server only sends visible board data (hits and misses) to the client, keeping enemy ship locations completely hidden from the browser's network tab.

## 🛠️ Tech Stack
**Frontend:**
* React (Vite)
* CSS Modules for styling
* `@dnd-kit/core` for drag & drop mechanics
* React Helmet & Open Graph tags for SEO
* Google Analytics & Microsoft Clarity for UX monitoring and traffic tracking

**Backend:**
* Node.js & Express
* Socket.io for real-time WebSocket communication

**Deployment:**
* Hosted fully on **Render** (both client and server)

## 📄 Credits
* UI Design by [Unfold](https://www.figma.com/community/file/954838223155879312/battleship) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
