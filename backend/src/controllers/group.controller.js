import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import GroupMemberActivity from "../models/groupMemberActivity.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// Create a new group
export const createGroup = async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    if (!memberIds || memberIds.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one member is required" });
    }

    // Verify all members exist
    const members = await User.find({ _id: { $in: memberIds } });
    if (members.length !== memberIds.length) {
      return res.status(400).json({ message: "Some users not found" });
    }

    // Add creator to members if not included
    const allMemberIds = [...new Set([userId.toString(), ...memberIds])];

    // Create group
    const group = new Group({
      name: name.trim(),
      description: description?.trim() || "",
      members: allMemberIds,
      admins: [userId], // Creator is admin
      createdBy: userId,
    });

    await group.save();

    // Initialize last seen for all members
    const memberActivities = allMemberIds.map((memberId) => ({
      groupId: group._id,
      userId: memberId,
      lastSeen: new Date(),
    }));
    await GroupMemberActivity.insertMany(memberActivities);

    // Populate group details
    await group.populate("members", "fullName email profilePic");
    await group.populate("admins", "fullName email profilePic");
    await group.populate("createdBy", "fullName email profilePic");

    // Notify all members via socket
    allMemberIds.forEach((memberId) => {
      if (memberId.toString() !== userId.toString()) {
        const receiverSocketId = getReceiverSocketId(memberId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("group_created", {
            group,
            message: `You were added to "${group.name}"`,
          });
        }
      }
    });

    res.status(201).json(group);
  } catch (error) {
    console.error("Error in createGroup controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all groups for the current user
export const getUserGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({ members: userId })
      .populate("members", "fullName email profilePic")
      .populate("admins", "fullName email profilePic")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    // Get unread count for each group
    const groupsWithUnread = await Promise.all(
      groups.map(async (group) => {
        const activity = await GroupMemberActivity.findOne({
          groupId: group._id,
          userId,
        });

        const unreadCount = await Message.countDocuments({
          groupId: group._id,
          createdAt: { $gt: activity?.lastSeen || new Date(0) },
          senderId: { $ne: userId },
        });

        return {
          ...group.toObject(),
          unreadCount,
        };
      })
    );

    res.status(200).json(groupsWithUnread);
  } catch (error) {
    console.error("Error in getUserGroups controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get group details
export const getGroupDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(id)
      .populate("members", "fullName email profilePic")
      .populate("admins", "fullName email profilePic")
      .populate("createdBy", "fullName email profilePic");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is a member
    if (!group.members.some((member) => member._id.toString() === userId.toString())) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    res.status(200).json(group);
  } catch (error) {
    console.error("Error in getGroupDetails controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update group (name, description, avatar)
export const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, avatar } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin
    if (!group.admins.some((admin) => admin.toString() === userId.toString())) {
      return res
        .status(403)
        .json({ message: "Only admins can update group details" });
    }

    // Update fields
    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();

    // Handle avatar upload
    if (avatar) {
      // Delete old avatar from cloudinary if exists
      if (group.avatar) {
        const publicId = group.avatar.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      }

      const uploadResponse = await cloudinary.uploader.upload(avatar);
      group.avatar = uploadResponse.secure_url;
    }

    await group.save();
    await group.populate("members", "fullName email profilePic");
    await group.populate("admins", "fullName email profilePic");

    // Notify all members
    group.members.forEach((member) => {
      const receiverSocketId = getReceiverSocketId(member._id);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("group_updated", group);
      }
    });

    res.status(200).json(group);
  } catch (error) {
    console.error("Error in updateGroup controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete group
export const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Only creator can delete group
    if (group.createdBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Only the group creator can delete the group" });
    }

    // Delete group avatar from cloudinary if exists
    if (group.avatar) {
      const publicId = group.avatar.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }

    // Notify all members before deletion
    group.members.forEach((memberId) => {
      const receiverSocketId = getReceiverSocketId(memberId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("group_deleted", {
          groupId: id,
          groupName: group.name,
        });
      }
    });

    // Delete all messages in the group
    await Message.deleteMany({ groupId: id });

    // Delete member activities
    await GroupMemberActivity.deleteMany({ groupId: id });

    // Delete group
    await Group.findByIdAndDelete(id);

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Error in deleteGroup controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Add members to group
export const addMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id;

    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: "No members to add" });
    }

    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin
    if (!group.admins.some((admin) => admin.toString() === userId.toString())) {
      return res
        .status(403)
        .json({ message: "Only admins can add members" });
    }

    // Verify all new members exist
    const newMembers = await User.find({ _id: { $in: memberIds } });
    if (newMembers.length !== memberIds.length) {
      return res.status(400).json({ message: "Some users not found" });
    }

    // Filter out already existing members
    const existingMemberIds = group.members.map((m) => m.toString());
    const uniqueNewMemberIds = memberIds.filter(
      (memberId) => !existingMemberIds.includes(memberId.toString())
    );

    if (uniqueNewMemberIds.length === 0) {
      return res
        .status(400)
        .json({ message: "All users are already members" });
    }

    // Add new members
    group.members.push(...uniqueNewMemberIds);
    await group.save();

    // Initialize last seen for new members
    const memberActivities = uniqueNewMemberIds.map((memberId) => ({
      groupId: group._id,
      userId: memberId,
      lastSeen: new Date(),
    }));
    await GroupMemberActivity.insertMany(memberActivities);

    await group.populate("members", "fullName email profilePic");
    await group.populate("admins", "fullName email profilePic");

    // Notify existing members
    group.members.forEach((member) => {
      const receiverSocketId = getReceiverSocketId(member._id);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("members_added", {
          groupId: id,
          newMembers: newMembers.map((m) => ({
            _id: m._id,
            fullName: m.fullName,
            profilePic: m.profilePic,
          })),
          group,
        });
      }
    });

    res.status(200).json(group);
  } catch (error) {
    console.error("Error in addMembers controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Remove member from group
export const removeMember = async (req, res) => {
  try {
    const { id, userId: memberToRemove } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin
    if (!group.admins.some((admin) => admin.toString() === userId.toString())) {
      return res
        .status(403)
        .json({ message: "Only admins can remove members" });
    }

    // Cannot remove creator
    if (group.createdBy.toString() === memberToRemove.toString()) {
      return res
        .status(403)
        .json({ message: "Cannot remove group creator" });
    }

    // Cannot remove other admins
    if (
      group.admins.some((admin) => admin.toString() === memberToRemove.toString()) &&
      userId.toString() !== memberToRemove.toString()
    ) {
      return res.status(403).json({ message: "Cannot remove other admins" });
    }

    // Remove member
    group.members = group.members.filter(
      (member) => member.toString() !== memberToRemove.toString()
    );
    group.admins = group.admins.filter(
      (admin) => admin.toString() !== memberToRemove.toString()
    );

    await group.save();
    await group.populate("members", "fullName email profilePic");
    await group.populate("admins", "fullName email profilePic");

    // Delete member activity
    await GroupMemberActivity.findOneAndDelete({
      groupId: id,
      userId: memberToRemove,
    });

    // Notify removed member
    const removedSocketId = getReceiverSocketId(memberToRemove);
    if (removedSocketId) {
      io.to(removedSocketId).emit("removed_from_group", {
        groupId: id,
        groupName: group.name,
      });
    }

    // Notify remaining members
    group.members.forEach((member) => {
      const receiverSocketId = getReceiverSocketId(member._id);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("member_removed", {
          groupId: id,
          removedUserId: memberToRemove,
          group,
        });
      }
    });

    res.status(200).json(group);
  } catch (error) {
    console.error("Error in removeMember controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update admin status (promote/demote)
export const updateAdmins = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: targetUserId, action } = req.body; // action: 'promote' or 'demote'
    const userId = req.user._id;

    if (!["promote", "demote"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is admin
    if (!group.admins.some((admin) => admin.toString() === userId.toString())) {
      return res
        .status(403)
        .json({ message: "Only admins can promote/demote members" });
    }

    // Check if target user is a member
    if (
      !group.members.some((member) => member.toString() === targetUserId.toString())
    ) {
      return res.status(400).json({ message: "User is not a member" });
    }

    const isAdmin = group.admins.some(
      (admin) => admin.toString() === targetUserId.toString()
    );

    if (action === "promote") {
      if (isAdmin) {
        return res.status(400).json({ message: "User is already an admin" });
      }
      group.admins.push(targetUserId);
    } else {
      // Cannot demote creator
      if (group.createdBy.toString() === targetUserId.toString()) {
        return res.status(403).json({ message: "Cannot demote group creator" });
      }

      if (!isAdmin) {
        return res.status(400).json({ message: "User is not an admin" });
      }

      group.admins = group.admins.filter(
        (admin) => admin.toString() !== targetUserId.toString()
      );
    }

    await group.save();
    await group.populate("members", "fullName email profilePic");
    await group.populate("admins", "fullName email profilePic");

    // Notify all members
    group.members.forEach((member) => {
      const receiverSocketId = getReceiverSocketId(member._id);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("admin_updated", {
          groupId: id,
          targetUserId,
          action,
          group,
        });
      }
    });

    res.status(200).json(group);
  } catch (error) {
    console.error("Error in updateAdmins controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Leave group
export const leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if user is a member
    if (!group.members.some((member) => member.toString() === userId.toString())) {
      return res.status(400).json({ message: "You are not a member" });
    }

    // If creator is leaving, transfer ownership to another admin or delete group
    if (group.createdBy.toString() === userId.toString()) {
      if (group.admins.length > 1) {
        // Transfer ownership to another admin
        const newCreator = group.admins.find(
          (admin) => admin.toString() !== userId.toString()
        );
        group.createdBy = newCreator;
      } else if (group.members.length > 1) {
        // No other admins, promote a member
        const newCreator = group.members.find(
          (member) => member.toString() !== userId.toString()
        );
        group.createdBy = newCreator;
        group.admins = [newCreator];
      } else {
        // Last member, delete the group
        await Message.deleteMany({ groupId: id });
        await GroupMemberActivity.deleteMany({ groupId: id });
        await Group.findByIdAndDelete(id);

        return res
          .status(200)
          .json({ message: "Group deleted as you were the last member" });
      }
    }

    // Remove user from members and admins
    group.members = group.members.filter(
      (member) => member.toString() !== userId.toString()
    );
    group.admins = group.admins.filter(
      (admin) => admin.toString() !== userId.toString()
    );

    await group.save();

    // Delete member activity
    await GroupMemberActivity.findOneAndDelete({
      groupId: id,
      userId,
    });

    await group.populate("members", "fullName email profilePic");
    await group.populate("admins", "fullName email profilePic");

    // Notify remaining members
    group.members.forEach((member) => {
      const receiverSocketId = getReceiverSocketId(member._id);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("member_left", {
          groupId: id,
          leftUserId: userId,
          group,
        });
      }
    });

    res.status(200).json({ message: "Left group successfully" });
  } catch (error) {
    console.error("Error in leaveGroup controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};