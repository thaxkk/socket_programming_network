import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getUsersForSidebar,
  getMessages,
  sendMessage,
  sendGroupMessage,
  getGroupMessages,
  markGroupMessagesAsRead,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);

// Group message routes
router.post("/group/:groupId", protectRoute, sendGroupMessage);
router.get("/group/:groupId", protectRoute, getGroupMessages);
router.put("/group/:groupId/read", protectRoute, markGroupMessagesAsRead);

export default router;