import { XIcon, UsersIcon } from "lucide-react";

export default function GroupChatHeader({ group, typingText = "", onClose }) {
  const memberCount = group?.members?.length ?? group?.memberCount ?? 0;

  return (
    <div
      className="flex justify-between items-center bg-[#8A522E]/40 border-b
     border-slate-700/50 max-h-[84px] px-6 flex-1"
    >
      <div className="flex items-center space-x-3">
        {/* Avatar / Icon */}
        <div className="w-12 h-12 rounded-full bg-[#8A522E]/70 flex items-center justify-center text-white font-semibold">
          {group?.name?.charAt(0).toUpperCase() || "G"}
        </div>

        {/* Info */}
        <div className="min-w-0">
          <h3 className="text-black font-medium truncate">
            {group?.name || "Group Chat"}
          </h3>
          <p className="text-black/50 text-sm truncate flex items-center gap-1">
            <UsersIcon className="w-4 h-4 inline-block text-[#8A522E]" />
            {memberCount} member{memberCount === 1 ? "" : "s"}
            {typingText && (
              <span className="ml-2 text-[#8A522E]">{typingText}</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onClose && (
          <button onClick={onClose}>
            <XIcon className="w-5 h-5 text-black hover:text-slate-500 transition-colors cursor-pointer" />
          </button>
        )}
      </div>
    </div>
  );
}
