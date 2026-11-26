import { Router } from "express";
import {
  approveRoomRequest,
  createRoom,
  endRoom,
  leaveRoom,
  joinRoom,
  listRoomMembers,
  listPendingRequests,
  updateDrawPermission,
  updatePresenter,
} from "../controllers/roomController.js";
import verifyToken from "../middleware/authMiddleware.js";
import {
  validateDrawPermission,
  validateJoinRoom,
  validatePresenter,
} from "../middleware/roomValidationMiddleware.js";

const roomRouter = Router();

roomRouter.post("/", verifyToken, createRoom);
roomRouter.post("/join", verifyToken, validateJoinRoom, joinRoom);
roomRouter.get("/:roomId/requests", verifyToken, listPendingRequests);
roomRouter.post(
  "/:roomId/requests/:userId/accept",
  verifyToken,
  approveRoomRequest,
);
roomRouter.get("/:roomId/members", verifyToken, listRoomMembers);
roomRouter.put(
  "/:roomId/members/:userId/draw-permission",
  verifyToken,
  validateDrawPermission,
  updateDrawPermission,
);
roomRouter.put(
  "/:roomId/presenter",
  verifyToken,
  validatePresenter,
  updatePresenter,
);
roomRouter.post("/:roomId/leave", verifyToken, leaveRoom);
roomRouter.post("/:roomId/end", verifyToken, endRoom);

export default roomRouter;