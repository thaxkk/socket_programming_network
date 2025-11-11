// src/components/MyGroupList.jsx
import { useEffect, useMemo } from "react";
import { useGroupStore } from "@/store/useGroupStore";
import { useAuthStore } from "@/store/useAuthStore";
import GroupCard from "./GroupCard";

export default function MyGroupList() {
  const {
    myGroups,
    isMyGroupsLoading,
    currentMembers,
    currentMemberCount,
    getMyGroups,
    joinGroup,
    bindGroupSocketEvents,
    leaveGroupOrDelete,
    getGroupMembers,
    openGroup,
  } = useGroupStore();

  const authUser = useAuthStore((s) => s.authUser);

  useEffect(() => {
    bindGroupSocketEvents();
    getMyGroups();
  }, [bindGroupSocketEvents, getMyGroups]);

  const handleShowMembers = (groupId) => {
    getGroupMembers(groupId);
  };
  const handleLeaveOrDelete = (groupId) => {
    leaveGroupOrDelete(groupId);
  };
  const handleOpen = (group) => {
    openGroup(group);
  };
  const handleJoin = (groupId) => {
    joinGroup(groupId);
  };

  const getId = (v) => (typeof v === "string" ? v : v?._id);
  const nameSort = (a, b) =>
    (a?.name || "").localeCompare(b?.name || "", undefined, {
      sensitivity: "base",
    });

  const sortedMyGroups = useMemo(() => {
    const me = authUser?._id;
    const owned = [];
    const others = [];
    for (const g of myGroups || []) {
      if (getId(g?.createdBy) === me) owned.push(g);
      else others.push(g);
    }
    owned.sort(nameSort);
    others.sort(nameSort);
    return [...owned, ...others];
  }, [myGroups, authUser?._id]);

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-semibold text-neutral-700 mb-2">
          Your groups
        </h3>

        {isMyGroupsLoading ? (
          <div className="text-xs text-neutral-500">Loading groups…</div>
        ) : (sortedMyGroups || []).length === 0 ? (
          <div className="text-xs text-neutral-500">
            You haven’t joined any group yet.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedMyGroups.map((g) => (
              <GroupCard
                key={g._id}
                group={g}
                currentUserId={authUser?._id}
                onOpen={handleOpen}
                onShowMembers={handleShowMembers}
                onLeaveOrDelete={handleLeaveOrDelete}
                onJoin={handleJoin}
                members={currentMembers}
                memberCount={currentMemberCount}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
