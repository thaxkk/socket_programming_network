import { useEffect } from "react";

export default function MembersModal({ members, count }) {
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
