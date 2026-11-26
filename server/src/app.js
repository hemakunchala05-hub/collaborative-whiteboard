import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import errorMiddleware from "./middleware/errorMiddleware.js";

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "16kb" }));
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found", code: "NOT_FOUND" });
});

app.use(errorMiddleware);

export default app;