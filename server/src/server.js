import "dotenv/config";
import { createServer } from "node:http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import socketAuth from "./sockets/socketAuth.js";
import registerSocketHandlers from "./sockets/index.js";

const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.JWT_SECRET;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}
if (!jwtSecret || Buffer.byteLength(jwtSecret, "utf8") < 32) {
  throw new Error("JWT_SECRET must contain at least 32 bytes");
}

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Change to your frontend's origin if needed
  },
});

app.set("io", io);
io.use(socketAuth);
registerSocketHandlers(io);

async function startServer() {
  await connectDB();
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });
  console.log(`HTTP and Socket.IO listening on port ${port}`);
}

startServer().catch(async (error) => {
  console.error("Server startup failed:", error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error("MongoDB disconnect failed:", disconnectError);
  }
  process.exitCode = 1;
});