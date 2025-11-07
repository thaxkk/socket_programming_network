import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import GroupChat from "../models/GroupChat.js"; // ✅ Using GroupChat for group functionality
import cloudinary from "./cloudinary.js";

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "https://network-chatapp.vercel.app",
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// ✅ Apply authentication middleware
io.use(socketAuthMiddleware);

const userSocketMap = {}; // {userId: socketId}
const userTypingStatus = {}; // {groupId: {userId: {username, timer}}}

// Get socket ID for a specific user
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// Get online users in a group
export function getOnlineUsersInGroup(groupId, memberIds) {
  return memberIds.filter((memberId) => userSocketMap[memberId.toString()]);
}

//connection event
io.on("connection", (socket) => {
  const userId = socket.userId?.toString();
  const userFullName = socket.user?.fullName || "Unknown User";

  console.log(`A user ${userFullName} connected`);
  console.log("Socket ID:", socket.id);
  console.log("User ID:", userId);
  
  if (userId) {
    userSocketMap[userId] = socket.id;
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  }

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
  // SEND MESSAGE (1-on-1) - ✅ CONSOLIDATED
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

    // Upload image if provided
    let imageUrl;
    if (image) {
      try {
        // Validate base64 format
        if (!image.startsWith('data:image')) {
          return socket.emit("messageSent", { 
            error: "Invalid image format" 
          });
        }

        // Check approximate size (base64 is ~33% larger than original)
        const imageSizeInMB = (image.length * 0.75) / (1024 * 1024);
        console.log(`📤 Uploading image (${imageSizeInMB.toFixed(2)}MB) from ${userFullName}...`);

        // Optional: Add size limit check (even after compression)
        if (imageSizeInMB > 5) {
          return socket.emit("messageSent", { 
            error: "Image too large. Please try a smaller image." 
          });
        }

        // Upload to Cloudinary with optimizations
        const uploadResponse = await cloudinary.uploader.upload(image, {
          folder: 'chat-app/messages',
          resource_type: 'auto',
          transformation: [
            { width: 1024, height: 1024, crop: 'limit' }, // Max dimensions
            { quality: 'auto:good' }, // Auto quality optimization
            { fetch_format: 'auto' } // Serve WebP to supported browsers
          ],
          timeout: 60000 // 60 second timeout
        });

        imageUrl = uploadResponse.secure_url;
        console.log(`✅ Image uploaded successfully: ${imageUrl.substring(0, 50)}...`);

      } catch (uploadError) {
        console.error("❌ Cloudinary upload error:", uploadError);
        
        // Provide specific error messages
        let errorMessage = "Failed to upload image";
        
        if (uploadError.http_code === 413) {
          errorMessage = "Image too large";
        } else if (uploadError.message?.includes('timeout')) {
          errorMessage = "Upload timeout. Please try again";
        } else if (uploadError.error?.message) {
          errorMessage = uploadError.error.message;
        }
        
        return socket.emit("messageSent", { error: errorMessage });
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
  // GROUP CHAT MANAGEMENT
  // ============================================

  // Create group chat
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

  // Send group message
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
        socket.emit("groupMessageError", {
          error: "You are not a member of this group",
        });
        return;
      }

      // Upload image if provided
      let imageUrl;
      if (image) {
        try {
          const uploadResponse = await cloudinary.uploader.upload(image);
          imageUrl = uploadResponse.secure_url;
        } catch (uploadError) {
          console.error("Cloudinary upload error:", uploadError);
          return socket.emit("groupMessageError", {
            error: "Failed to upload image",
          });
        }
      }

      const newMessage = new Message({
        senderId,
        groupId,
        text,
        image: imageUrl,
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

  // Add member to group
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

  // Remove member from group
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

  // ============================================
  // TYPING INDICATORS
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

  // Typing indicator for group chat
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

            // Notify group members
            const groupChat = GroupChat.findById(groupId);
            if (groupChat) {
              groupChat.members.forEach((memberId) => {
                const socketId = userSocketMap[memberId.toString()];
                if (socketId && socketId !== socket.id) {
                  io.to(socketId).emit("user_stopped_typing_group", {
                    groupId,
                    userId,
                  });
                }
              });
            }
          }, 3000),
        };

        // Notify other group members
        const groupChat = await GroupChat.findById(groupId);
        if (groupChat) {
          groupChat.members.forEach((memberId) => {
            const socketId = userSocketMap[memberId.toString()];
            if (socketId && socketId !== socket.id) {
              io.to(socketId).emit("user_typing_group", {
                groupId,
                userId,
                username,
              });
            }
          });
        }
      } else {
        // User stopped typing
        if (userTypingStatus[groupId]?.[userId]?.timer) {
          clearTimeout(userTypingStatus[groupId][userId].timer);
        }
        delete userTypingStatus[groupId]?.[userId];

        // Notify group members
        const groupChat = await GroupChat.findById(groupId);
        if (groupChat) {
          groupChat.members.forEach((memberId) => {
            const socketId = userSocketMap[memberId.toString()];
            if (socketId && socketId !== socket.id) {
              io.to(socketId).emit("user_stopped_typing_group", {
                groupId,
                userId,
              });
            }
          });
        }
      }
    } catch (error) {
      console.error("Error handling typing status:", error);
    }
  });

  // ============================================
  // DISCONNECT EVENT - ✅ CONSOLIDATED
  // ============================================

  socket.on("disconnect", () => {
    console.log(`User ${userFullName} disconnected`, socket.id);

    if (userId) {
      delete userSocketMap[userId];

      // Emit updated online users list
      io.emit("getOnlineUsers", Object.keys(userSocketMap));

      // Clean up typing status for all groups
      Object.keys(userTypingStatus).forEach((groupId) => {
        if (userTypingStatus[groupId]?.[userId]) {
          if (userTypingStatus[groupId][userId].timer) {
            clearTimeout(userTypingStatus[groupId][userId].timer);
          }
          delete userTypingStatus[groupId][userId];
        }
      });
    }
  });
});

export { io, app, server };