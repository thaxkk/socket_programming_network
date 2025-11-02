import mongoose from "mongoose";
import dotenv from "dotenv";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
import GroupMemberActivity from "../models/groupMemberActivity.js";

dotenv.config();

const createIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Group indexes
    await Group.collection.createIndex({ members: 1 });
    await Group.collection.createIndex({ createdAt: -1 });
    await Group.collection.createIndex({ updatedAt: -1 });
    console.log("Group indexes created");

    // Message indexes
    await Message.collection.createIndex({ groupId: 1, createdAt: -1 });
    await Message.collection.createIndex({ senderId: 1, receiverId: 1 });
    await Message.collection.createIndex({ createdAt: -1 });
    console.log("Message indexes created");

    // GroupMemberActivity indexes
    await GroupMemberActivity.collection.createIndex(
      { groupId: 1, userId: 1 },
      { unique: true }
    );
    console.log("GroupMemberActivity indexes created");

    console.log("All indexes created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error creating indexes:", error);
    process.exit(1);
  }
};

createIndexes();