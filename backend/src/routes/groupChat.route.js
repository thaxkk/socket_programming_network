import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import {
    createGroupChat,
    joinGroupChat,
    getGroupChats,
    getGroupMessages,
    sendGroupMessage,
} from "../controllers/groupChat.controller.js";

const router = express.Router();
router.use(protectRoute);

router.post("/create", createGroupChat);
router.post("/:groupId/join", joinGroupChat);
router.get("/all", getGroupChats);
router.get("/:groupId/messages", getGroupMessages);
router.post("/:groupId/messages", sendGroupMessage);

export default router;