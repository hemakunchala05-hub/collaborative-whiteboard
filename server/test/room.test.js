import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Room from "../src/models/Room.js";
import {
  acceptRoomRequest,
  assignPresenter,
  createRoomForUser,
  endRoomForUser,
  getPendingRequests,
  getDrawingPermission,
  leaveRoomForUser,
  joinRoomForUser,
  setMemberDrawPermission,
} from "../src/services/roomService.js";

test("room creation stores the authenticated user as host and presenter", async () => {
  const previousCreate = Room.create;
  const userId = new mongoose.Types.ObjectId().toString();
  let created;
  Room.create = async (values) => {
    created = values;
    return {
      _id: new mongoose.Types.ObjectId(),
      ...values,
      members: values.members,
    };
  };

  try {
    const result = await createRoomForUser(userId);

    assert.match(result.roomCode, /^[A-F0-9]{10}$/);
    assert.equal(result.role, "host");
    assert.equal(result.hostId, userId);
    assert.equal(result.presenterId, userId);
    assert.equal(result.membershipStatus, "accepted");
    assert.equal(result.canDraw, true);
    assert.equal(result.permissions.allowAllToDraw, false);
    assert.equal(created.hostId.toString(), userId);
    assert.equal(created.members[0].userId.toString(), userId);
    assert.equal(created.members[0].role, "host");
  } finally {
    Room.create = previousCreate;
  }
});

test("joining an existing room stores one participant membership", async () => {
  const previousFindOne = Room.findOne;
  const userId = new mongoose.Types.ObjectId().toString();
  const room = {
    _id: new mongoose.Types.ObjectId(),
    roomCode: "ABC123",
    roomName: "Whiteboard ABC123",
    hostId: new mongoose.Types.ObjectId(),
    presenterId: new mongoose.Types.ObjectId(),
    permissions: { allowAllToDraw: false },
    status: "active",
    members: [],
    pendingRequests: [],
    saves: 0,
    async save() {
      this.saves += 1;
    },
  };
  Room.findOne = async (filter) => {
    assert.deepEqual(filter, { roomCode: "ABC123" });
    return room;
  };

  try {
    const firstResult = await joinRoomForUser(userId, "ABC123");
    const secondResult = await joinRoomForUser(userId, "ABC123");

    assert.equal(firstResult.role, "participant");
    assert.equal(secondResult.role, "participant");
    assert.equal(firstResult.membershipStatus, "waiting");
    assert.equal(secondResult.membershipStatus, "waiting");
    assert.equal(room.members.length, 1);
    assert.equal(room.members[0].userId.toString(), userId);
    assert.equal(room.members[0].role, "participant");
    assert.equal(room.members[0].membershipStatus, "waiting");
    assert.equal(room.saves, 1);
    assert.equal(room.pendingRequests.length, 1);
    assert.equal(room.pendingRequests[0].userId.toString(), userId);
    assert.equal(room.pendingRequests[0].status, "waiting");
  } finally {
    Room.findOne = previousFindOne;
  }
});

test("host can list pending requests with requester details", async () => {
  const previousFindOne = Room.findOne;
  const roomId = new mongoose.Types.ObjectId().toString();
  const hostId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId();
  const requestedAt = new Date();
  let filter;
  Room.findOne = (query) => {
    filter = query;
    return {
      async populate(options) {
        assert.deepEqual(options, {
          path: "pendingRequests.userId",
          select: "displayName",
        });
        return {
          pendingRequests: [{
            userId: {
              _id: userId,
              displayName: "Ada Lovelace",
            },
            requestedAt,
            status: "waiting",
          }],
        };
      },
    };
  };

  try {
    const requests = await getPendingRequests(roomId, hostId);

    assert.deepEqual(filter, { _id: roomId, hostId, status: "active" });
    assert.deepEqual(requests, [{
      userId: userId.toString(),
      displayName: "Ada Lovelace",
      requestedAt,
      status: "waiting",
    }]);
  } finally {
    Room.findOne = previousFindOne;
  }
});

test("host approval accepts the participant and removes the pending request", async () => {
  const previousFindById = Room.findById;
  const roomId = new mongoose.Types.ObjectId();
  const hostId = new mongoose.Types.ObjectId();
  const participantId = new mongoose.Types.ObjectId();
  const member = {
    userId: participantId,
    role: "participant",
    membershipStatus: "waiting",
  };
  const room = {
    _id: roomId,
    hostId,
    status: "active",
    members: [member],
    pendingRequests: [{ userId: participantId, status: "waiting" }],
    saves: 0,
    async save() {
      this.saves += 1;
    },
  };
  Room.findById = async (id) => {
    assert.equal(id, roomId.toString());
    return room;
  };

  try {
    const result = await acceptRoomRequest(
      roomId.toString(),
      hostId.toString(),
      participantId.toString(),
    );

    assert.deepEqual(result, {
      roomId: roomId.toString(),
      userId: participantId.toString(),
      membershipStatus: "accepted",
    });
    assert.equal(member.membershipStatus, "accepted");
    assert.deepEqual(room.pendingRequests, []);
    assert.equal(room.saves, 1);
  } finally {
    Room.findById = previousFindById;
  }
});

test("only the room host can accept a pending request", async () => {
  const previousFindById = Room.findById;
  const room = {
    _id: new mongoose.Types.ObjectId(),
    hostId: new mongoose.Types.ObjectId(),
    status: "active",
    members: [],
    pendingRequests: [],
    async save() {
      assert.fail("unauthorized host must not save changes");
    },
  };
  Room.findById = async () => room;

  try {
    await assert.rejects(
      acceptRoomRequest(
        room._id.toString(),
        new mongoose.Types.ObjectId().toString(),
        new mongoose.Types.ObjectId().toString(),
      ),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "HOST_REQUIRED");
        return true;
      },
    );
  } finally {
    Room.findById = previousFindById;
  }
});

test("host can grant drawing permission to an accepted participant", async () => {
  const previousFindById = Room.findById;
  const roomId = new mongoose.Types.ObjectId();
  const hostId = new mongoose.Types.ObjectId();
  const participantId = new mongoose.Types.ObjectId();
  const participant = {
    userId: participantId,
    role: "participant",
    membershipStatus: "accepted",
    canDraw: false,
  };
  const room = {
    _id: roomId,
    hostId,
    status: "active",
    members: [participant],
    async save() {},
  };
  Room.findById = async () => room;

  try {
    const result = await setMemberDrawPermission(
      roomId.toString(),
      hostId.toString(),
      participantId.toString(),
      true,
    );

    assert.equal(result.canDraw, true);
    assert.equal(participant.canDraw, true);
  } finally {
    Room.findById = previousFindById;
  }
});

test("non-host cannot grant drawing permission", async () => {
  const previousFindById = Room.findById;
  const room = {
    _id: new mongoose.Types.ObjectId(),
    hostId: new mongoose.Types.ObjectId(),
    status: "active",
    members: [{
      userId: new mongoose.Types.ObjectId(),
      role: "participant",
      membershipStatus: "accepted",
      canDraw: false,
    }],
    async save() {
      assert.fail("non-host must not change permissions");
    },
  };
  Room.findById = async () => room;

  try {
    await assert.rejects(
      setMemberDrawPermission(
        room._id.toString(),
        new mongoose.Types.ObjectId().toString(),
        room.members[0].userId.toString(),
        true,
      ),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "HOST_REQUIRED");
        return true;
      },
    );
  } finally {
    Room.findById = previousFindById;
  }
});

test("drawing permission rejects members who have not been approved", async () => {
  const previousFindById = Room.findById;
  const room = {
    _id: new mongoose.Types.ObjectId(),
    status: "active",
    members: [{
      userId: new mongoose.Types.ObjectId(),
      role: "participant",
      membershipStatus: "accepted",
      canDraw: false,
    }],
  };
  Room.findById = async () => room;

  try {
    await assert.rejects(
      getDrawingPermission(
        room._id.toString(),
        new mongoose.Types.ObjectId().toString(),
      ),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "ROOM_MEMBERSHIP_REQUIRED");
        return true;
      },
    );
    await assert.rejects(
      getDrawingPermission(
        room._id.toString(),
        room.members[0].userId.toString(),
      ),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "DRAW_PERMISSION_REQUIRED");
        return true;
      },
    );
  } finally {
    Room.findById = previousFindById;
  }
});

test("presenter assignment stays separate from drawing permission", async () => {
  const previousFindById = Room.findById;
  const roomId = new mongoose.Types.ObjectId();
  const hostId = new mongoose.Types.ObjectId();
  const previousPresenterId = new mongoose.Types.ObjectId();
  const nextPresenterId = new mongoose.Types.ObjectId();
  const previousPresenter = {
    userId: previousPresenterId,
    role: "presenter",
    membershipStatus: "accepted",
    canDraw: false,
  };
  const nextPresenter = {
    userId: nextPresenterId,
    role: "participant",
    membershipStatus: "accepted",
    canDraw: false,
  };
  const room = {
    _id: roomId,
    hostId,
    presenterId: previousPresenterId,
    status: "active",
    members: [previousPresenter, nextPresenter],
    async save() {},
  };
  Room.findById = async () => room;

  try {
    await assignPresenter(
      roomId.toString(),
      hostId.toString(),
      nextPresenterId.toString(),
    );

    assert.equal(room.presenterId.toString(), nextPresenterId.toString());
    assert.equal(previousPresenter.role, "participant");
    assert.equal(nextPresenter.role, "presenter");
    assert.equal(nextPresenter.canDraw, false);
  } finally {
    Room.findById = previousFindById;
  }
});

test("leaving removes the user's membership and returns the presenter badge to host", async () => {
  const previousFindById = Room.findById;
  const roomId = new mongoose.Types.ObjectId();
  const hostId = new mongoose.Types.ObjectId();
  const participantId = new mongoose.Types.ObjectId();
  const participant = {
    userId: participantId,
    role: "presenter",
    membershipStatus: "accepted",
    connectionStatus: "online",
    canDraw: true,
  };
  const room = {
    _id: roomId,
    hostId,
    presenterId: participantId,
    status: "active",
    members: [participant],
    pendingRequests: [{ userId: participantId }],
    async save() {},
  };
  Room.findById = async () => room;

  try {
    const result = await leaveRoomForUser(roomId.toString(), participantId.toString());

    assert.equal(participant.membershipStatus, "left");
    assert.equal(participant.connectionStatus, "offline");
    assert.equal(participant.role, "participant");
    assert.equal(room.presenterId.toString(), hostId.toString());
    assert.deepEqual(room.pendingRequests, []);
    assert.equal(result.newPresenterId, hostId.toString());
  } finally {
    Room.findById = previousFindById;
  }
});

test("host can end a room and receives active user IDs for room cleanup", async () => {
  const previousFindById = Room.findById;
  const roomId = new mongoose.Types.ObjectId();
  const hostId = new mongoose.Types.ObjectId();
  const participantId = new mongoose.Types.ObjectId();
  const waitingId = new mongoose.Types.ObjectId();
  const room = {
    _id: roomId,
    hostId,
    status: "active",
    members: [
      { userId: hostId, membershipStatus: "accepted", connectionStatus: "online" },
      { userId: participantId, membershipStatus: "accepted", connectionStatus: "online" },
      { userId: waitingId, membershipStatus: "waiting", connectionStatus: "online" },
    ],
    pendingRequests: [{ userId: waitingId }],
    async save() {},
  };
  Room.findById = async () => room;

  try {
    const result = await endRoomForUser(roomId.toString(), hostId.toString());

    assert.equal(room.status, "ended");
    assert.ok(room.endedAt instanceof Date);
    assert.deepEqual(room.pendingRequests, []);
    assert.ok(result.userIds.includes(hostId.toString()));
    assert.ok(result.userIds.includes(participantId.toString()));
    assert.ok(result.userIds.includes(waitingId.toString()));
  } finally {
    Room.findById = previousFindById;
  }
});

test("joining an unknown room fails without creating membership", async () => {
  const previousFindOne = Room.findOne;
  Room.findOne = async () => null;

  try {
    await assert.rejects(
      joinRoomForUser(new mongoose.Types.ObjectId().toString(), "MISSING"),
      (error) => {
        assert.equal(error.statusCode, 404);
        assert.equal(error.code, "ROOM_NOT_FOUND");
        return true;
      },
    );
  } finally {
    Room.findOne = previousFindOne;
  }
});

test("room schema defaults drawing permission to disabled", () => {
  const userId = new mongoose.Types.ObjectId();
  const room = new Room({
    roomCode: "ABC123",
    roomName: "Whiteboard ABC123",
    hostId: userId,
    presenterId: userId,
  });

  assert.equal(room.permissions.allowAllToDraw, false);
  assert.equal(room.status, "active");
  assert.deepEqual(room.members, []);
});
