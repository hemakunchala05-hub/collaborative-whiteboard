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
    email:{
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    hashed_password: {
      type: String,
      required: true,
    },
    userType: {
      type: String,
      default: 'Registered',
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

const User = mongoose.models.User ?? mongoose.model('User', userSchema);

export default User;
