import { useEffect } from "react";
import { useGroupStore } from "@/store/useGroupStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Users as UsersIcon, LogOut, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function MyGroupList() {
  const {
    myGroups,
    isMyGroupsLoading,
    currentMembers,
    currentMemberCount,
    getMyGroups,
    bindGroupSocketEvents,
    leaveGroupOrDelete,
    getGroupMembers,
    openGroup,
  } = useGroupStore();

  const authUser = useAuthStore((s) => s.authUser);

  // โหลดข้อมูล + bind realtime ครั้งแรก
  useEffect(() => {
    bindGroupSocketEvents();
    getMyGroups();
  }, [bindGroupSocketEvents, getMyGroups]);

  const GroupRow = ({ g }) => {
    const isOwner = g?.createdBy === authUser?._id;

    const handleMembers = (e) => {
      e.stopPropagation();
      if (!g?._id) return;
      getGroupMembers(g._id);
      const ev = new CustomEvent("open-members-modal");
      window.dispatchEvent(ev);
    };

    const handleLeaveOrDelete = (e) => {
      e.stopPropagation();
      leaveGroupOrDelete(g._id);
    };

    const handleOpen = () => {
      if (!g) return;
      openGroup(g);
    };

    return (
      <div
        onClick={handleOpen}
        className={`flex-shrink-0 w-64 snap-start flex flex-col justify-between p-3 rounded-xl border cursor-pointer transition
          ${
            isOwner
              ? "bg-red-50 border-red-200 hover:border-red-300"
              : "bg-emerald-50 border-emerald-200 hover:border-emerald-300"
          }`}
      >
        <div className="min-w-0 mb-3">
          <div className="font-medium truncate">{g.name}</div>
          <div className="text-xs text-neutral-600">
            {g.memberCount ?? 0} member{(g.memberCount ?? 0) === 1 ? "" : "s"}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handleMembers}
            className="px-2 py-1 rounded-lg border text-xs hover:bg-neutral-100"
            title="Show members"
          >
            <UsersIcon className="inline w-4 h-4 mr-1" />
            Members
          </button>

          <button
            onClick={handleLeaveOrDelete}
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
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-semibold text-neutral-700 mb-2">
          Your groups
        </h3>

        {isMyGroupsLoading ? (
          <div className="text-xs text-neutral-500">Loading groups…</div>
        ) : (myGroups || []).length === 0 ? (
          <div className="text-xs text-neutral-500">
            You haven’t joined any group yet.
          </div>
        ) : (
          // ✅ แนวนอนแบบ scroll ได้
          <div className="space-y-3">
            {myGroups.map((g) => (
              <GroupRow key={g._id} g={g} />
            ))}
          </div>
        )}
      </section>

      <MembersModal members={currentMembers} count={currentMemberCount} />
    </div>
  );
}

function MembersModal({ members, count }) {
  useEffect(() => {
    const open = () => document.getElementById("members-modal")?.showModal?.();
    window.addEventListener("open-members-modal", open);
    return () => window.removeEventListener("open-members-modal", open);
  }, []);

  return (
    <dialog id="members-modal" className="rounded-2xl p-0">
      <form method="dialog" className="p-4 w-96">
        <h4 className="font-semibold mb-3">Group members ({count || 0})</h4>
        <div className="space-y-2 max-h-80 overflow-auto">
          {(members || []).map((m) => (
            <div key={m._id} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-neutral-200 overflow-hidden">
                {m.profilePic || m.avatar ? (
                  <img
                    className="w-full h-full object-cover"
                    src={m.profilePic || m.avatar}
                    alt={m.fullName || m.username || "user"}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs">
                    {(m.fullName || m.username || "U")[0]?.toUpperCase?.() ??
                      "U"}
                  </div>
                )}
              </div>
              <div className="text-sm truncate">{m.fullName || m.username}</div>
            </div>
          ))}
          {(members || []).length === 0 && (
            <div className="text-xs text-neutral-500">No members</div>
          )}
        </div>
        <div className="mt-4 text-right">
          <button className="px-3 py-1 rounded-lg border text-sm">Close</button>
        </div>
      </form>
    </dialog>
  );
}
