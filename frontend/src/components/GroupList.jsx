// src/components/GroupList.jsx
import { useEffect, useMemo } from "react";
import { useGroupStore } from "@/store/useGroupStore";
import { useAuthStore } from "@/store/useAuthStore";
import MembersModal from "./MemberModal";
import GroupCard from "./GroupCard";

export default function GroupList() {
  const {
    myGroups,
    allGroups,
    isMyGroupsLoading,
    isAllGroupsLoading,
    currentMembers,
    currentMemberCount,
    getMyGroups,
    getAllGroups,
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
    getAllGroups();
  }, [bindGroupSocketEvents, getMyGroups, getAllGroups]);

  const myGroupIdSet = useMemo(
    () => new Set((myGroups || []).map((g) => g._id)),
    [myGroups]
  );

  const handleShowMembers = (groupId) => {
    getGroupMembers(groupId);
  };

  const handleLeaveOrDelete = (groupId) => {
    leaveGroupOrDelete(groupId);
  };

  const handleOpen = (group) => {
    openGroup(group);
  };

  const handleJoin = async (group) => {
    joinGroup(group._id);
  };

  const loading = isMyGroupsLoading || isAllGroupsLoading;
  const displayGroups =
    allGroups && allGroups.length > 0 ? allGroups : myGroups || [];

  const getId = (v) => (typeof v === "string" ? v : v?._id);

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-semibold text-neutral-700 mb-2">Groups</h3>

        {loading ? (
          <div className="text-xs text-neutral-500">Loading groups…</div>
        ) : (displayGroups || []).length === 0 ? (
          <div className="text-xs text-neutral-500">No groups found.</div>
        ) : (
          <div className="space-y-3">
            {(displayGroups || []).map((g) => {
              const isOwner = getId(g?.createdBy) === authUser?._id;
              const isMember = isOwner || myGroupIdSet.has(g._id);
              return (
                <GroupCard
                  key={g._id}
                  group={g}
                  currentUserId={authUser?._id}
                  onOpen={handleOpen}
                  onShowMembers={handleShowMembers}
                  onLeaveOrDelete={handleLeaveOrDelete}
                  onJoin={() => handleJoin(g)}
                  forceIsMember={isMember}
                  forceIsOwner={isOwner}
                  members={currentMembers}
                  memberCount={currentMemberCount}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
