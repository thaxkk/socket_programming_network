import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

/**
 * EVENT NAMES (ต้องตรงกับฝั่ง BE)
 * - getAllGroups           -> allGroupsResult
 * - getMyGroups            -> myGroupsHistory
 * - createGroupChat        -> groupChatCreated
 * - joinGroup              -> joinedGroup
 * - getGroupMessages       -> groupMessagesHistory
 * - sendGroupMessage       -> groupMessageSent
 * - newGroupMessage        (push real-time)
 * - user_typing_group / user_stopped_typing_group
 */

export const useGroupStore = create((set, get) => ({
  // ---------- UI/Selections ----------
  selectedGroup: null, // {_id, name, ...}
  setSelectedGroup: (g) => set({ selectedGroup: g }),
  currentMembers: [],
  currentMemberCount: 0,

  // ---------- Discovery / All Groups ----------
  allGroups: [], // รายการทุกกรุ๊ป (หน้า discover)
  allGroupsPage: 1,
  allGroupsLimit: 20,
  allGroupsTotal: 0,
  allGroupsHasNextPage: false,
  allGroupsSearch: "",
  allGroupsSort: "recent", // "recent" | "name" | "members"
  includeOnline: true,

  isAllGroupsLoading: false,

  // ---------- My Groups ----------
  myGroups: [], // เฉพาะกรุ๊ปที่เราเป็นสมาชิก
  isMyGroupsLoading: false,

  // ---------- Messages per group ----------
  // เก็บเป็น map: { [groupId]: Message[] }
  groupMessages: {},
  isGroupMessagesLoading: false,

  // ---------- Typing indicators ----------
  groupTypingUsers: {}, // { [groupId]: { [userId]: username } }

  // เก็บว่า group ไหนสมัครอยู่บ้าง (กัน subscribe ซ้ำ)
  _subscribedGroupIds: new Set(),
  _listeners: undefined, // เก็บ reference ของ global listeners (กัน off ผิด)

  // =======================================================
  // Helpers
  // =======================================================
  _ensureSocket() {
    const socket = useAuthStore.getState().socket;
    if (!socket) {
      toast.error("Socket connection not available");
      return null;
    }
    return socket;
  },

  // =======================================================
  // DISCOVERY: GET ALL GROUPS (search + pagination + sort)
  // =======================================================
  setAllGroupsQuery: ({ search, sort, limit }) => {
    const s = search !== undefined ? search : get().allGroupsSearch;
    const so = sort || get().allGroupsSort;
    const l = limit || get().allGroupsLimit;
    set({ allGroupsSearch: s, allGroupsSort: so, allGroupsLimit: l });
  },

  getAllGroups: ({ page, search, sort, limit } = {}) => {
    const socket = get()._ensureSocket();
    if (!socket) return;

    const payload = {
      page: Number(page ?? get().allGroupsPage) || 1,
      limit: Number(limit ?? get().allGroupsLimit) || 20,
      search: search ?? get().allGroupsSearch ?? "",
      sort: sort ?? get().allGroupsSort,
      includeOnline: get().includeOnline,
    };

    set({ isAllGroupsLoading: true });

    // ป้องกันซ้อนหลายรอบ: ใช้ once
    socket.emit("getAllGroups", payload);
    socket.once("allGroupsResult", (res) => {
      if (res?.error) {
        toast.error(res.error || "Failed to fetch groups");
        set({
          isAllGroupsLoading: false,
          allGroups: [],
          allGroupsTotal: 0,
          allGroupsHasNextPage: false,
        });
        return;
      }

      set({
        isAllGroupsLoading: false,
        allGroups: res.groups || [],
        allGroupsPage: res.page ?? payload.page,
        allGroupsLimit: res.limit ?? payload.limit,
        allGroupsTotal: res.total ?? 0,
        allGroupsHasNextPage: !!res.hasNextPage,
      });
    });

    // timeout กันค้าง
    setTimeout(() => {
      if (get().isAllGroupsLoading) {
        set({ isAllGroupsLoading: false });
        toast.error("Failed to load groups");
      }
    }, 10000);
  },

  // =======================================================
  // MY GROUPS
  // =======================================================
  getMyGroups: () => {
    const socket = get()._ensureSocket();
    if (!socket) return;

    set({ isMyGroupsLoading: true });
    socket.emit("getMyGroups");

    socket.once("myGroupsHistory", (res) => {
      if (res?.error) {
        toast.error(res.error);
        set({ myGroups: [], isMyGroupsLoading: false });
        return;
      }
      set({
        myGroups: res.groups || [],
        isMyGroupsLoading: false,
      });
    });

    setTimeout(() => {
      if (get().isMyGroupsLoading) {
        set({ isMyGroupsLoading: false });
        toast.error("Failed to load my groups");
      }
    }, 10000);
  },

  // =======================================================
  // CREATE GROUP
  // =======================================================
  createGroup: (name) => {
    const socket = get()._ensureSocket();
    if (!socket) return;

    if (!name || !name.trim()) {
      toast.error("Group name is required");
      return;
    }

    socket.emit("createGroupChat", { name: name.trim() });

    socket.once("groupChatCreated", (res) => {
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      const group = res.group;
      toast.success(`Group "${group?.name}" created`);

      // อัปเดต myGroups/selectedGroup ตามสะดวก
      const myGroups = get().myGroups || [];
      set({ myGroups: [group, ...myGroups] });

      // auto select group
      set({ selectedGroup: group });
    });
  },

  // =======================================================
  // JOIN GROUP
  // =======================================================
  joinGroup: (groupId) => {
    const socket = get()._ensureSocket();
    if (!socket) return;

    socket.emit("joinGroup", { groupId });

    socket.once("joinedGroup", (res) => {
      if (res?.error) {
        toast.error(res.error);
        return;
      }

      // อัปเดต myGroups
      const joined = res.group;
      toast.success(res.message || "Joined group");
      const existing = get().myGroups || [];
      const exists = existing.find((g) => g._id === joined._id);
      const next = exists ? existing : [joined, ...existing];

      set({ myGroups: next });

      // auto select group
      set({ selectedGroup: joined });
    });
  },

  // =======================================================
  // OPEN GROUP (select + fetch messages)
  // =======================================================
  openGroup: (group) => {
    if (!group) return;
    set({ selectedGroup: group });

    // ถ้ายังไม่เคย fetch ข้อความ ก็ไปดึงมา
    const cached = get().groupMessages[group._id];
    if (!cached || cached.length === 0) {
      get().getGroupMessages(group._id);
    }
  },

  // =======================================================
  // LEAVE GROUP (ถ้าเป็นเจ้าของฝั่ง BE จะลบกรุ๊ป)
  // =======================================================
  leaveGroupOrDelete: (groupId) => {
    const socket = get()._ensureSocket();
    if (!socket) return;

    // อัปเดตฝั่ง FE ทันที (optimistic): เอากรุ๊ปออกจาก myGroups และ unselect
    set((s) => ({
      myGroups: (s.myGroups || []).filter((g) => g._id !== groupId),
      selectedGroup: s.selectedGroup?._id === groupId ? null : s.selectedGroup,
    }));

    socket.emit("leaveGroup", { groupId });
    // ผลลัพธ์จริงจะมากับ "groupUpdated"/"groupDeleted" (ฟังใน global listeners ด้านล่าง)
  },

  // =======================================================
  // GET GROUP MEMBERS (เปิด modal รายชื่อ)
  // =======================================================
  getGroupMembers: (groupId) => {
    const socket = get()._ensureSocket();
    if (!socket) return;
    socket.emit("getGroupMembers", groupId);
    // ผลลัพธ์จริงจะมากับ "groupMembersList" (ฟังใน global listeners ด้านล่าง)
  },

  // =======================================================
  // GET GROUP MESSAGES
  // =======================================================
  getGroupMessages: (groupId) => {
    const socket = get()._ensureSocket();
    if (!socket) return;

    set({ isGroupMessagesLoading: true });

    socket.emit("getGroupMessages", { groupId });

    socket.once("groupMessagesHistory", (res) => {
      if (res?.error) {
        toast.error(res.error);
        set({ isGroupMessagesLoading: false });
        return;
      }
      const { messages = [], groupId: gid } = res || {};
      set((state) => ({
        groupMessages: {
          ...state.groupMessages,
          [gid || groupId]: messages,
        },
        isGroupMessagesLoading: false,
      }));
    });

    setTimeout(() => {
      if (get().isGroupMessagesLoading) {
        set({ isGroupMessagesLoading: false });
        toast.error("Failed to load group messages");
      }
    }, 10000);
  },

  // =======================================================
  // SEND GROUP MESSAGE (optimistic UI)
  // =======================================================
  sendGroupMessage: ({ groupId, text, image }) => {
    const socket = get()._ensureSocket();
    if (!socket) return;

    const { authUser } = useAuthStore.getState();

    if (!groupId) {
      toast.error("No group selected");
      return;
    }

    if (!text && !image) {
      toast.error("Text or image is required");
      return;
    }

    const { groupMessages } = get();
    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      groupId,
      text,
      image,
      senderId: { _id: authUser._id, fullName: authUser.fullName },
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // ✅ Immediately update UI (optimistic)
    set((state) => {
      const prev = state.groupMessages[groupId] || [];
      return {
        groupMessages: {
          ...state.groupMessages,
          [groupId]: [...prev, optimisticMessage],
        },
      };
    });

    // ✅ Emit message via socket
    socket.emit("sendGroupMessage", {
      groupId,
      text,
      image,
    });

    // ✅ Listen for confirmation (one-time listener)
    socket.once("groupMessageSent", (res) => {
      if (res?.error) {
        // ❌ Remove optimistic message on failure
        set((state) => {
          const prev = state.groupMessages[groupId] || [];
          return {
            groupMessages: {
              ...state.groupMessages,
              [groupId]: prev.filter((msg) => msg._id !== tempId),
            },
          };
        });
        toast.error(res.error);
        return;
      }

      // ✅ Replace optimistic message with real one
      const realMsg = res.message;
      set((state) => {
        const prev = state.groupMessages[groupId] || [];
        return {
          groupMessages: {
            ...state.groupMessages,
            [groupId]: [...prev.filter((msg) => msg._id !== tempId), realMsg],
          },
        };
      });
    });

    // ✅ Handle timeout (10s fallback)
    setTimeout(() => {
      const current = get().groupMessages[groupId] || [];
      if (current.some((msg) => msg._id === tempId)) {
        set((state) => {
          const prev = state.groupMessages[groupId] || [];
          return {
            groupMessages: {
              ...state.groupMessages,
              [groupId]: prev.filter((msg) => msg._id !== tempId),
            },
          };
        });
        toast.error("Failed to send group message");
      }
    }, 10000);
  },

  // =======================================================
  // REAL-TIME SUBSCRIPTIONS (newGroupMessage, typing)
  // =======================================================
  subscribeGroupEvents: (groupId) => {
    const socket = get()._ensureSocket();
    if (!socket || !groupId) return;

    // กันสมัครซ้ำ group เดิม
    if (get()._subscribedGroupIds?.has(groupId)) return;

    // ลบ handler เดิมก่อนเสมอ แล้วค่อย on ใหม่ (กันซ้อน)
    socket.off("newGroupMessage");
    socket.off("user_typing_group");
    socket.off("user_stopped_typing_group");

    // ---- new group messages ----
    const onNewGroupMessage = (msg) => {
      const gid = msg.groupId || msg.group?._id;
      if (!gid) return;

      // เก็บ cache ทุกห้อง แต่ dedupe ด้วย _id / clientId
      set((state) => {
        const prev = state.groupMessages[gid] || [];
        const already = prev.some(
          (m) =>
            (msg?._id && m._id === msg._id) ||
            (msg?.clientId && m.clientId === msg.clientId)
        );
        if (already) return {}; // ไม่อัปเดต

        return {
          groupMessages: { ...state.groupMessages, [gid]: [...prev, msg] },
        };
      });
    };

    // ---- typing indicators ----
    const onTyping = ({ groupId: gid, userId, username }) => {
      if (!gid) return;
      set((state) => {
        const g = { ...(state.groupTypingUsers[gid] || {}) };
        g[userId || username || "unknown"] = username || "Someone";
        return {
          groupTypingUsers: { ...state.groupTypingUsers, [gid]: g },
        };
      });
    };

    const onStopTyping = ({ groupId: gid, userId, username }) => {
      if (!gid) return;
      set((state) => {
        const g = { ...(state.groupTypingUsers[gid] || {}) };
        delete g[userId || username || "unknown"];
        return {
          groupTypingUsers: { ...state.groupTypingUsers, [gid]: g },
        };
      });
    };

    socket.on("newGroupMessage", onNewGroupMessage);
    socket.on("user_typing_group", onTyping);
    socket.on("user_stopped_typing_group", onStopTyping);

    // เก็บ listener refs + mark subscribed
    set((s) => ({
      _listeners: { onNewGroupMessage, onTyping, onStopTyping },
      _subscribedGroupIds: new Set([...(s._subscribedGroupIds || []), groupId]),
    }));
  },

  unsubscribeGroupEvents: (groupId) => {
    const socket = get()._ensureSocket();
    if (!socket) return;

    const listeners = get()._listeners || {};
    if (listeners.onNewGroupMessage)
      socket.off("newGroupMessage", listeners.onNewGroupMessage);
    if (listeners.onTyping) socket.off("user_typing_group", listeners.onTyping);
    if (listeners.onStopTyping)
      socket.off("user_stopped_typing_group", listeners.onStopTyping);

    // เอา groupId ออกจากชุดที่กำลัง subscribe
    set((s) => {
      const next = new Set(s._subscribedGroupIds || []);
      if (groupId) next.delete(groupId);
      return { _subscribedGroupIds: next, _listeners: undefined };
    });
  },

  // =======================================================
  // GLOBAL GROUP EVENTS (memberCount realtime / delete / members list)
  // =======================================================
  bindGroupSocketEvents: () => {
    const socket = get()._ensureSocket();
    if (!socket) return;

    // กันซ้อน: ถ้ามี listeners เก่าอยู่ ให้ off ก่อน
    socket.off("groupUpdated");
    socket.off("groupDeleted");
    socket.off("groupMembersList");

    // 1) อัปเดตจำนวนสมาชิกแบบ realtime
    const onGroupUpdated = ({ groupId, memberCount, action }) => {
      set((s) => {
        const updateCount = (arr) =>
          Array.isArray(arr)
            ? arr.map((g) => (g._id === groupId ? { ...g, memberCount } : g))
            : arr;
        return {
          myGroups: updateCount(s.myGroups),
          allGroups: updateCount(s.allGroups),
        };
      });
    };
    // 2) เจ้าของลบกรุ๊ป → เคลียร์ออกจาก list + unselect ถ้าตรง
    const onGroupDeleted = ({ groupId }) => {
      set((s) => ({
        myGroups: (s.myGroups || []).filter((g) => g._id !== groupId),
        allGroups: (s.allGroups || []).filter((g) => g._id !== groupId),
        selectedGroup:
          s.selectedGroup?._id === groupId ? null : s.selectedGroup,
      }));
    };

    // 3) รายชื่อสมาชิกทั้งหมด (จาก getGroupMembers)
    const onGroupMembersList = ({ groupId, members, memberCount }) => {
      set({
        currentMembers: members || [],
        currentMemberCount: memberCount || 0,
      });
    };

    socket.on("groupUpdated", onGroupUpdated);
    socket.on("groupDeleted", onGroupDeleted);
    socket.on("groupMembersList", onGroupMembersList);

    set({ _listeners: { onGroupUpdated, onGroupDeleted, onGroupMembersList } });
  },
}));
