import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupStore } from "../store/useGroupStore";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import GroupChatHeader from "./GroupChatHeader";
import NoGroupChatHistoryPlaceholder from "./NoGroupChatHistoryPlaceholder";
import GroupMessageInput from "./GroupMessageInput";

export default function GroupChatContainer() {
  const {
    selectedGroup,
    getGroupMessages,
    groupMessages,
    isGroupMessagesLoading,
    subscribeGroupEvents,
    unsubscribeGroupEvents,
    groupTypingUsers,
    sendTypingInGroup,
    setSelectedGroup,
  } = useGroupStore();

  const { authUser } = useAuthStore();
  const [text, setText] = useState(""); // ใช้แค่ส่ง typing
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
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const typingUsersObj = groupTypingUsers[selectedGroup?._id] || {};
  const typingUsers = Object.values(typingUsersObj).filter(
    (n) => n && n !== authUser?.fullName
  );
  const typingText =
    typingUsers.length === 0
      ? ""
      : typingUsers.length === 1
      ? `${typingUsers[0]} is typing...`
      : "Multiple people are typing...";

  return (
    <>
      <GroupChatHeader
        group={selectedGroup}
        typingText={typingText}
        onClose={() => setSelectedGroup(null)}
      />

      <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6">
        {messages.length > 0 && !isGroupMessagesLoading ? (
          <div className="w-full space-y-6">
            {messages.map((msg) => {
              const isMine =
                (typeof msg.senderId === "string" &&
                  msg.senderId === authUser?._id) ||
                (typeof msg.senderId === "object" &&
                  msg.senderId?._id === authUser?._id);
              const displayName =
                typeof msg.senderId === "object" ? msg.senderId.fullName : "";

              return (
                <div
                  key={msg._id}
                  className={`chat ${isMine ? "chat-end" : "chat-start"}`}
                >
                  <div
                    className={`chat-bubble relative ${
                      isMine
                        ? "bg-[#8A522E] text-white"
                        : "bg-[#A9CC9C] text-black"
                    }`}
                  >
                    {!isMine && displayName && (
                      <p className="text-xs font-semibold opacity-80 mb-1">
                        {displayName}
                      </p>
                    )}
                    {msg.image && (
                      <img
                        src={msg.image}
                        alt="Shared"
                        className="rounded-lg h-48 object-cover"
                      />
                    )}
                    {msg.text && (
                      <p className="mt-1 whitespace-pre-wrap">{msg.text}</p>
                    )}
                    <p className="text-xs mt-1 opacity-75">
                      {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>
        ) : isGroupMessagesLoading && messages.length === 0 ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoGroupChatHistoryPlaceholder groupName={selectedGroup?.name} />
        )}
      </div>

      <div className="pb-6 px-4 sm:px-6">
        <div className="w-full">
          <GroupMessageInput
            groupId={selectedGroup?._id}
            placeholder={`Message ${selectedGroup?.name || "group"}...`}
          />
        </div>
      </div>
    </>
  );
}
