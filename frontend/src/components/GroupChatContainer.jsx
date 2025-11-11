import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupStore } from "../store/useGroupStore";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import GroupChatHeader from "./GroupChatHeader";
import NoGroupChatHistoryPlaceholder from "./NoGroupChatHistoryPlaceholder";
import GroupMessageInput from "./GroupMessageInput";

export default function GroupChatContainer() {
  const { authUser } = useAuthStore();
  const {
    selectedGroup,
    getGroupMessages,
    groupMessages,
    isGroupMessagesLoading,
    subscribeGroupEvents,
    unsubscribeGroupEvents,
    groupTypingUsers,
  } = useGroupStore();

  const messageEndRef = useRef(null);

  useEffect(() => {
    if (!selectedGroup?._id) return;
    getGroupMessages(selectedGroup._id);
    subscribeGroupEvents(selectedGroup._id);
    return () => unsubscribeGroupEvents(selectedGroup._id);
  }, [
    selectedGroup?._id,
    getGroupMessages,
    subscribeGroupEvents,
    unsubscribeGroupEvents,
  ]);

  const messages = groupMessages[selectedGroup?._id] || [];
  const typingUsersObj = groupTypingUsers?.[selectedGroup?._id] || {};
  const typingUsers = Object.values(typingUsersObj);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const typingNames = Object.values(typingUsersObj)
    .filter(Boolean)
    .map((u) => u?.username || u?.fullName)
    .filter(Boolean);

  if (!selectedGroup?._id) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm opacity-70">Select a group to start chatting</p>
      </div>
    );
  }

  return (
    <>
      <GroupChatHeader group={selectedGroup} />

      <div className="px-4 sm:px-6 py-4 overflow-y-auto h-[calc(100vh-220px)]">
        {messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isMine =
                (typeof msg.senderId === "string" &&
                  msg.senderId === authUser?._id) ||
                (typeof msg.senderId === "object" &&
                  msg.senderId?._id === authUser?._id);

              const displayName = msg.senderId.fullName;
              const avatarUrl = msg.senderId.profilePic || "/avatar.png";

              return (
                <div
                  key={msg._id || `${msg.createdAt}-${Math.random()}`}
                  className={`chat ${isMine ? "chat-end" : "chat-start"}`}
                >
                  {!isMine && (
                    <div className="chat-image avatar">
                      <div className="w-10 rounded-full">
                        <img src={avatarUrl} alt={displayName || "avatar"} />
                      </div>
                    </div>
                  )}

                  <div
                    className={`chat-bubble relative ${
                      isMine
                        ? "bg-[#8A522E] text-white"
                        : "bg-[#A9CC9C] text-black"
                    }`}
                  >
                    {/* ชื่อผู้ส่ง (ถ้ามี) */}
                    {!isMine && displayName && (
                      <p className="text-xs font-semibold opacity-80 mb-1">
                        {displayName}
                      </p>
                    )}

                    {/* รูปภาพที่แนบมา */}
                    {msg.image && (
                      <img
                        src={msg.image}
                        alt="Shared"
                        className="rounded-lg h-48 object-cover"
                      />
                    )}

                    {/* ข้อความ */}
                    {msg.text && (
                      <p className="mt-1 whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {/* เวลา */}
                    <p className="text-[11px] mt-1 opacity-75">
                      {msg.createdAt
                        ? new Date(msg.createdAt).toLocaleTimeString(
                            undefined,
                            { hour: "2-digit", minute: "2-digit" }
                          )
                        : ""}
                    </p>
                  </div>
                </div>
              );
            })}

            <div ref={messageEndRef} />
          </div>
        ) : isGroupMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoGroupChatHistoryPlaceholder groupName={selectedGroup?.name} />
        )}
      </div>

      <GroupMessageInput
        groupId={selectedGroup?._id}
        placeholder={`Message ${selectedGroup?.name || "group"}...`}
      />
    </>
  );
}
