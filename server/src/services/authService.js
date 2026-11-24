import jwt from "jsonwebtoken";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;



export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export function createAuthToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      userType: user.userType,
    },
    secret,
    { expiresIn: "3h" }
  );
};

export async function registerUser( displayName, email, password ) {
  const hashedPassword = await hashPassword( password );

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
    }
  };
};


export async function loginUser({ email, password }) {
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    throw new Error("User not found");
  }

  const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
  if (!isPasswordValid) {
    throw new Error("Invalid password");
  }

  const isActive = user.isActive;
  if (!isActive) {
    throw new Error("User account is inactive");
  }

  const token = createAuthToken(user);

    return {
        token,
        user: {
            id: user._id.toString(),
            displayName: user.displayName,
            email: user.email,
            userType: user.userType
        },
    };
}
