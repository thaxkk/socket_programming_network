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
    origin: [process.env.CLIENT_URL || "http://localhost:5173"],
    credentials: true,
  },
});

// ✅ FIXED: Apply authentication middleware
io.use(socketAuthMiddleware);

const userSocketMap = {}; // {userId: socketId}
const userTypingStatus = {}; // {groupId: {userId: {username, timer}}}

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

export function getOnlineUsersInGroup(groupId, memberIds) {
  return memberIds.filter((memberId) => userSocketMap[memberId.toString()]);
}

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

  // ============================================
  // GROUP CHAT EVENTS
  // ============================================

  // Join user's group rooms
  socket.on("join_groups", async (groupIds) => {
    try {
      if (Array.isArray(groupIds)) {
        groupIds.forEach((groupId) => {
          socket.join(`group_${groupId}`);
        });
        console.log(`User ${userId} joined groups:`, groupIds);

        // Notify group members that user is online
        for (const groupId of groupIds) {
          socket.to(`group_${groupId}`).emit("user_online_in_group", {
            groupId,
            userId,
          });
        }
      }
    } catch (error) {
      console.error("Error joining groups:", error);
    }
  });

  // Join specific group room
  socket.on("join_group", async (groupId) => {
    try {
      socket.join(`group_${groupId}`);
      console.log(`User ${userId} joined group ${groupId}`);

      // Notify group members
      socket.to(`group_${groupId}`).emit("user_joined_group", {
        groupId,
        userId,
      });

      // Get and send online members
      const group = await Group.findById(groupId).select("members");
      if (group) {
        const onlineMembers = getOnlineUsersInGroup(
          groupId,
          group.members.map((m) => m.toString())
        );
        io.to(`group_${groupId}`).emit("group_online_members", {
          groupId,
          onlineMembers,
        });
      }
    } catch (error) {
      console.error("Error joining group:", error);
    }
  });

  // Leave group room
  socket.on("leave_group", (groupId) => {
    socket.leave(`group_${groupId}`);
    console.log(`User ${userId} left group ${groupId}`);

    // Notify group members
    socket.to(`group_${groupId}`).emit("user_left_group", {
      groupId,
      userId,
    });
  });

  // Send group message
  socket.on("send_group_message", async (data) => {
    try {
      const { groupId, text, image } = data;

      // Verify group and membership
      const group = await Group.findById(groupId);
      if (!group) {
        socket.emit("error", { message: "Group not found" });
        return;
      }

      if (!group.members.some((m) => m.toString() === userId)) {
        socket.emit("error", { message: "Not a group member" });
        return;
      }

      // Message is already saved via REST API, just broadcast
      // This event is for real-time notification only
      socket.to(`group_${groupId}`).emit("group_message_received", {
        groupId,
        senderId: userId,
        text,
        image,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error sending group message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Typing indicator in group
  socket.on("typing_group", async (data) => {
    try {
      const { groupId, username, isTyping } = data;

      if (!userTypingStatus[groupId]) {
        userTypingStatus[groupId] = {};
      }

      if (isTyping) {
        // Clear existing timer if any
        if (userTypingStatus[groupId][userId]?.timer) {
          clearTimeout(userTypingStatus[groupId][userId].timer);
        }

        // Set user as typing
        userTypingStatus[groupId][userId] = {
          username,
          timer: setTimeout(() => {
            // Auto stop typing after 3 seconds
            delete userTypingStatus[groupId][userId];
            socket.to(`group_${groupId}`).emit("user_stopped_typing_group", {
              groupId,
              userId,
            });
          }, 3000),
        };

        // Notify other group members
        socket.to(`group_${groupId}`).emit("user_typing_group", {
          groupId,
          userId,
          username,
        });
      } else {
        // User stopped typing
        if (userTypingStatus[groupId]?.[userId]?.timer) {
          clearTimeout(userTypingStatus[groupId][userId].timer);
        }
        delete userTypingStatus[groupId]?.[userId];

        socket.to(`group_${groupId}`).emit("user_stopped_typing_group", {
          groupId,
          userId,
        });
      }
    } catch (error) {
      console.error("Error handling typing status:", error);
    }
  });

  // Message read status in group
  socket.on("message_read_group", async (data) => {
    try {
      const { groupId, messageId } = data;

      // Notify group members that user read the message
      socket.to(`group_${groupId}`).emit("message_read_by_user", {
        groupId,
        messageId,
        userId,
        readAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating read status:", error);
    }
  });

  // Request online members in group
  socket.on("get_group_online_members", async (groupId) => {
    try {
      const group = await Group.findById(groupId).select("members");
      if (group) {
        const onlineMembers = getOnlineUsersInGroup(
          groupId,
          group.members.map((m) => m.toString())
        );
        socket.emit("group_online_members", {
          groupId,
          onlineMembers,
        });
      }
    } catch (error) {
      console.error("Error getting online members:", error);
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

      // Clean up typing status for all groups
      Object.keys(userTypingStatus).forEach((groupId) => {
        if (userTypingStatus[groupId]?.[userId]) {
          if (userTypingStatus[groupId][userId].timer) {
            clearTimeout(userTypingStatus[groupId][userId].timer);
          }
          delete userTypingStatus[groupId][userId];

          // Notify group members
          io.to(`group_${groupId}`).emit("user_offline_in_group", {
            groupId,
            userId,
          });
        }
      });
    }
  });
});

export { io, app, server };