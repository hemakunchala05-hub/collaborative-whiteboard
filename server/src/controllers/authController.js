import { registerUser, loginUser } from "../services/authService.js";

export async function register(req, res, next) {
  const { displayName, email, password } = req.body ?? {};

  if (!displayName || !email || !password) {
    return res.status(400).json({
      error: "displayName, email, and password are required",
    });
  }

  try {
    const result = await registerUser(displayName, email, password);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const result = await loginUser({ email, password });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}