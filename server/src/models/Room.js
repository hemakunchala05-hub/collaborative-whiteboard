import mongoose from "mongoose";

const { Schema } = mongoose;

const memberSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["host", "presenter", "participant"],
      required: true,
    },
    membershipStatus: {
      type: String,
      enum: ["waiting", "accepted", "left"],
      default: "accepted",
      required: true,
    },
    canDraw: {
      type: Boolean,
      default: false,
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    connectionStatus: {
      type: String,
      enum: ["online", "offline"],
      default: "online",
      required: true,
    },
  },
  { _id: false },
);

export const roomSchema = new Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    roomName: {
      type: String,
      required: true,
      trim: true,
    },
    hostId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: {
      type: [memberSchema],
      default: [],
    },
    pendingRequests: {
      type: [
        new Schema(
          {
            userId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            requestedAt: {
              type: Date,
              default: Date.now,
              required: true,
            },
            status: {
              type: String,
              enum: ["waiting"],
              default: "waiting",
              required: true,
            },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    presenterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    permissions: {
      allowAllToDraw: {
        type: Boolean,
        default: false,
        required: true,
      },
    },
    status: {
      type: String,
      enum: ["active", "ended"],
      default: "active",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "rooms",
    versionKey: false,
  },
);

const Room = mongoose.models.Room ?? mongoose.model("Room", roomSchema);

export default Room;
