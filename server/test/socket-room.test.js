import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Room from "../src/models/Room.js";
import {
  joinAcceptedSocketRooms,
  joinAuthenticatedSocketRoom,
} from "../src/sockets/index.js";

test("socket can join an active room only after membership is persisted", async () => {
  const previousExists = Room.exists;
  const userId = new mongoose.Types.ObjectId().toString();
  const roomId = new mongoose.Types.ObjectId().toString();
  let membershipFilter;
  let joinedRoom;
  Room.exists = async (filter) => {
    membershipFilter = filter;
    return { _id: roomId };
  };
  const socket = {
    data: { user: { id: userId } },
    async join(id) {
      joinedRoom = id;
    },
  };

  try {
    const result = await joinAuthenticatedSocketRoom(socket, roomId);

    assert.deepEqual(membershipFilter, {
      _id: roomId,
      status: "active",
      members: {
        $elemMatch: {
          userId,
          membershipStatus: "accepted",
        },
      },
    });
    assert.equal(joinedRoom, roomId);
    assert.deepEqual(result, { roomId });
  } finally {
    Room.exists = previousExists;
  }
});

test("socket reconnect joins only rooms with accepted membership", async () => {
  const previousFind = Room.find;
  const roomId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId().toString();
  const joinedRooms = [];
  let membershipFilter;
  Room.find = (filter) => {
    membershipFilter = filter;
    return {
      select(selection) {
        assert.equal(selection, "_id");
        return {
          async lean() {
            return [{ _id: roomId }];
          },
        };
      },
    };
  };
  const socket = {
    data: { user: { id: userId } },
    async join(id) {
      joinedRooms.push(id);
    },
  };

  try {
    await joinAcceptedSocketRooms(socket);

    assert.deepEqual(membershipFilter, {
      status: "active",
      members: {
        $elemMatch: {
          userId,
          membershipStatus: "accepted",
        },
      },
    });
    assert.deepEqual(joinedRooms, [roomId.toString()]);
  } finally {
    Room.find = previousFind;
  }
});

test("socket cannot join a room without persisted membership", async () => {
  const previousExists = Room.exists;
  Room.exists = async () => null;
  let joinCalled = false;
  const socket = {
    data: { user: { id: new mongoose.Types.ObjectId().toString() } },
    async join() {
      joinCalled = true;
    },
  };

  try {
    await assert.rejects(
      joinAuthenticatedSocketRoom(
        socket,
        new mongoose.Types.ObjectId().toString(),
      ),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "ROOM_MEMBERSHIP_REQUIRED");
        return true;
      },
    );
    assert.equal(joinCalled, false);
  } finally {
    Room.exists = previousExists;
  }
});

test("socket rejects malformed room IDs", async () => {
  await assert.rejects(
    joinAuthenticatedSocketRoom(
      { data: { user: { id: new mongoose.Types.ObjectId().toString() } } },
      "not-a-room-id",
    ),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_ROOM_ID");
      return true;
    },
  );
});
