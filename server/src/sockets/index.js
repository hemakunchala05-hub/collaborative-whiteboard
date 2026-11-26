import mongoose from "mongoose";
import Room from "../models/Room.js";
import ApiError from "../utils/ApiError.js";

export function getUserSocketRoom(userId) {
  return `user:${userId}`;
}

export async function joinAuthenticatedSocketRoom(socket, roomId) {
  if (!mongoose.isValidObjectId(roomId)) {
    throw new ApiError(400, "INVALID_ROOM_ID", "Invalid room ID");
  }
  const canonicalRoomId = new mongoose.Types.ObjectId(roomId).toString();

  const isMember = await Room.exists({
    _id: canonicalRoomId,
    status: "active",
    members: {
      $elemMatch: {
        userId: socket.data.user.id,
        membershipStatus: "accepted",
      },
    },
  });
  if (!isMember) {
    throw new ApiError(
      403,
      "ROOM_MEMBERSHIP_REQUIRED",
      "Join the room before connecting to its live session",
    );
  }

  await socket.join(canonicalRoomId);
  return { roomId: canonicalRoomId };
}

export async function joinAcceptedSocketRooms(socket) {
  const rooms = await Room.find({
    status: "active",
    members: {
      $elemMatch: {
        userId: socket.data.user.id,
        membershipStatus: "accepted",
      },
    },
  })
    .select("_id")
    .lean();

  await Promise.all(
    rooms.map((room) => socket.join(room._id.toString())),
  );
}

export default function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`Connected: ${socket.id}`);
    socket.join(getUserSocketRoom(socket.data.user.id));
    socket.emit("connection:ready", { socketId: socket.id });
    joinAcceptedSocketRooms(socket).catch((error) => {
      console.error("Socket room synchronization failed:", error);
      socket.emit("room:sync:error", {
        error: "Unable to synchronize your approved rooms",
      });
    });

    socket.on("room:join", async (payload, acknowledge) => {
      if (typeof acknowledge !== "function") return;

      try {
        const result = await joinAuthenticatedSocketRoom(
          socket,
          payload?.roomId,
        );
        acknowledge({ ok: true, ...result });
      } catch (error) {
        if (error instanceof ApiError) {
          acknowledge({
            ok: false,
            code: error.code,
            error: error.message,
          });
          return;
        }

        console.error("Socket room join failed:", error);
        acknowledge({
          ok: false,
          code: "ROOM_JOIN_FAILED",
          error: "Unable to join the live room",
        });
      }
    });

    socket.on("ping", (message) => {
      socket.emit("pong", message);
    });

    socket.on("disconnect", (reason) => {
      console.log(`Disconnected: ${socket.id} (${reason})`);
    });
  });
}