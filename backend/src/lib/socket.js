import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import GroupChat from "../models/GroupChat.js";
import Message from "../models/Message.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

// apply authentication middleware to all socket connections
io.use(socketAuthMiddleware);

// we will use this function to check if the user is online or not
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// this is for storing online users
const userSocketMap = {}; // {userId:socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.user.fullName);

  const userId = socket.userId;
  userSocketMap[userId] = socket.id;

  // io.emit() is used to send events to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

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
