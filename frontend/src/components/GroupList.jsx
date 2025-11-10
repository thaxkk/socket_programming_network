// src/components/GroupList.jsx
import { useEffect } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";

import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import CreateGroupButton from "./CreateGroupButton";

function GroupList() {
  const {
    getAllGroups,
    allGroups,
    isAllGroupsLoading,
    joinGroup,
    setSelectedGroup,
  } = useGroupStore();
  const { setSelectedUser } = useChatStore();

  useEffect(() => {
    getAllGroups();
  }, [getAllGroups]);

  if (isAllGroupsLoading) return <UsersLoadingSkeleton />;
  if (!allGroups || allGroups.length === 0)
    return <NoChatsFound message="No groups found" />;

  return (
    <>
      {allGroups.map((group) => {
        const count = group.memberCount ?? group.members?.length ?? 0;
        const myId = String(useChatStore.getState()?.authUser?._id || "");
        const joined = (group.members || []).some(
          (m) => String(m?._id ?? m) === myId
        );

        return (
          <div
            key={group._id}
            className="bg-[#8A522E]/20 p-4 rounded-lg cursor-pointer hover:bg-[#8A522E]/5 transition-colors"
            onClick={() => {
              setSelectedUser(null);
              if (joined) setSelectedGroup(group);
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#8A522E]/70 flex items-center justify-center text-white font-semibold">
                {group.name?.charAt(0).toUpperCase() || "G"}
              </div>
              <div className="flex-1">
                <h4 className="text-black font-medium truncate">
                  {group.name || group.groupName || "Unnamed Group"}
                </h4>
                <p className="text-sm text-gray-600">👥 {count} members</p>
              </div>
              <div className="flex-shrink-0">
                {joined ? (
                  <button
                    className="px-3 py-1 rounded-md bg-[#8A522E] text-white text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGroup(group);
                    }}
                  >
                    Open
                  </button>
                ) : (
                  <button
                    className="px-3 py-1 rounded-md border text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      joinGroup(group._id);
                    }}
                  >
                    Join
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default GroupList;
