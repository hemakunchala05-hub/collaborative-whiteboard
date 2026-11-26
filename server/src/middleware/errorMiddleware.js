import ApiError from "../utils/ApiError.js";

export default function errorMiddleware(error, _req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 11000) {
    return res.status(409).json({
      error: "An account with this email already exists",
      code: "EMAIL_ALREADY_EXISTS",
    });
  }

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Request validation failed",
      code: "INVALID_REQUEST",
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Request body must contain valid JSON",
      code: "INVALID_JSON",
    });
  }

  if (error.status === 413) {
    return res.status(413).json({
      error: "Request body is too large",
      code: "PAYLOAD_TOO_LARGE",
    });
  }

  console.error(error);
  return res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
  });
}