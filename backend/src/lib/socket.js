import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import GroupChat from "../models/GroupChat.js";
import cloudinary from "./cloudinary.js";
import GroupMessage from "../models/GroupMessage.js";

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
  maxHttpBufferSize: 1e7, // 10MB
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
  allowUpgrades: true,
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
  // MESSAGE HISTORY (1-on-1)
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
        return socket.emit("messageSent", {
          error: "Text or image is required",
        });
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
          if (!image.startsWith("data:image")) {
            return socket.emit("messageSent", {
              error: "Invalid image format",
            });
          }

          const imageSizeInMB = (image.length * 0.75) / (1024 * 1024);
          console.log(
            `📤 Uploading image (${imageSizeInMB.toFixed(
              2
            )}MB) from ${userFullName}...`
          );

          if (imageSizeInMB > 5) {
            return socket.emit("messageSent", {
              error: "Image too large. Please try a smaller image.",
            });
          }

          const uploadResponse = await cloudinary.uploader.upload(image, {
            folder: "chat-app/messages",
            resource_type: "auto",
            transformation: [
              { width: 1024, height: 1024, crop: "limit" },
              { quality: "auto:good" },
              { fetch_format: "auto" },
            ],
            timeout: 60000,
          });

          imageUrl = uploadResponse.secure_url;
          console.log(
            `✅ Image uploaded successfully: ${imageUrl.substring(0, 50)}...`
          );
        } catch (uploadError) {
          console.error("❌ Cloudinary upload error:", uploadError);

          let errorMessage = "Failed to upload image";
          if (uploadError.http_code === 413) {
            errorMessage = "Image too large";
          } else if (uploadError.message?.includes("timeout")) {
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
  // GROUP CHAT - REQUIREMENT: CREATOR ONLY, EXPLICIT JOIN
  // ============================================

  // ✅ Create group chat (creator is ONLY initial member)
  socket.on("createGroupChat", async (data) => {
    try {
      const { name } = data;
      const creatorId = userId;

      if (!name || !name.trim()) {
        return socket.emit("groupChatCreated", {
          error: "Group name is required",
        });
      }

      // ✅ REQUIREMENT: Only creator is initial member
      const groupChat = new GroupChat({
        name: name.trim(),
        createdBy: creatorId,
        members: [creatorId], // ONLY creator
      });
      await groupChat.save();

      console.log(`✅ Group created: ${name} by ${userFullName}`);

      // Send confirmation back to creator
      socket.emit("groupChatCreated", { group: groupChat });

      // Creator auto-joins the socket room
      socket.join(`group:${groupChat._id}`);
    } catch (error) {
      console.log("Error in createGroupChat socket event:", error.message);
      socket.emit("groupChatCreated", { error: "Failed to create group chat" });
    }
  });

  /*
  // ✅ Explicit join (users must join to become members)
  socket.on("joinGroup", async ({ groupId }) => {
    try {
      if (!groupId) {
        return socket.emit("joinedGroup", { error: "groupId is required" });
      }

      const userId = String(socket.user._id);
      const room = `group:${groupId}`;

      // อัปเดตแบบ atomic + กันซ้ำสมาชิก โดยไม่ trigger full validation ของทั้งเอกสาร
      const groupChat = await GroupChat.findByIdAndUpdate(
        groupId,
        { $addToSet: { members: userId } },
        { new: true } // ไม่ใส่ runValidators เพื่อเลี่ยง required ของฟิลด์ที่ไม่ได้แก้
      );

      if (!groupChat) {
        return socket.emit("joinedGroup", { error: "Group chat not found" });
      }

      const isMember = groupChat.members.some((m) => String(m) === userId);

      // เข้าห้อง socket
      socket.join(room);

      // ตอบกลับผู้ที่ join
      socket.emit("joinedGroup", {
        group: groupChat,
        message: isMember ? "Already a member" : "Joined successfully",
      });

      // แจ้งสมาชิกคนอื่นในห้อง
      socket.to(room).emit("memberJoined", {
        groupId,
        userId,
        username: socket.user.fullName,
      });
    } catch (error) {
      console.log("Error in joinGroup socket event:", error.message);
      socket.emit("joinedGroup", { error: "Failed to join group" });
    }
  });
  */

  // ============================================
  // GROUP CHAT - DISCOVER / GET ALL GROUPS (search + pagination)
  // ============================================
  /**
   * Client emits:
   *  socket.emit("getAllGroups", { search: "dev", page: 1, limit: 20 });
   *
   * Server responds:
   *  socket.on("allGroupsResult", { groups, page, limit, total, hasNextPage })
   */
  socket.on("getAllGroups", async (payload = {}) => {
    try {
      const {
        search = "",
        page = 1,
        limit = 20,
        includeOnline = true,
        sort = "recent", // "recent" = updatedAt desc, "name" = name asc, "members" = memberCount desc
      } = payload;

      // สร้าง query: ถ้ามี search ให้ regex ที่ name
      const query = search?.trim()
        ? { name: { $regex: search.trim(), $options: "i" } }
        : {};

      // เลือก sort
      let sortOption = { updatedAt: -1 };
      if (sort === "name") sortOption = { name: 1 };
      // sort ตามจำนวนสมาชิกต้องคำนวณภายหลัง จึงใช้ recent/name ก่อน แล้วค่อยจัดลำดับในหน่วยความจำถ้าจำเป็น

      const pageNum = Number(page) > 0 ? Number(page) : 1;
      const limitNum = Math.min(Number(limit) || 20, 100); // กัน limit โหดเกิน

      // นับ total สำหรับหน้า
      const total = await GroupChat.countDocuments(query);

      // ดึงข้อมูลหน้าที่ต้องการ
      const docs = await GroupChat.find(query)
        .select("name createdBy members updatedAt") // ฟิลด์พอประมาณ
        .populate("createdBy", "fullName profilePic") // โชว์ชื่อคนสร้างได้
        .sort(sortOption)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

      // map เป็น DTO + คำนวณสถานะเสริม
      const me = socket.userId?.toString();
      let groups = docs.map((g) => {
        const memberIds = (g.members || []).map((m) => m.toString());
        const isMember = !!memberIds.find((id) => id === me);
        const memberCount = memberIds.length;
        const onlineCount = includeOnline
          ? getOnlineUsersInGroup(g._id.toString(), memberIds).length
          : undefined;

        return {
          _id: g._id,
          name: g.name,
          createdBy: g.createdBy, // { _id, fullName, profilePic } (จาก populate)
          memberCount,
          isMember,
          ...(includeOnline ? { onlineCount } : {}),
          updatedAt: g.updatedAt,
        };
      });

      // ถ้าขอ sort ตามจำนวนสมาชิก
      if (sort === "members") {
        groups = groups.sort((a, b) => b.memberCount - a.memberCount);
      }

      const hasNextPage = pageNum * limitNum < total;

      socket.emit("allGroupsResult", {
        groups,
        page: pageNum,
        limit: limitNum,
        total,
        hasNextPage,
      });
    } catch (error) {
      console.error("Error in getAllGroups:", error.message);
      socket.emit("allGroupsResult", { error: "Failed to fetch all groups" });
    }
  });

  // ✅ Get my groups
  socket.on("getMyGroups", async () => {
    try {
      const groups = await GroupChat.find({ members: userId }).sort({
        updatedAt: -1,
      });

      socket.emit("myGroupsHistory", { groups });
    } catch (error) {
      console.log("Error in getMyGroups:", error.message);
      socket.emit("myGroupsHistory", { error: "Failed to fetch groups" });
    }
  });

  // ✅ Get group messages (member-only)
  socket.on("getGroupMessages", async ({ groupId }) => {
    try {
      // ✅ REQUIREMENT: Verify user is a member
      const groupChat = await GroupChat.findById(groupId);
      if (!groupChat) {
        return socket.emit("groupMessagesHistory", {
          error: "Group chat not found",
        });
      }

      const isMember = groupChat.members.some((m) => m.toString() === userId);
      if (!isMember) {
        return socket.emit("groupMessagesHistory", {
          error: "You are not a member of this group",
        });
      }

      const messages = await GroupMessage.find({ groupId })
        .populate("senderId", "fullName profilePic")
        .sort({ createdAt: 1 });

      socket.emit("groupMessagesHistory", { messages, groupId });
    } catch (error) {
      console.log("Error in getGroupMessages socket handler:", error.message);
      socket.emit("groupMessagesHistory", {
        error: "Failed to fetch group messages",
      });
    }
  });

  // ✅ Send group message (member-only)
  socket.on("sendGroupMessage", async (messageData) => {
    try {
      const { groupId, text, image } = messageData;
      const senderId = userId;

      const groupChat = await GroupChat.findById(groupId);
      if (!groupChat) {
        return socket.emit("groupMessageSent", {
          error: "Group chat not found",
        });
      }

      const isMember = groupChat.members.some((m) => m.toString() === senderId);
      if (!isMember) {
        return socket.emit("groupMessageSent", {
          error: "You are not a member of this group",
        });
      }

      if (!text && !image) {
        return socket.emit("groupMessageSent", {
          error: "Text or image is required",
        });
      }

      let imageUrl;
      if (image) {
        try {
          const uploadResponse = await cloudinary.uploader.upload(image, {
            folder: "chat-app/group-messages",
            resource_type: "auto",
            transformation: [
              { width: 1024, height: 1024, crop: "limit" },
              { quality: "auto:good" },
              { fetch_format: "auto" },
            ],
            timeout: 60000,
          });
          imageUrl = uploadResponse.secure_url;
        } catch (uploadError) {
          console.error("Cloudinary upload error:", uploadError);
          return socket.emit("groupMessageSent", {
            error: "Failed to upload image",
          });
        }
      }

      const newMessage = new GroupMessage({
        senderId,
        groupId,
        text,
        image: imageUrl,
      });

      await newMessage.save();
      await newMessage.populate("senderId", "fullName profilePic");

      // ✅ ผู้ส่งต้อง join room นี้ไว้ก่อนหน้านี้ด้วย: socket.join(`group:${groupId}`)
      // ✅ กระจายให้สมาชิกคนอื่น (ไม่รวมผู้ส่ง)
      socket.to(`group:${groupId}`).emit("newGroupMessage", newMessage);

      // ✅ ส่ง ack ให้ "ผู้ส่ง" เท่านั้น
      socket.emit("groupMessageSent", { message: newMessage });

      console.log(
        `✅ Group message sent in ${groupChat.name} by ${userFullName}`
      );
    } catch (error) {
      console.log("Error in sendGroupMessage socket event:", error.message);
      socket.emit("groupMessageSent", {
        error: "Failed to send group message",
      });
    }
  });
  
  // ===== Room-only join/leave for group realtime =====
  socket.on("joinGroupRoom", ({ groupId }) => {
    if (!groupId) return;
    socket.join(`group:${groupId}`);
  });

  socket.on("leaveGroupRoom", ({ groupId }) => {
    if (!groupId) return;
    socket.leave(`group:${groupId}`);
  });

  // 1️⃣ ออกจากกรุ๊ป (ถ้าเป็นเจ้าของ → delete)
  socket.on("leaveGroup", async ({ groupId }) => {
    try {
      const group = await GroupChat.findById(groupId);
      if (!group)
        return socket.emit("groupActionError", { error: "Group not found" });

      const userId = socket.user._id.toString();
      const isOwner = group.createdBy.toString() === userId;

      if (isOwner) {
        // ลบกรุ๊ป + แจ้งสมาชิก
        await GroupChat.findByIdAndDelete(groupId);
        await GroupMessage.deleteMany({ groupId });
        io.emit("groupDeleted", { groupId });
      } else {
        // ลบตัวเองออกจาก members
        group.members = group.members.filter((m) => m.toString() !== userId);
        await group.save();
        io.emit("groupUpdated", {
          groupId,
          action: "leave",
          memberCount: group.members.length,
        });
      }
    } catch (err) {
      console.log("Error in leaveGroup:", err);
    }
  });

  // 2️⃣ ดึงสมาชิกทั้งหมดของกรุ๊ป
  socket.on("getGroupMembers", async (groupId) => {
    try {
      const group = await GroupChat.findById(groupId).populate(
        "members",
        "_id fullName username profilePic"
      );
      if (!group)
        return socket.emit("groupMembersError", { error: "Group not found" });
      socket.emit("groupMembersList", {
        groupId,
        members: group.members,
        memberCount: group.members.length,
      });
    } catch (err) {
      console.log("Error in getGroupMembers:", err);
    }
  });

  // 3️⃣ Realtime update member count (ใช้ emit จาก join/leave group)
  socket.on("joinGroup", async ({ groupId }) => {
    try {
      const group = await GroupChat.findById(groupId);
      if (!group)
        return socket.emit("groupActionError", { error: "Group not found" });

      const userId = socket.user._id.toString();
      const already = group.members.some((m) => m.toString() === userId);
      if (!already) {
        group.members.push(userId);
        await group.save();
        io.emit("groupUpdated", {
          groupId,
          action: "join",
          memberCount: group.members.length,
        });
      }
    } catch (err) {
      console.log("Error in joinGroup:", err);
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
        if (userTypingStatus[groupId][userId]?.timer) {
          clearTimeout(userTypingStatus[groupId][userId].timer);
        }

        userTypingStatus[groupId][userId] = {
          username,
          timer: setTimeout(() => {
            delete userTypingStatus[groupId][userId];
            socket.to(`group:${groupId}`).emit("user_stopped_typing_group", {
              groupId,
              userId,
            });
          }, 3000),
        };

        socket.to(`group:${groupId}`).emit("user_typing_group", {
          groupId,
          userId,
          username,
        });
      } else {
        if (userTypingStatus[groupId]?.[userId]?.timer) {
          clearTimeout(userTypingStatus[groupId][userId].timer);
        }
        delete userTypingStatus[groupId]?.[userId];

        socket.to(`group:${groupId}`).emit("user_stopped_typing_group", {
          groupId,
          userId,
        });
      }
    } catch (error) {
      console.error("Error handling typing status:", error);
    }
  });

  // ============================================
  // DISCONNECT EVENT
  // ============================================

  socket.on("disconnect", () => {
    console.log(`User ${userFullName} disconnected`, socket.id);

    if (userId) {
      delete userSocketMap[userId];
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
