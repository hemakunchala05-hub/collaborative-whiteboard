import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Connected:", socket.id);
  socket.emit("ping", "hello");
});

socket.on("connection:ready", (data) => console.log(data));
socket.on("pong", (message) => console.log("Pong:", message));