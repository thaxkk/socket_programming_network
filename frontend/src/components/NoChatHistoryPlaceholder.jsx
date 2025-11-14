import { MessageCircleIcon } from "lucide-react";

const NoChatHistoryPlaceholder = ({ name }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="w-16 h-16 bg-gradient-to-br from-[#8A522E] to-[#8A522E] rounded-full flex items-center justify-center mb-5">
        <MessageCircleIcon className="size-8 text-white" />
      </div>
      <h3 className="text-lg font-medium text-black mb-3">
        Start your conversation with {name}
      </h3>
      <div className="flex flex-col space-y-3 max-w-md mb-5">
        <p className="text-slate-400 text-sm">
          This is the beginning of your conversation. Send a message to start chatting!
        </p>
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-[#8A522E]/30 to-transparent mx-auto"></div>
      </div>
      
    </div>
  );
};

export default NoChatHistoryPlaceholder;
