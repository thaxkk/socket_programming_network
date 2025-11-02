import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Not required for group messages
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: false, // Required for group messages
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    // Track who has read the message in groups
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

// Validation: message must have either receiverId or groupId
messageSchema.pre("save", function (next) {
  if (!this.receiverId && !this.groupId) {
    next(new Error("Message must have either receiverId or groupId"));
  } else if (this.receiverId && this.groupId) {
    next(new Error("Message cannot have both receiverId and groupId"));
  } else {
    next();
  }
});

// Indexes for better query performance
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ groupId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;