import GroupChat from "../models/GroupChat.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { getReceiverSocketId } from "../lib/socket.js";
import { io } from "../lib/socket.js";

// Create a new group chat
export const createGroupChat = async (req, res) => {
  try {
    const { name, members } = req.body;
    const creatorId = req.user._id;

    if (!name) {
      return res.status(400).json({ message: "Group name is required" });
    }

    if (!members || members.length === 0) {
      return res.status(400).json({ message: "At least one member is required" });
    }

    // Add creator to members if not already included
    const allMembers = [...new Set([creatorId.toString(), ...members])];

    // Verify all members exist
    const validMembers = await User.find({ _id: { $in: allMembers } });
    if (validMembers.length !== allMembers.length) {
      return res.status(400).json({ message: "One or more members not found" });
    }

    const groupChat = new GroupChat({
      name,
      members: allMembers,
    });

    await groupChat.save();

    // Notify all members about the new group chat
    allMembers.forEach((memberId) => {
      const memberSocketId = getReceiverSocketId(memberId);
      if (memberSocketId) {
        io.to(memberSocketId).emit("groupChatCreated", groupChat);
      }
    });

    res.status(201).json(groupChat);
  } catch (error) {
    console.log("Error in createGroupChat controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all group chats for the logged-in user
export const getGroupChats = async (req, res) => {
  try {
    const userId = req.user._id;

    const groupChats = await GroupChat.find({
      members: userId,
    }).populate("members", "fullName profilePic email");

    res.status(200).json(groupChats);
  } catch (error) {
    console.log("Error in getGroupChats controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get messages from a specific group chat
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Verify user is a member of the group
    const groupChat = await GroupChat.findById(groupId);
    if (!groupChat) {
      return res.status(404).json({ message: "Group chat not found" });
    }

    if (!groupChat.members.includes(userId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const messages = await Message.find({ groupId }).populate(
      "senderId",
      "fullName profilePic"
    );

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getGroupMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Send a message to a group chat
export const sendGroupMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { groupId } = req.params;
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ message: "Text or image is required" });
    }

    // Verify group exists and user is a member
    const groupChat = await GroupChat.findById(groupId);
    if (!groupChat) {
      return res.status(404).json({ message: "Group chat not found" });
    }

    if (!groupChat.members.includes(senderId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const newMessage = new Message({
      senderId,
      groupId,
      text,
      image,
    });

    await newMessage.save();

    // Populate sender info
    await newMessage.populate("senderId", "fullName profilePic");

    // Emit the message to all members of the group
    groupChat.members.forEach((memberId) => {
      const memberSocketId = getReceiverSocketId(memberId.toString());
      if (memberSocketId) {
        io.to(memberSocketId).emit("newGroupMessage", newMessage);
      }
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendGroupMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
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