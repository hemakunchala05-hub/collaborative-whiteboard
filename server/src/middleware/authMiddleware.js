import ApiError from "../utils/ApiError.js";
import { authenticateToken } from "../services/tokenService.js";

export default async function verifyToken(req, res, next) {
  const match = req.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1];

  if (!token) {
    return res.status(401).json({
      error: "Bearer token required",
      code: "AUTH_REQUIRED",
    });
  }

  try {
    req.user = await authenticateToken(token);
    req.userId = req.user.id;
    return next();
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }
    return next(error);
  }
}