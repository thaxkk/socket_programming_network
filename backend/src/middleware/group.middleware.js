import Group from "../models/group.model.js";

// Check if user is a member of the group
export const isGroupMember = async (req, res, next) => {
  try {
    const { id, groupId } = req.params;
    const userId = req.user._id;
    const targetGroupId = id || groupId;

    const group = await Group.findById(targetGroupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isMember = group.members.some(
      (member) => member.toString() === userId.toString()
    );

    if (!isMember) {
      return res
        .status(403)
        .json({ message: "You are not a member of this group" });
    }

    // Attach group to request for later use
    req.group = group;
    next();
  } catch (error) {
    console.error("Error in isGroupMember middleware:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Check if user is an admin of the group
export const isGroupAdmin = async (req, res, next) => {
  try {
    const { id, groupId } = req.params;
    const userId = req.user._id;
    const targetGroupId = id || groupId;

    const group = await Group.findById(targetGroupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isAdmin = group.admins.some(
      (admin) => admin.toString() === userId.toString()
    );

    if (!isAdmin) {
      return res
        .status(403)
        .json({ message: "Only admins can perform this action" });
    }

    // Attach group to request for later use
    req.group = group;
    next();
  } catch (error) {
    console.error("Error in isGroupAdmin middleware:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Check if user is the group creator
export const isGroupCreator = async (req, res, next) => {
  try {
    const { id, groupId } = req.params;
    const userId = req.user._id;
    const targetGroupId = id || groupId;

    const group = await Group.findById(targetGroupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.createdBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Only the group creator can perform this action" });
    }

    // Attach group to request for later use
    req.group = group;
    next();
  } catch (error) {
    console.error("Error in isGroupCreator middleware:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Validate group data
export const validateGroupData = (req, res, next) => {
  const { name, memberIds } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ message: "Group name is required" });
  }

  if (name.trim().length > 100) {
    return res
      .status(400)
      .json({ message: "Group name must be less than 100 characters" });
  }

  if (memberIds && !Array.isArray(memberIds)) {
    return res.status(400).json({ message: "memberIds must be an array" });
  }

  if (memberIds && memberIds.length > 256) {
    return res
      .status(400)
      .json({ message: "Cannot add more than 256 members to a group" });
  }

  next();
};

// Validate message data
export const validateGroupMessageData = (req, res, next) => {
  const { text, image } = req.body;

  if (!text && !image) {
    return res
      .status(400)
      .json({ message: "Message must contain text or image" });
  }

  if (text && text.length > 5000) {
    return res
      .status(400)
      .json({ message: "Message text too long (max 5000 characters)" });
  }

  next();
};