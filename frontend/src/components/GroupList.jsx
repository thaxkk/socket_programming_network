import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";

function GroupList() {
  const { getMyGroups, groups, isGroupsLoading, setSelectedGroup } = useChatStore();

  useEffect(() => {
    getMyGroups();
  }, [getMyGroups]);

  if (isGroupsLoading) return <UsersLoadingSkeleton />;
  if (groups.length === 0) return <NoChatsFound message="No groups found" />;

  return (
    <>
      {groups.map((group) => (
        <div
          key={group._id}
          className="bg-[#8A522E]/20 p-4 rounded-lg cursor-pointer hover:bg-[#8A522E]/5 transition-colors"
          onClick={() => setSelectedGroup(group)}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#8A522E]/70 flex items-center justify-center text-white font-semibold">
              {group.groupName?.charAt(0).toUpperCase() || "G"}
            </div>
            <h4 className="text-black font-medium truncate">{group.groupName}</h4>
          </div>
        </div>
      ))}
    </>
  );
}

export default GroupList;
