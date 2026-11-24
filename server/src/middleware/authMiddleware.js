import jwt from "jsonwebtoken";

export default function verifyToken(req, res, next) {
  const match = req.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];

  if (!token) {
    return res.status(401).json({ error: "Bearer token required" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Authentication is not configured" });
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded === "string" || typeof decoded.sub !== "string") {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.userId = decoded.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}