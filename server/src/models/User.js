import mongoose from "mongoose";

const { Schema } = mongoose;

export const userSchema = new Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true,
    },
    hashed_password: {
      type: String,
      required: true,
      select: false,
    },
    userType: {
      type: String,
      default: 'Registered',
      required: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    }
  },
);

const User = mongoose.models.User ?? mongoose.model("User", userSchema);

export default User;
