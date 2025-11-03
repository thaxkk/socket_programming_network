import mongoose from "mongoose";

const groupMemberActivitySchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index for faster queries
groupMemberActivitySchema.index({ groupId: 1, userId: 1 }, { unique: true });

const GroupMemberActivity = mongoose.model(
  "GroupMemberActivity",
  groupMemberActivitySchema
);

export default GroupMemberActivity;