import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "./cloudinary.js";


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

// this is for storig online users
const userSocketMap = {}; // {userId:socketId}

io.on("connection", (socket) => {
  console.log(`A user ${socket.user.fullName} connected`);

  const userId = socket.userId;
  userSocketMap[userId] = socket.id;

  // io.emit() is used to send events to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ✅ Socket handler: Get message history
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

  // ✅ Socket handler: Send message
  socket.on("sendMessage", async ({ receiverId, text, image }) => {
    try {
      const senderId = socket.userId;

      // Validation
      if (!text && !image) {
        return socket.emit("messageSent", { error: "Text or image is required" });
      }

      if (senderId.toString() === receiverId.toString()) {
        return socket.emit("messageSent", { 
          error: "Cannot send messages to yourself" 
        });
      }

      const receiverExists = await User.exists({ _id: receiverId });
      if (!receiverExists) {
        return socket.emit("messageSent", { error: "Receiver not found" });
      }

      // Upload image if provided
      let imageUrl;
      if (image) {
        const uploadResponse = await cloudinary.uploader.upload(image);
        imageUrl = uploadResponse.secure_url;
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

      console.log(`Message sent from ${socket.user.fullName} to ${receiverId}`);
    } catch (error) {
      console.log("Error in sendMessage socket handler:", error.message);
      socket.emit("messageSent", { error: "Failed to send message" });
    }
  });
  // with socket.on we listen for events from clients
  socket.on("disconnect", () => {
    console.log(`A user ${socket.user.fullName} disconnected`);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
