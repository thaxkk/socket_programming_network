import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createGroup,
  getUserGroups,
  getGroupDetails,
  updateGroup,
  deleteGroup,
  addMembers,
  removeMember,
  updateAdmins,
  leaveGroup,
} from "../controllers/group.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protectRoute);

// Group CRUD
router.post("/", createGroup);
router.get("/", getUserGroups);
router.get("/:id", getGroupDetails);
router.put("/:id", updateGroup);
router.delete("/:id", deleteGroup);

// Member management
router.post("/:id/members", addMembers);
router.delete("/:id/members/:userId", removeMember);

// Admin management
router.put("/:id/admins", updateAdmins);

// Leave group
router.post("/:id/leave", leaveGroup);

export default router;