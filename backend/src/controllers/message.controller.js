import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user?._id;
    if (!loggedInUserId)
      return res.status(401).json({ message: "Unauthorized" });

    const messages = await Message.find({
      receiverId: { $exists: true, $ne: null },
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    })
      .select("senderId receiverId")
      .lean();

    const me = String(loggedInUserId);
    const partnerIdSet = new Set();

    for (const m of messages) {
      const s = m?.senderId?.toString?.();
      const r = m?.receiverId?.toString?.();
      if (!s || !r) continue; 

      if (s === me) partnerIdSet.add(r);
      else if (r === me) partnerIdSet.add(s);
    }

    const partners = await User.find({
      _id: { $in: [...partnerIdSet] },
    }).select("-password");
    res.status(200).json(partners);
  } catch (error) {
    console.error("Error in getChatPartners:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
