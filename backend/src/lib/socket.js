import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Group from "../models/Group.js"; // ✅ FIXED: Added missing import
import cloudinary from "./cloudinary.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

// ✅ FIXED: Apply authentication middleware
io.use(socketAuthMiddleware);

const userSocketMap = {}; // {userId: socketId}
const userTypingStatus = {}; // {groupId: {userId: {username, timer}}}

// we will use this function to check if the user is online or not
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// this is for storing online users
const userSocketMap = {}; // {userId:socketId}

io.on("connection", (socket) => {
  // ✅ FIXED: Consistent userId access from authenticated socket
  const userId = socket.userId?.toString();
  const userFullName = socket.user?.fullName || "Unknown User";

  console.log(`A user ${userFullName} connected`);

  if (userId) {
    userSocketMap[userId] = socket.id;

    // io.emit() is used to send events to all connected clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  } // ✅ FIXED: Added closing brace

  // ============================================
  // MESSAGE HISTORY
  // ============================================
  socket.on("getMessages", async ({ userId: chatUserId }) => {
    try {
      const myId = socket.userId;

      const messages = await Message.find({
        $or: [
          { senderId: myId, receiverId: chatUserId },
          { senderId: chatUserId, receiverId: myId },
        ],
      }).sort({ createdAt: 1 });

      socket.emit("messagesHistory", { messages });
    } catch (error) {
      console.log("Error in getMessages socket handler:", error.message);
      socket.emit("messagesHistory", { error: "Failed to fetch messages" });
    }
  });

  // ============================================
  // SEND MESSAGE (1-on-1)
  // ============================================
  socket.on("sendMessage", async ({ receiverId, text, image }) => {
    try {
      const senderId = socket.userId;

      // Validation
      if (!text && !image) {
        return socket.emit("messageSent", { error: "Text or image is required" });
      }

      if (senderId.toString() === receiverId.toString()) {
        return socket.emit("messageSent", {
          error: "Cannot send messages to yourself",
        });
      }

      const receiverExists = await User.exists({ _id: receiverId });
      if (!receiverExists) {
        return socket.emit("messageSent", { error: "Receiver not found" });
      }

      // ✅ FIXED: Added error handling for cloudinary upload
      let imageUrl;
      if (image) {
        try {
          const uploadResponse = await cloudinary.uploader.upload(image);
          imageUrl = uploadResponse.secure_url;
        } catch (uploadError) {
          console.error("Cloudinary upload error:", uploadError);
          return socket.emit("messageSent", { error: "Failed to upload image" });
        }
      }

      // Save message to database
      const newMessage = new Message({
        senderId,
        receiverId,
        text,
        image: imageUrl,
      });

      await newMessage.save();

      // Send confirmation to sender
      socket.emit("messageSent", { message: newMessage });

      // Send message to receiver if online
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", newMessage);
      }

      console.log(`Message sent from ${userFullName} to ${receiverId}`);
    } catch (error) {
      console.log("Error in sendMessage socket handler:", error.message);
      socket.emit("messageSent", { error: "Failed to send message" });
    }
  });

  // Handle 1-on-1 message sending (existing functionality)
  socket.on("sendMessage", async (messageData) => {
    try {
      const { receiverId, text, image } = messageData;
      const senderId = userId;

      const newMessage = new Message({
        senderId,
        receiverId,
        text,
        image,
      });

      await newMessage.save();

      // Send to receiver if online
      const receiverSocketId = userSocketMap[receiverId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", newMessage);
      }

      // Send confirmation back to sender
      socket.emit("messageSent", newMessage);
    } catch (error) {
      console.log("Error in sendMessage socket event:", error.message);
      socket.emit("messageError", { error: "Failed to send message" });
    }
  });

  // Handle group chat creation
  socket.on("createGroupChat", async (data) => {
    try {
      const { groupName, members } = data;
      const creatorId = userId;

      // Add creator to members if not already included
      const allMembers = [...new Set([creatorId, ...members])];

      const groupChat = new GroupChat({
        name: groupName,
        members: allMembers,
      });
      await groupChat.save();

      // Notify all members about the new group chat
      allMembers.forEach((memberId) => {
        const userSocketId = userSocketMap[memberId];
        if (userSocketId) {
          io.to(userSocketId).emit("groupChatCreated", groupChat);
        }
      });

      // Send confirmation back to creator
      socket.emit("groupChatCreatedSuccess", groupChat);
    } catch (error) {
      console.log("Error in createGroupChat socket event:", error.message);
      socket.emit("groupChatError", { error: "Failed to create group chat" });
    }
  });

  // Handle group message sending
  socket.on("sendGroupMessage", async (messageData) => {
    try {
      const { groupId, text, image } = messageData;
      const senderId = userId;

      // Verify group exists and user is a member
      const groupChat = await GroupChat.findById(groupId);
      if (!groupChat) {
        socket.emit("groupMessageError", { error: "Group chat not found" });
        return;
      }

      if (!groupChat.members.includes(senderId)) {
        socket.emit("groupMessageError", { error: "You are not a member of this group" });
        return;
      }

      const newMessage = new Message({
        senderId,
        groupId,
        text,
        image,
      });

      await newMessage.save();
      await newMessage.populate("senderId", "fullName profilePic");

      // Send to all group members
      groupChat.members.forEach((memberId) => {
        const memberSocketId = userSocketMap[memberId.toString()];
        if (memberSocketId) {
          io.to(memberSocketId).emit("newGroupMessage", newMessage);
        }
      });
    } catch (error) {
      console.log("Error in sendGroupMessage socket event:", error.message);
      socket.emit("groupMessageError", { error: "Failed to send group message" });
    }
  });

  // Handle adding member to group
  socket.on("addMemberToGroup", async (data) => {
    try {
      const { groupId, memberId } = data;

      const groupChat = await GroupChat.findById(groupId);
      if (!groupChat) {
        socket.emit("groupError", { error: "Group chat not found" });
        return;
      }

      if (!groupChat.members.includes(userId)) {
        socket.emit("groupError", { error: "You are not a member of this group" });
        return;
      }

      if (!groupChat.members.includes(memberId)) {
        groupChat.members.push(memberId);
        await groupChat.save();

        // Notify the new member
        const memberSocketId = userSocketMap[memberId];
        if (memberSocketId) {
          io.to(memberSocketId).emit("addedToGroup", groupChat);
        }

        // Notify all existing members
        groupChat.members.forEach((member) => {
          const socketId = userSocketMap[member.toString()];
          if (socketId) {
            io.to(socketId).emit("memberAdded", { groupId, memberId });
          }
        });
      }
    } catch (error) {
      console.log("Error in addMemberToGroup socket event:", error.message);
      socket.emit("groupError", { error: "Failed to add member" });
    }
  });

  // ============================================
  // 1-ON-1 CHAT EVENTS
  // ============================================

  // Typing indicator for 1-on-1 chat
  socket.on("typing", (data) => {
    const { receiverId } = data;
    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user_typing", {
        senderId: userId,
      });
    }
  });

  socket.on("stop_typing", (data) => {
    const { receiverId } = data;
    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user_stopped_typing", {
        senderId: userId,
      });
    }
  });

  // ============================================
  // DISCONNECT EVENT (✅ FIXED: Removed duplicate)
  // ============================================

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);

    if (userId) {
      delete userSocketMap[userId];

      // Emit updated online users list (for 1-on-1 chat)
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
  // Handle removing member from group
  socket.on("removeMemberFromGroup", async (data) => {
    try {
      const { groupId, memberId } = data;

      const groupChat = await GroupChat.findById(groupId);
      if (!groupChat) {
        socket.emit("groupError", { error: "Group chat not found" });
        return;
      }

      if (!groupChat.members.includes(userId)) {
        socket.emit("groupError", { error: "You are not a member of this group" });
        return;
      }

      groupChat.members = groupChat.members.filter(
        (member) => member.toString() !== memberId
      );
      await groupChat.save();

      // Notify the removed member
      const memberSocketId = userSocketMap[memberId];
      if (memberSocketId) {
        io.to(memberSocketId).emit("removedFromGroup", groupChat);
      }

      // Notify all remaining members
      groupChat.members.forEach((member) => {
        const socketId = userSocketMap[member.toString()];
        if (socketId) {
          io.to(socketId).emit("memberRemoved", { groupId, memberId });
        }
      });
    } catch (error) {
      console.log("Error in removeMemberFromGroup socket event:", error.message);
      socket.emit("groupError", { error: "Failed to remove member" });
    }
  });

  // with socket.on we listen for events from clients
  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.user.fullName);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
