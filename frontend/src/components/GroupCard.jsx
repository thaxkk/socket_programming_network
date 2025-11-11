// src/components/GroupCard.jsx (เฉพาะส่วนที่ใช้ Popover หลังแยกไฟล์แล้ว)
import { useEffect, useState } from "react";
import { Users as UsersIcon, LogOut, Trash2 } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";
import { useChatStore } from "../store/useChatStore";
import MembersPopover from "./MembersPopover";
import { Button } from "@/components/ui/button";

function getId(val) {
  return typeof val === "string" ? val : val?._id;
}
function extractMemberIds(group) {
  const candidates =
    group?.members ??
    group?.memberIds ??
    group?.participants ??
    group?.users ??
    [];
  return (candidates || []).map((m) => getId(m)).filter(Boolean);
}

export default function GroupCard({
  group,
  currentUserId,
  onOpen,
  onShowMembers, // จะถูกเรียกเวลา popover เปิด (ควร return Promise)
  onLeaveOrDelete,
  onJoin,
  forceIsMember,
  forceIsOwner,
  members, // currentMembers จาก store
  memberCount, // currentMemberCount จาก store
}) {
  const [joining, setJoining] = useState(false);
  const [justJoined, setJustJoined] = useState(false);
  const [justLeft, setJustLeft] = useState(false);

  const { setSelectedUser } = useChatStore();
  const { setSelectedGroup } = useGroupStore();

  const derivedOwner = getId(group?.createdBy) === currentUserId;
  const derivedMember =
    derivedOwner || extractMemberIds(group).includes(currentUserId);
  const isOwner =
    typeof forceIsOwner === "boolean" ? forceIsOwner : derivedOwner;
  const isMember =
    typeof forceIsMember === "boolean" ? forceIsMember : derivedMember;

  useEffect(() => {
    setJustJoined(false);
    setJustLeft(false);
  }, [isMember]);

  const effectiveMember = (isMember || justJoined) && !justLeft;
  const canOpen = effectiveMember;

  const handleOpen = () => {
    if (!group || !canOpen) return;
    onOpen?.(group);
    setSelectedGroup(group);
    setSelectedUser(null);
  };

  const handleLeaveOrDelete = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!group?._id) return;
    const ok = await onLeaveOrDelete?.(group._id, { isOwner });
    if (ok !== false) {
      setJustLeft(true);
      setJustJoined(false);
    }
  };
  const stopAll = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };
  const handleJoin = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!group?._id || joining) return;
    setJoining(true);
    const ok = await onJoin?.(group);
    setJoining(false);
    if (ok !== false) {
      setJustJoined(true);
      setJustLeft(false);
    }
  };

  return (
    <div
      onClick={handleOpen}
      className={`flex-shrink-0 w-65 snap-start flex flex-col justify-between p-3 rounded-xl border cursor-pointer transition
        ${
          isOwner
            ? "bg-red-50 border-red-200 hover:border-red-300"
            : "bg-emerald-50 border-emerald-200 hover:border-emerald-300"
        }`}
    >
      <div className="min-w-0 mb-3">
        <div className="font-medium truncate">{group.name}</div>
        <div className="text-xs text-neutral-600">
          {group.members?.length ?? group.memberCount ?? 0} member
          {(group.members?.length ?? group.memberCount ?? 0) === 1 ? "" : "s"}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <MembersPopover
          members={members}
          count={memberCount}
          side="top"
          align="start"
          sideOffset={8}
          onOpen={() => {
            if (group?._id) return onShowMembers?.(group._id); // ควร return Promise เพื่อให้ Popover รอโหลด
          }}
        />

        {effectiveMember ? (
          <button
            type="button"
            onClick={handleLeaveOrDelete}
            onPointerDown={stopAll}
            className={`px-2 py-1 rounded-lg text-xs text-white ${
              isOwner
                ? "bg-red-600 hover:bg-red-700"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
            title={isOwner ? "Delete group" : "Leave group"}
          >
            {isOwner ? (
              <>
                <Trash2 className="inline w-4 h-4 mr-1" />
                Delete
              </>
            ) : (
              <>
                <LogOut className="inline w-4 h-4 mr-1" />
                Leave
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleJoin}
            onPointerDown={stopAll}
            className="px-2 py-1 rounded-lg border text-xs hover:bg-neutral-100"
            title="Join group"
            disabled={joining}
          >
            {joining ? "Joining..." : "Join"}
          </button>
        )}
      </div>
    </div>
  );
}
