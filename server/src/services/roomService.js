import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import Room from "../models/Room.js";
import ApiError from "../utils/ApiError.js";

function generateRoomCode() {
  return randomBytes(5).toString("hex").toUpperCase();
}

function idString(value) {
  return value?._id?.toString() ?? value?.toString();
}

function memberCanDraw(member) {
  return member.role === "host" || member.canDraw === true;
}

function toRoomResponse(room, userId) {
  const member = room.members.find(
    (roomMember) => idString(roomMember.userId) === userId,
  );

  return {
    roomId: room._id.toString(),
    roomCode: room.roomCode,
    roomName: room.roomName,
    role: member.role,
    membershipStatus: member.membershipStatus,
    canDraw: memberCanDraw(member),
    isPresenter: room.presenterId.toString() === userId,
    hostId: room.hostId.toString(),
    presenterId: room.presenterId.toString(),
    permissions: room.permissions,
  };
}

async function findActiveRoom(roomId) {
  if (!mongoose.isValidObjectId(roomId)) {
    throw new ApiError(400, "INVALID_ROOM_ID", "Invalid room ID");
  }

  const room = await Room.findById(roomId);
  if (!room) {
    throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found");
  }
  if (room.status !== "active") {
    throw new ApiError(409, "ROOM_NOT_ACTIVE", "This room is no longer active");
  }

  return room;
}

function requireHost(room, hostId, action) {
  if (room.hostId.toString() !== hostId) {
    throw new ApiError(403, "HOST_REQUIRED", `Only the host can ${action}`);
  }
}

export async function createRoomForUser(userId) {
  const hostId = new mongoose.Types.ObjectId(userId);
  const roomCode = generateRoomCode();
  const room = await Room.create({
    roomCode,
    roomName: `Whiteboard ${roomCode}`,
    hostId,
    members: [
      {
        userId: hostId,
        role: "host",
        membershipStatus: "accepted",
        canDraw: true,
      },
    ],
    presenterId: hostId,
    permissions: { allowAllToDraw: false },
    status: "active",
  });

  return toRoomResponse(room, userId);
}

export async function joinRoomForUser(userId, roomCode) {
  const room = await Room.findOne({ roomCode });
  if (!room) {
    throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found");
  }
  if (room.status !== "active") {
    throw new ApiError(409, "ROOM_NOT_ACTIVE", "This room is no longer active");
  }

  let member = room.members.find(
    (roomMember) => idString(roomMember.userId) === userId,
  );
  if (!member) {
    member = {
      userId: new mongoose.Types.ObjectId(userId),
      role: "participant",
      membershipStatus: "waiting",
      canDraw: false,
      connectionStatus: "online",
    };
    room.members.push(member);
    room.pendingRequests.push({
      userId: new mongoose.Types.ObjectId(userId),
      status: "waiting",
    });
    await room.save();
  } else if (member.membershipStatus === "left") {
    member.connectionStatus = "online";
    if (userId === room.hostId.toString()) {
      member.membershipStatus = "accepted";
    } else {
      member.membershipStatus = "waiting";
      room.pendingRequests.push({
        userId: new mongoose.Types.ObjectId(userId),
        status: "waiting",
      });
    }
    await room.save();
  } else if (
    member.membershipStatus === "waiting" &&
    !room.pendingRequests.some(
      (request) => idString(request.userId) === userId,
    )
  ) {
    room.pendingRequests.push({
      userId: new mongoose.Types.ObjectId(userId),
      status: "waiting",
    });
    await room.save();
  }

  return toRoomResponse(room, userId);
}

export async function getPendingRequests(roomId, hostId) {
  if (!mongoose.isValidObjectId(roomId)) {
    throw new ApiError(400, "INVALID_ROOM_ID", "Invalid room ID");
  }

  const room = await Room.findOne({
    _id: roomId,
    hostId,
    status: "active",
  }).populate({
    path: "pendingRequests.userId",
    select: "displayName",
  });

  if (!room) {
    throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found");
  }

  return room.pendingRequests
    .filter((request) => request.status === "waiting")
    .map((request) => {
      const userId = idString(request.userId);
      if (!userId || !request.userId.displayName) return null;
      return {
        userId,
        displayName: request.userId.displayName,
        requestedAt: request.requestedAt,
        status: request.status,
      };
    })
    .filter(Boolean);
}

export async function acceptRoomRequest(roomId, hostId, participantId) {
  if (!mongoose.isValidObjectId(participantId)) {
    throw new ApiError(400, "INVALID_REQUEST", "Invalid user ID");
  }

  const room = await findActiveRoom(roomId);
  requireHost(room, hostId, "approve requests");

  const participant = room.members.find(
    (member) =>
      idString(member.userId) === participantId &&
      member.membershipStatus === "waiting",
  );
  const pendingRequest = room.pendingRequests.find(
    (request) => idString(request.userId) === participantId,
  );
  if (!pendingRequest || !participant) {
    throw new ApiError(404, "REQUEST_NOT_FOUND", "Pending request not found");
  }

  participant.membershipStatus = "accepted";
  room.pendingRequests = room.pendingRequests.filter(
    (request) => idString(request.userId) !== participantId,
  );
  await room.save();

  return {
    roomId: room._id.toString(),
    userId: participantId,
    membershipStatus: "accepted",
  };
}

export async function getRoomMembers(roomId, userId) {
  if (!mongoose.isValidObjectId(roomId)) {
    throw new ApiError(400, "INVALID_ROOM_ID", "Invalid room ID");
  }

  const room = await Room.findById(roomId).populate({
    path: "members.userId",
    select: "displayName",
  });
  if (!room || room.status !== "active") {
    throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found");
  }

  const requester = room.members.find(
    (member) => idString(member.userId) === userId,
  );
  if (!requester || requester.membershipStatus !== "accepted") {
    throw new ApiError(403, "ROOM_MEMBERSHIP_REQUIRED", "Room membership required");
  }

  return room.members
    .filter((member) => member.membershipStatus === "accepted")
    .map((member) => {
      const memberId = idString(member.userId);
      if (!memberId) return null;
      return {
        userId: memberId,
        displayName: member.userId.displayName ?? "Room member",
        role: member.role,
        canDraw: memberCanDraw(member),
        isPresenter: room.presenterId.toString() === memberId,
      };
    })
    .filter(Boolean);
}

export async function setMemberDrawPermission(
  roomId,
  hostId,
  participantId,
  canDraw,
) {
  if (!mongoose.isValidObjectId(participantId) || typeof canDraw !== "boolean") {
    throw new ApiError(400, "INVALID_REQUEST", "Invalid drawing permission request");
  }

  const room = await findActiveRoom(roomId);
  requireHost(room, hostId, "change drawing permissions");

  const member = room.members.find(
    (roomMember) => idString(roomMember.userId) === participantId,
  );
  if (!member || member.membershipStatus !== "accepted") {
    throw new ApiError(404, "ROOM_MEMBER_NOT_FOUND", "Accepted room member not found");
  }
  if (member.role === "host") {
    throw new ApiError(409, "HOST_ALWAYS_CAN_DRAW", "The host can always draw");
  }

  member.canDraw = canDraw;
  await room.save();

  return {
    roomId: room._id.toString(),
    userId: participantId,
    canDraw: memberCanDraw(member),
  };
}

export async function assignPresenter(roomId, hostId, participantId) {
  if (!mongoose.isValidObjectId(participantId)) {
    throw new ApiError(400, "INVALID_REQUEST", "Invalid user ID");
  }

  const room = await findActiveRoom(roomId);
  requireHost(room, hostId, "assign the presenter");

  const newPresenter = room.members.find(
    (member) =>
      idString(member.userId) === participantId &&
      member.membershipStatus === "accepted",
  );
  if (!newPresenter) {
    throw new ApiError(404, "ROOM_MEMBER_NOT_FOUND", "Accepted room member not found");
  }

  const previousPresenterId = room.presenterId.toString();
  const previousPresenter = room.members.find(
    (member) => idString(member.userId) === previousPresenterId,
  );
  if (previousPresenter && previousPresenter !== newPresenter) {
    if (previousPresenter.role === "presenter") {
      previousPresenter.role = "participant";
    }
  }

  newPresenter.role = newPresenter.role === "host" ? "host" : "presenter";
  room.presenterId = newPresenter.userId;
  await room.save();

  return {
    roomId: room._id.toString(),
    presenterId: participantId,
    previousPresenterId,
  };
}

export async function leaveRoomForUser(roomId, userId) {
  const room = await findActiveRoom(roomId);
  const member = room.members.find(
    (roomMember) => idString(roomMember.userId) === userId,
  );
  if (!member || member.membershipStatus === "left") {
    throw new ApiError(404, "ROOM_MEMBER_NOT_FOUND", "Room member not found");
  }

  member.membershipStatus = "left";
  member.connectionStatus = "offline";
  room.pendingRequests = room.pendingRequests.filter(
    (request) => idString(request.userId) !== userId,
  );

  let newPresenterId = null;
  if (
    room.presenterId.toString() === userId &&
    userId !== room.hostId.toString()
  ) {
    if (member.role === "presenter") member.role = "participant";
    room.presenterId = room.hostId;
    newPresenterId = room.hostId.toString();
  }

  await room.save();
  return {
    roomId: room._id.toString(),
    userId,
    newPresenterId,
  };
}

export async function endRoomForUser(roomId, hostId) {
  const room = await findActiveRoom(roomId);
  requireHost(room, hostId, "end the meeting");

  const userIds = new Set(
    room.members
      .filter((member) => ["accepted", "waiting"].includes(member.membershipStatus))
      .map((member) => idString(member.userId))
      .filter(Boolean),
  );
  for (const request of room.pendingRequests) {
    const userId = idString(request.userId);
    if (userId) userIds.add(userId);
  }

  room.status = "ended";
  room.endedAt = new Date();
  room.pendingRequests = [];
  for (const member of room.members) {
    member.connectionStatus = "offline";
  }
  await room.save();

  return {
    roomId: room._id.toString(),
    userIds: Array.from(userIds),
    status: room.status,
  };
}

export async function getDrawingPermission(roomId, userId) {
  const room = await findActiveRoom(roomId);
  const member = room.members.find(
    (roomMember) =>
      idString(roomMember.userId) === userId &&
      roomMember.membershipStatus === "accepted",
  );
  if (!member) {
    throw new ApiError(403, "ROOM_MEMBERSHIP_REQUIRED", "Room membership required");
  }
  if (!memberCanDraw(member)) {
    throw new ApiError(
      403,
      "DRAW_PERMISSION_REQUIRED",
      "The host has not granted you drawing permission",
    );
  }

  return { roomId: room._id.toString(), userId, canDraw: true };
}
