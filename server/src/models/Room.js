import mongoose from 'mongoose';

const { Schema } = mongoose;

const memberSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['host', 'presenter', 'participant'],
      default: 'participant',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    connectionStatus: {
      type: String,
      enum: ['online', 'offline'],
      default: 'offline',
      required: true,
    },
  },
  { _id: false },
);

const pendingRequestSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
    },
  },
  { _id: false },
);

const permissionsSchema = new Schema(
  {
    allowParticipantDrawing: { type: Boolean, default: true },
    allowParticipantAnnotations: { type: Boolean, default: true },
    allowParticipantChat: { type: Boolean, default: false },
  },
  { _id: false },
);

const settingsSchema = new Schema(
  {
    isPublic: { type: Boolean, default: false },
    allowParticipantCursor: { type: Boolean, default: true },
    enableReplay: { type: Boolean, default: true },
  },
  { _id: false },
);

export const roomSchema = new Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    roomName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    hostId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: {
      type: [memberSchema],
      default: [],
      validate: {
        validator(members) {
          const userIds = members.map(({ userId }) => userId.toString());
          return new Set(userIds).size === userIds.length;
        },
        message: 'A user can only be a member of a room once.',
      },
    },
    pendingRequests: {
      type: [pendingRequestSchema],
      default: [],
      validate: {
        validator(requests) {
          const userIds = requests
            .filter(({ status }) => status === 'pending')
            .map(({ userId }) => userId?.toString())
            .filter(Boolean);
          return new Set(userIds).size === userIds.length;
        },
        message: 'A user can only have one pending join request per room.',
      },
    },
    presenterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    permissions: {
      type: permissionsSchema,
      default: () => ({}),
    },
    settings: {
      type: settingsSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['active', 'ended'],
      default: 'active',
      required: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'rooms',
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

roomSchema.index({ hostId: 1 });

const Room = mongoose.models.Room ?? mongoose.model('Room', roomSchema);

export default Room;