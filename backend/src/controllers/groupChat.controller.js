import GroupChat from "../models/GroupChat.js";
import GroupMessage from "../models/GroupMessage.js";
import User from "../models/User.js";
import { getReceiverSocketId } from "../lib/socket.js";
import { io } from "../lib/socket.js";

// Create a new group chat (ONLY creator is a member)
export const createGroupChat = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Group name required" });

    const group = await GroupChat.create({
      name,
      createdBy: req.user._id,
      members: [req.user._id], // creator only
    });

    return res.status(201).json(group);
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
};

// User joins a group explicitly
export const joinGroupChat = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await GroupChat.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const already = group.members.some((m) => m.toString() === req.user._id.toString());
    if (!already) {
      group.members.push(req.user._id);
      await group.save();
    }
    return res.status(200).json({ message: already ? "Already a member" : "Joined", group });
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};

// Get all groups user is a member of
export const getGroupChats = async (req, res) => {
  try {
    const groups = await GroupChat.find({ members: req.user._id }).sort({ updatedAt: -1 });
    return res.status(200).json(groups);
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};

// Get messages (only if member)
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await GroupChat.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const isMember = group.members.some((m) => m.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: "Not a group member" });

    const messages = await GroupMessage.find({ groupId })
      .populate("senderId", "fullName profilePic")
      .sort({ createdAt: 1 });

    return res.status(200).json(messages);
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};

// Send message (only if member)
export const sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { text, image = null } = req.body;

    const group = await GroupChat.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const isMember = group.members.some((m) => m.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: "Not a group member" });

    if (!text && !image) return res.status(400).json({ message: "Message content required" });

    const msg = await GroupMessage.create({
      groupId,
      senderId: req.user._id,
      text: text || "",
      image,
    });

    const populated = await msg.populate("senderId", "fullName profilePic");
    return res.status(201).json(populated);
  } catch {
    return res.status(500).json({ message: "Server error" });
  }
};

// Add a member to a group chat
export const addMemberToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = req.user._id;

    if (!memberId) {
      return res.status(400).json({ message: "Member ID is required" });
    }

    // Verify group exists and user is a member
    const groupChat = await GroupChat.findById(groupId);
    if (!groupChat) {
      return res.status(404).json({ message: "Group chat not found" });
    }

    if (!groupChat.members.includes(userId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // Check if member already exists in group
    if (groupChat.members.includes(memberId)) {
      return res.status(400).json({ message: "User is already a member" });
    }

    // Verify member exists
    const memberExists = await User.exists({ _id: memberId });
    if (!memberExists) {
      return res.status(404).json({ message: "User not found" });
    }

    groupChat.members.push(memberId);
    await groupChat.save();

    // Notify the new member
    const memberSocketId = getReceiverSocketId(memberId);
    if (memberSocketId) {
      io.to(memberSocketId).emit("addedToGroup", groupChat);
    }

    // Notify all existing members
    groupChat.members.forEach((member) => {
      const socketId = getReceiverSocketId(member.toString());
      if (socketId) {
        io.to(socketId).emit("memberAdded", { groupId, memberId });
      }
    });

    res.status(200).json(groupChat);
  } catch (error) {
    console.log("Error in addMemberToGroup controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Remove a member from a group chat
export const removeMemberFromGroup = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user._id;

    // Verify group exists and user is a member
    const groupChat = await GroupChat.findById(groupId);
    if (!groupChat) {
      return res.status(404).json({ message: "Group chat not found" });
    }

    if (!groupChat.members.includes(userId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    // Check if member exists in group
    if (!groupChat.members.includes(memberId)) {
      return res.status(400).json({ message: "User is not a member of this group" });
    }

    groupChat.members = groupChat.members.filter(
      (member) => member.toString() !== memberId
    );
    await groupChat.save();

    // Notify the removed member
    const memberSocketId = getReceiverSocketId(memberId);
    if (memberSocketId) {
      io.to(memberSocketId).emit("removedFromGroup", groupChat);
    }

    // Notify all remaining members
    groupChat.members.forEach((member) => {
      const socketId = getReceiverSocketId(member.toString());
      if (socketId) {
        io.to(socketId).emit("memberRemoved", { groupId, memberId });
      }
    });

    res.status(200).json(groupChat);
  } catch (error) {
    console.log("Error in removeMemberFromGroup controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};