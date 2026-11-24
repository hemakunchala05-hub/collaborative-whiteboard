export default function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`Connected: ${socket.id}`);
    socket.emit("connection:ready", { socketId: socket.id });

    socket.on("ping", (message) => {
      socket.emit("pong", message);
    });

    socket.on("disconnect", (reason) => {
      console.log(`Disconnected: ${socket.id} (${reason})`);
    });
  });
}