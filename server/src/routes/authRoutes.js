
import { Router } from "express";
import {
  currentUser,
  login,
  logout,
  register,
} from "../controllers/authController.js";
import verifyToken from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";
import {
  loginSchema,
  registerSchema,
  validateRequest,
} from "../middleware/validationMiddleware.js";

const authRouter = Router();

authRouter.post("/register", validateRequest(registerSchema), register);
authRouter.post("/login", validateRequest(loginSchema), login);
authRouter.get(
  "/me",
  verifyToken,
  authorizeRoles("Registered"),
  currentUser,
);
authRouter.post("/logout", verifyToken, logout);

export default authRouter;