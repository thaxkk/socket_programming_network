import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";

import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ContactList from "../components/ContactList";
import ChatContainer from "../components/ChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";
import GroupList from "../components/GroupList";
import MyAllChat from "../components/MyAllChat";
import GroupChatContainer from "../components/GroupChatContainer";
import CreateGroupButton from "../components/CreateGroupButton";

function ChatPage() {
  const { activeTab, selectedUser } = useChatStore();
  const { selectedGroup } = useGroupStore();

  return (
    <div className="relative w-full max-w-6xl h-[700px] flex shadow-xl shadow-slate-800/40 rounded-2xl overflow-hidden">
      {/* LEFT SIDE */}
      <div className="w-96 bg-white backdrop-blur-sm flex flex-col">
        <ProfileHeader />
        <ActiveTabSwitch />

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeTab === "chats" ? (
            <MyAllChat />
          ) : activeTab === "contacts" ? (
            <ContactList />
          ) : activeTab === "groups" ? (
            <GroupList />
          ) : null}
        </div>
        {activeTab === "groups" && (
          <div className="absolute bottom-4 right-4">
            <CreateGroupButton />
          </div>
        )}
      </div>

      {/* RIGHT SIDE */}
      <div className="flex-1 flex flex-col bg-white/40 backdrop-blur-sm">
        {activeTab === "groups" ? (
          selectedGroup ? (
            <GroupChatContainer />
          ) : (
            <NoConversationPlaceholder />
          )
        ) : selectedUser ? (
          <ChatContainer />
        ) : (
          <NoConversationPlaceholder />
        )}
      </div>
    </div>
  );
}
export default ChatPage;
