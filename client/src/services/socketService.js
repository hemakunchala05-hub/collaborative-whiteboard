import { io } from "socket.io-client";

const socket = io(
  import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000",
  { autoConnect: false },
);
const joinedRoomIds = new Set();

function emitRoomJoin(roomId) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit("room:join", { roomId }, (timeoutError, result) => {
      if (timeoutError) {
        reject(new Error("Timed out while joining the live room"));
      } else if (!result?.ok) {
        reject(new Error(result?.error ?? "Unable to join the live room"));
      } else {
        resolve(result);
      }
    });
  });
}

export function connectSocket(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("A login token is required to connect");
  }

  socket.disconnect();
  joinedRoomIds.clear();
  socket.auth = { token };
  socket.connect();
  return socket;
}

export async function joinSocketRoom(roomId) {
  if (typeof roomId !== "string" || roomId.length === 0) {
    throw new Error("A room ID is required to join the live room");
  }

  if (!socket.connected) {
    await new Promise((resolve, reject) => {
      const onConnect = () => {
        socket.off("connect_error", onConnectError);
        resolve();
      };
      const onConnectError = (error) => {
        socket.off("connect", onConnect);
        reject(error);
      };

      socket.once("connect", onConnect);
      socket.once("connect_error", onConnectError);
      if (!socket.active) socket.connect();
    });
  }

  const result = await emitRoomJoin(roomId);
  joinedRoomIds.add(result.roomId);
  return result;
}

export function forgetSocketRoom(roomId) {
  joinedRoomIds.delete(roomId);
}

export function disconnectSocket() {
  joinedRoomIds.clear();
  socket.disconnect();
}

export function getSocket() {
  return socket;
}

socket.on("connect", () => {
  for (const roomId of joinedRoomIds) {
    emitRoomJoin(roomId).catch((error) => {
      console.error(`Failed to rejoin live room ${roomId}:`, error);
    });
  }
});