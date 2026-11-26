import jwt from "jsonwebtoken";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import ApiError from "../utils/ApiError.js";

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function createAuthToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(
      500,
      "AUTH_NOT_CONFIGURED",
      "Authentication is not configured",
    );
  }

  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      userType: user.userType,
      tokenVersion: user.tokenVersion ?? 0,
    },
    secret,
    { expiresIn: "3h", algorithm: "HS256" },
  );
}

export async function registerUser(displayName, email, password) {
  const hashedPassword = await hashPassword(password);

  const savedUser = await User.create({
    displayName,
    email: email.trim().toLowerCase(),
    hashed_password: hashedPassword,
    userType: "Registered",
  });

  return {
    user: {
      id: savedUser._id.toString(),
      displayName: savedUser.displayName,
      email: savedUser.email,
      userType: savedUser.userType,
    },
  };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
  }).select("+hashed_password");
  if (!user) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
  if (!isPasswordValid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (!user.isActive) {
    throw new ApiError(403, "ACCOUNT_INACTIVE", "This account is inactive");
  }

  const token = createAuthToken(user);

  return {
    token,
    user: {
      id: user._id.toString(),
      displayName: user.displayName,
      email: user.email,
      userType: user.userType,
    },
  };
}

export async function logoutUser(userId) {
  const user = await User.findByIdAndUpdate(userId, {
    $inc: { tokenVersion: 1 },
  });
  if (!user) {
    throw new ApiError(401, "INVALID_TOKEN", "Invalid or expired token");
  }
}
