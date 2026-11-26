import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";

export async function authenticateToken(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new ApiError(401, "AUTH_REQUIRED", "Authentication required");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(
      500,
      "AUTH_NOT_CONFIGURED",
      "Authentication is not configured",
    );
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch {
    throw new ApiError(401, "INVALID_TOKEN", "Invalid or expired token");
  }

  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    !mongoose.isValidObjectId(decoded.sub)
  ) {
    throw new ApiError(401, "INVALID_TOKEN", "Invalid or expired token");
  }

  const user = await User.findById(decoded.sub)
    .select("displayName email userType isActive tokenVersion")
    .lean();

  if (
    !user ||
    !user.isActive ||
    (decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)
  ) {
    throw new ApiError(401, "INVALID_TOKEN", "Invalid or expired token");
  }

  return {
    id: user._id.toString(),
    displayName: user.displayName,
    email: user.email,
    userType: user.userType,
  };
}
