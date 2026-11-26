import {
  assignPresenter,
  acceptRoomRequest,
  createRoomForUser,
  endRoomForUser,
  getPendingRequests,
  getRoomMembers,
  joinRoomForUser,
  leaveRoomForUser,
  setMemberDrawPermission,
} from "../services/roomService.js";
import { getUserSocketRoom } from "../sockets/index.js";
import ApiError from "../utils/ApiError.js";

export async function createRoom(req, res, next) {
  try {
    const room = await createRoomForUser(req.userId);
    return res.status(201).json({ room });
  } catch (error) {
    return next(error);
  }
}

export async function joinRoom(req, res, next) {
  try {
    const io = req.app.get("io");
    if (!io) {
      throw new ApiError(
        503,
        "SOCKET_NOT_CONFIGURED",
        "Live room service is not configured",
      );
    }

    const room = await joinRoomForUser(req.userId, req.body.roomCode);
    if (room.membershipStatus === "waiting") {
      io.to(room.roomId).emit("room:request", {
        roomId: room.roomId,
        user: {
          id: req.user.id,
          displayName: req.user.displayName,
        },
      });
    }
    return res.status(200).json({ room });
  } catch (error) {
    return next(error);
  }
}

export async function listPendingRequests(req, res, next) {
  try {
    const requests = await getPendingRequests(req.params.roomId, req.userId);
    return res.status(200).json({ requests });
  } catch (error) {
    return next(error);
  }
}

export async function approveRoomRequest(req, res, next) {
  try {
    const io = req.app.get("io");
    if (!io) {
      throw new ApiError(
        503,
        "SOCKET_NOT_CONFIGURED",
        "Live room service is not configured",
      );
    }

    const approval = await acceptRoomRequest(
      req.params.roomId,
      req.userId,
      req.params.userId,
    );
    const userRoom = getUserSocketRoom(approval.userId);
    io.in(userRoom).socketsJoin(approval.roomId);
    io.to(approval.roomId).emit("room:members:updated", {
      roomId: approval.roomId,
    });
    io.to(userRoom).emit("room:accepted", {
      roomId: approval.roomId,
      userId: approval.userId,
    });

    return res.status(200).json({ room: approval });
  } catch (error) {
    return next(error);
  }
}

export async function listRoomMembers(req, res, next) {
  try {
    const members = await getRoomMembers(req.params.roomId, req.userId);
    return res.status(200).json({ members });
  } catch (error) {
    return next(error);
  }
}

export async function updateDrawPermission(req, res, next) {
  try {
    const io = req.app.get("io");
    if (!io) {
      throw new ApiError(
        503,
        "SOCKET_NOT_CONFIGURED",
        "Live room service is not configured",
      );
    }

    const permission = await setMemberDrawPermission(
      req.params.roomId,
      req.userId,
      req.params.userId,
      req.body.canDraw,
    );
    io.to(permission.roomId).emit("room:members:updated", {
      roomId: permission.roomId,
    });

    return res.status(200).json({ permission });
  } catch (error) {
    return next(error);
  }
}

export async function updatePresenter(req, res, next) {
  try {
    const io = req.app.get("io");
    if (!io) {
      throw new ApiError(
        503,
        "SOCKET_NOT_CONFIGURED",
        "Live room service is not configured",
      );
    }

    const presenter = await assignPresenter(
      req.params.roomId,
      req.userId,
      req.body.userId,
    );
    io.to(presenter.roomId).emit("room:members:updated", {
      roomId: presenter.roomId,
    });

    return res.status(200).json({ presenter });
  } catch (error) {
    return next(error);
  }
}

export async function leaveRoom(req, res, next) {
  try {
    const io = req.app.get("io");
    if (!io) {
      throw new ApiError(
        503,
        "SOCKET_NOT_CONFIGURED",
        "Live room service is not configured",
      );
    }

    const result = await leaveRoomForUser(req.params.roomId, req.userId);
    io.to(result.roomId).emit("room:members:updated", {
      roomId: result.roomId,
      leftUserId: result.userId,
      presenterId: result.newPresenterId,
    });
    const userRoom = getUserSocketRoom(result.userId);
    io.to(userRoom).emit("room:left", {
      roomId: result.roomId,
      userId: result.userId,
    });
    io.in(userRoom).socketsLeave(result.roomId);

    return res.status(200).json({ room: result });
  } catch (error) {
    return next(error);
  }
}

export async function endRoom(req, res, next) {
  try {
    const io = req.app.get("io");
    if (!io) {
      throw new ApiError(
        503,
        "SOCKET_NOT_CONFIGURED",
        "Live room service is not configured",
      );
    }

    const result = await endRoomForUser(req.params.roomId, req.userId);
    for (const userId of result.userIds) {
      const userRoom = getUserSocketRoom(userId);
      io.to(userRoom).emit("room:ended", { roomId: result.roomId });
    }
    io.in(result.roomId).socketsLeave(result.roomId);

    return res.status(200).json({ room: result });
  } catch (error) {
    return next(error);
  }
}