import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],

  activeTab: "chats",
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedUser: (selectedUser) => set({ selectedUser }),
  setSelectedGroup: (selectedGroup) => set({ selectedGroup }),

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },
  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chats: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // ✅ CHANGED: Using Socket.IO instead of HTTP
  getMessagesByUserId: (userId) => {
    set({ isMessagesLoading: true });
    const socket = useAuthStore.getState().socket;

    if (!socket) {
      toast.error("Socket connection not available");
      set({ isMessagesLoading: false });
      return;
    }

    // Emit request to get messages
    socket.emit("getMessages", { userId });

    // Listen for response (one-time listener)
    socket.once("messagesHistory", (data) => {
      if (data.error) {
        toast.error(data.error);
        set({ messages: [] });
      } else {
        set({ messages: data.messages || [] });
      }
      set({ isMessagesLoading: false });
    });

    // Handle timeout
    setTimeout(() => {
      if (get().isMessagesLoading) {
        set({ isMessagesLoading: false });
        toast.error("Failed to load messages");
      }
    }, 10000);
  },

  // ✅ CHANGED: Using Socket.IO instead of HTTP
  sendMessage: (messageData) => {
    const { selectedUser, messages } = get();
    const { authUser } = useAuthStore.getState();
    const socket = useAuthStore.getState().socket;

    if (!socket) {
      toast.error("Socket connection not available");
      return;
    }

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // Immediately update UI
    set({ messages: [...messages, optimisticMessage] });

    // Emit message via socket
    socket.emit("sendMessage", {
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
    });

    // Listen for confirmation (one-time listener)
    socket.once("messageSent", (data) => {
      if (data.error) {
        // Remove optimistic message on failure
        set({ messages: messages.filter((msg) => msg._id !== tempId) });
        toast.error(data.error);
      } else {
        // Replace optimistic message with real one
        set({
          messages: messages
            .filter((msg) => msg._id !== tempId)
            .concat(data.message),
        });
      }
    });

    // Handle timeout
    setTimeout(() => {
      const currentMessages = get().messages;
      if (currentMessages.some((msg) => msg._id === tempId)) {
        set({ messages: messages.filter((msg) => msg._id !== tempId) });
        toast.error("Failed to send message");
      }
    }, 10000);
  },

  subscribeToMessages: () => {
    const { selectedUser, isSoundEnabled } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentFromSelectedUser =
        newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      const currentMessages = get().messages;
      set({ messages: [...currentMessages, newMessage] });

      if (isSoundEnabled) {
        const notificationSound = new Audio("/sounds/notification.mp3");

        notificationSound.currentTime = 0; // reset to start
        notificationSound
          .play()
          .catch((e) => console.log("Audio play failed:", e));
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
  },
}));
