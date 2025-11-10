import { UsersIcon } from "lucide-react";

const NoGroupChatHistoryPlaceholder = ({ groupName }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="w-16 h-16 bg-gradient-to-br from-[#8A522E] to-[#8A522E] rounded-full flex items-center justify-center mb-5">
        <UsersIcon className="size-8 text-white" />
      </div>

      <h3 className="text-lg font-medium text-black mb-3">
        Start a conversation in{" "}
        <span className="text-[#8A522E]">{groupName}</span>
      </h3>

      <div className="flex flex-col space-y-3 max-w-md mb-5">
        <p className="text-slate-400 text-sm">
          This is the beginning of your group chat. Send a message to start the
          discussion!
        </p>
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-[#8A522E]/40 to-transparent mx-auto"></div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <button className="px-4 py-2 text-xs font-medium text-[#8A522E] bg-[#8A522E]/10 rounded-full hover:bg-[#8A522E]/20 transition-colors">
          👋 Say hello to everyone
        </button>
        <button className="px-4 py-2 text-xs font-medium text-[#8A522E] bg-[#8A522E]/10 rounded-full hover:bg-[#8A522E]/20 transition-colors">
          💡 Share an idea
        </button>
        <button className="px-4 py-2 text-xs font-medium text-[#8A522E] bg-[#8A522E]/10 rounded-full hover:bg-[#8A522E]/20 transition-colors">
          📢 Make an announcement
        </button>
      </div>
    </div>
  );
};

export default NoGroupChatHistoryPlaceholder;
