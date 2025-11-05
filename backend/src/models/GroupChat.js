import mongoose from "mongoose";

const groupChatSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }],
  },
  { timestamps: true }
);

const GroupChat = mongoose.model("GroupChat", groupChatSchema);

export default GroupChat;