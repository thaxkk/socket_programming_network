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
      required: false, // Make optional for group messages
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupChat",
      required: false, // Optional for 1-on-1 messages
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    image: {
      type: String,
    },
  },
  { timestamps: true }
);

// Add validation: either receiverId or groupId must be present
messageSchema.pre("validate", function (next) {
  if (!this.receiverId && !this.groupId) {
    next(new Error("Either receiverId or groupId must be provided"));
  } else {
    next();
  }
});

const Message = mongoose.model("Message", messageSchema);

export default Message;
