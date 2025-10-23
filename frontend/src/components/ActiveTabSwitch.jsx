import { useChatStore } from "../store/useChatStore";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();

  return (
    <div className="tabs tabs-boxed bg-transparent p-2 m-2">
      <button
        onClick={() => setActiveTab("chats")}
        className={`tab ${
          activeTab === "chats" ? "bg-[#8A522E]/20 text-[#8A522E]" : "text-slate-400"
        }`}
      >
        All Chats
      </button>

      <button
        onClick={() => setActiveTab("contacts")}
        className={`tab ${
          activeTab === "contacts" ? "bg-[#8A522E]/20 text-[#8A522E]" : "text-slate-400"
        }`}
      >
        Individual
      </button>

      <button
        onClick={() => setActiveTab("groups")}
        className={`tab ${
          activeTab === "groups" ? "bg-[#8A522E]/20 text-[#8A522E]" : "text-slate-400"
        }`}
      >
        Groups
      </button>
    </div>
  );
}
export default ActiveTabSwitch;
