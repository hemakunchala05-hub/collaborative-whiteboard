
import ApiError from "../utils/ApiError.js";
import { authenticateToken } from "../services/tokenService.js";

export default async function socketAuth(socket, next) {
  try {
    socket.data.user = await authenticateToken(socket.handshake.auth?.token);
    return next();
  } catch (error) {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(
            503,
            "AUTH_UNAVAILABLE",
            "Unable to verify authentication",
          );
    if (!(error instanceof ApiError)) {
      console.error("Socket authentication failed:", error);
    }

    const connectionError = new Error(apiError.message);
    connectionError.data = { code: apiError.code };
    return next(connectionError);
  }
}