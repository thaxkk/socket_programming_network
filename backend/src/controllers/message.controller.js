import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import GroupMemberActivity from "../models/groupMemberActivity.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// ... (keep existing functions: getUsersForSidebar, getMessages, sendMessage)

// Send message to group
export const sendGroupMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { groupId } = req.params;
    const senderId = req.user._id;

    // Verify group exists
    const group = await Group.findById(groupId).populate(
      "members",
      "_id fullName profilePic"
    );

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if sender is a member
    if (!group.members.some((member) => member._id.toString() === senderId.toString())) {
      return res
        .status(403)
        .json({ message: "You are not a member of this group" });
    }

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      groupId,
      text,
      image: imageUrl,
      readBy: [{ userId: senderId }], // Sender has read the message
    });

    await newMessage.save();

    // Update group's last message
    group.lastMessage = newMessage._id;
    await group.save();

    // Populate sender info
    await newMessage.populate("senderId", "fullName profilePic");

    // Emit to all group members who are online
    group.members.forEach((member) => {
      const receiverSocketId = getReceiverSocketId(member._id);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("new_group_message", {
          message: newMessage,
          groupId,
        });
      }
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendGroupMessage controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get group messages
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.members.some((member) => member.toString() === userId.toString())) {
      return res
        .status(403)
        .json({ message: "You are not a member of this group" });
    }

    const messages = await Message.find({ groupId })
      .populate("senderId", "fullName profilePic")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getGroupMessages controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Mark group messages as read
export const markGroupMessagesAsRead = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Update last seen time
    await GroupMemberActivity.findOneAndUpdate(
      { groupId, userId },
      { lastSeen: new Date() },
      { upsert: true }
    );

    // Mark messages as read
    await Message.updateMany(
      {
        groupId,
        "readBy.userId": { $ne: userId },
      },
      {
        $push: {
          readBy: {
            userId,
            readAt: new Date(),
          },
        },
      }
    );

    res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    console.error(
      "Error in markGroupMessagesAsRead controller:",
      error.message
    );
    res.status(500).json({ message: "Internal server error" });
  }
};