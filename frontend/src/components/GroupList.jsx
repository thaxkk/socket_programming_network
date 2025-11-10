// src/components/GroupList.jsx
import { useEffect } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore"; // ⬅️ เพิ่ม

import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import CreateGroupButton from "./CreateGroupButton";

function GroupList() {
  const { getAllGroups, myGroups, isMyGroupsLoading, setSelectedGroup } =
    useGroupStore();
  const { setSelectedUser } = useChatStore(); // ⬅️ เพิ่ม

  useEffect(() => {
    getAllGroups();
  }, [getAllGroups]);

  if (isMyGroupsLoading) return <UsersLoadingSkeleton />;
  if (!myGroups || myGroups.length === 0)
    return <NoChatsFound message="No groups found" />;

  return (
    <>
      {myGroups.map((group) => (
        <div
          key={group._id}
          className="bg-[#8A522E]/20 p-4 rounded-lg cursor-pointer hover:bg-[#8A522E]/5 transition-colors"
          onClick={() => {
            setSelectedUser(null); // ⬅️ เคลียร์ DM
            setSelectedGroup(group); // ⬅️ ตั้ง Group
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
              <p className="text-sm text-gray-600">
                👥 {group.members?.length || group.memberCount || 1} members
              </p>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
export default GroupList;
