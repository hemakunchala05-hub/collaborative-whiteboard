import { disconnectSocket } from "./socketService.js";

const API_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";

async function postJson(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error ?? `Request failed (${response.status})`);
  }

  return result;
}

export function register(credentials) {
  return postJson("/api/auth/register", credentials);
}

export function login(credentials) {
  return postJson("/api/auth/login", credentials);
}

export function createRoom(token) {
  return authenticatedRequest("/api/rooms", token, {
    method: "POST",
    body: {},
  });
}

export function joinRoom(token, roomCode) {
  return authenticatedRequest("/api/rooms/join", token, {
    method: "POST",
    body: { roomCode },
  });
}

export function getPendingRequests(token, roomId) {
  return authenticatedRequest(
    `/api/rooms/${encodeURIComponent(roomId)}/requests`,
    token,
  );
}

export function acceptRoomRequest(token, roomId, userId) {
  return authenticatedRequest(
    `/api/rooms/${encodeURIComponent(roomId)}/requests/${encodeURIComponent(userId)}/accept`,
    token,
    { method: "POST" },
  );
}

export function getRoomMembers(token, roomId) {
  return authenticatedRequest(
    `/api/rooms/${encodeURIComponent(roomId)}/members`,
    token,
  );
}

export function setMemberDrawPermission(token, roomId, userId, canDraw) {
  return authenticatedRequest(
    `/api/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}/draw-permission`,
    token,
    { method: "PUT", body: { canDraw } },
  );
}

export function assignPresenter(token, roomId, userId) {
  return authenticatedRequest(
    `/api/rooms/${encodeURIComponent(roomId)}/presenter`,
    token,
    { method: "PUT", body: { userId } },
  );
}

export function leaveRoom(token, roomId) {
  return authenticatedRequest(
    `/api/rooms/${encodeURIComponent(roomId)}/leave`,
    token,
    { method: "POST" },
  );
}

export function endMeeting(token, roomId) {
  return authenticatedRequest(
    `/api/rooms/${encodeURIComponent(roomId)}/end`,
    token,
    { method: "POST" },
  );
}

async function authenticatedRequest(path, token, { method = "GET", body } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error ?? `Request failed (${response.status})`);
  }

  return result;
}

export async function logout(token) {
  try {
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error ?? `Request failed (${response.status})`);
    }
  } finally {
    disconnectSocket();
  }
}