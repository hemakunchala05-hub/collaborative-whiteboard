import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import registerSocketHandlers from "./sockets/index.js";

const port = Number(process.env.PORT ?? 3000);
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Change to your frontend's origin if needed
  },
});

registerSocketHandlers(io);

httpServer.listen(port, () => {
  console.log(`HTTP and Socket.IO listening on port ${port}`);
});