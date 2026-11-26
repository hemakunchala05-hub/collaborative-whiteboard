import {
  loginUser,
  logoutUser,
  registerUser,
} from "../services/authService.js";

export async function register(req, res, next) {
  try {
    const { displayName, email, password } = req.body;
    const result = await registerUser(displayName, email, password);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export function currentUser(req, res) {
  return res.status(200).json({ user: req.user });
}

export async function logout(req, res, next) {
  try {
    await logoutUser(req.userId);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}