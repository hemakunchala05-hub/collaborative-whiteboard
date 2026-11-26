export default function authorizeRoles(...allowedRoles) {
  if (allowedRoles.length === 0 || allowedRoles.some((role) => !role)) {
    throw new Error("authorizeRoles requires at least one valid role");
  }

  return function roleAuthorizationMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    if (!allowedRoles.includes(req.user.userType)) {
      return res.status(403).json({
        error: "You do not have permission to access this resource",
        code: "FORBIDDEN",
      });
    }

    return next();
  };
}