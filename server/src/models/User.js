import mongoose from 'mongoose';

const { Schema } = mongoose;

export const userSchema = new Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    userType: {
      type: String,
      enum: ['guest'],
      default: 'guest',
      required: true,
    },
    avatar: {
      type: String,
      trim: true,
      default: undefined,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expiresAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    collection: 'users',
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

userSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const User = mongoose.models.User ?? mongoose.model('User', userSchema);

export default User;
