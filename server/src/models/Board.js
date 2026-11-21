import mongoose from 'mongoose';

const { Schema } = mongoose;

const drawingElementSchema = new Schema(
  {
    elementId: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['freehand', 'rectangle', 'circle', 'line', 'text', 'eraser'],
      required: true,
    },
    points: {
      type: [Number],
      default: undefined,
      validate: {
        validator(points) {
          if (!['freehand', 'eraser'].includes(this.type)) return true;
          return (
            Array.isArray(points) &&
            points.length >= 4 &&
            points.length % 2 === 0 &&
            points.every(Number.isFinite)
          );
        },
        message: 'Freehand and eraser paths require at least two coordinate pairs.',
      },
    },
    x: {
      type: Number,
      required() {
        return ['rectangle', 'circle', 'line', 'text'].includes(this.type);
      },
    },
    y: {
      type: Number,
      required() {
        return ['rectangle', 'circle', 'line', 'text'].includes(this.type);
      },
    },
    width: {
      type: Number,
      required() {
        return ['rectangle', 'circle', 'line'].includes(this.type);
      },
    },
    height: {
      type: Number,
      required() {
        return ['rectangle', 'circle', 'line'].includes(this.type);
      },
    },
    text: {
      type: String,
      required() {
        return this.type === 'text';
      },
    },
    fontSize: {
      type: Number,
      min: 1,
      required() {
        return this.type === 'text';
      },
      default: undefined,
    },
    color: {
      type: String,
      trim: true,
      default: '#000000',
    },
    strokeWidth: {
      type: Number,
      min: 0,
      default: 2,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false },
);

const viewportSchema = new Schema(
  {
    x: { type: Number, default: 0, required: true },
    y: { type: Number, default: 0, required: true },
    scale: { type: Number, default: 1, min: 0.01, required: true },
  },
  { _id: false },
);

export const boardSchema = new Schema(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      unique: true,
    },
    elements: {
      type: [drawingElementSchema],
      default: [],
      validate: {
        validator(elements) {
          const elementIds = elements.map(({ elementId }) => elementId);
          return new Set(elementIds).size === elementIds.length;
        },
        message: 'Element IDs must be unique within a board.',
      },
    },
    viewport: {
      type: viewportSchema,
      default: () => ({}),
    },
    version: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'Board version must be an integer.',
      },
    },
  },
  {
    collection: 'boards',
    timestamps: { createdAt: false, updatedAt: 'updatedAt' },
    versionKey: false,
  },
);

const Board = mongoose.models.Board ?? mongoose.model('Board', boardSchema);

export default Board;