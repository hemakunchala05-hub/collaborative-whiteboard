import mongoose from 'mongoose';

const { Schema } = mongoose;

export const boardEventSchema = new Schema(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventType: {
      type: String,
      enum: [
        'ELEMENT_ADDED',
        'ELEMENT_UPDATED',
        'ELEMENT_DELETED',
        'BOARD_CLEARED',
        'PRESENTER_ASSIGNED',
        'PERMISSION_UPDATED',
        'USER_JOINED',
        'USER_LEFT',
        'VIEWPORT_UPDATED',
      ],
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: () => ({}),
      required: true,
    },
    sequenceNumber: {
      type: Number,
      min: 1,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'Sequence number must be an integer.',
      },
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    collection: 'boardevents',
    versionKey: false,
  },
);

boardEventSchema.index(
  { roomId: 1, sequenceNumber: 1 },
  { unique: true },
);
boardEventSchema.index({ roomId: 1, timestamp: 1 });

const BoardEvent =
  mongoose.models.BoardEvent ?? mongoose.model('BoardEvent', boardEventSchema);

export default BoardEvent;