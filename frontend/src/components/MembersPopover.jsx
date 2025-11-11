// src/components/MembersPopover.jsx
import { useState } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon } from "lucide-react";

function MembersList({ members = [], count = 0, loading = false }) {
  const getName = (m) => m?.fullName || m?.username || "";
  const getAvatar = (m) => m?.profilePic || m?.avatar || "";
  const getInitial = (m) => (getName(m)?.[0] || "U").toUpperCase();

  return (
    <div className="w-80 p-0">
      <header className="relative px-4 py-3">
        <h4 className="font-semibold text-sm">Group members ({count})</h4>
        <span className="pointer-events-none absolute bottom-0 left-4 right-4 h-px bg-neutral-200" />
      </header>

      <div className="max-h-80 overflow-auto p-3 space-y-2">
        {loading ? (
          <div className="text-xs text-neutral-500 px-1">Loading members…</div>
        ) : members?.length ? (
          members.map((m) => (
            <div key={m._id || getName(m)} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-neutral-200 overflow-hidden shrink-0">
                {getAvatar(m) ? (
                  <img
                    className="w-full h-full object-cover"
                    src={getAvatar(m)}
                    alt={getName(m) || "user"}
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs">
                    {getInitial(m)}
                  </div>
                )}
              </div>
              <div className="text-sm truncate">
                {getName(m) || "Unnamed user"}
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-neutral-500 px-1">No members</div>
        )}
      </div>
    </div>
  );
}

export default function MembersPopover({
  members = [],
  count = 0,
  onOpen,
  side = "top",
  align = "start",
  sideOffset = 8,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={async (o) => {
        setOpen(o);
        if (o && onOpen) {
          setLoading(true);
          try {
            await onOpen();
          } finally {
            setLoading(false);
          }
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className={`px-2 py-1 rounded-lg border text-xs hover:bg-neutral-100 ${className}`}
          title="Show members"
        >
          <UsersIcon className="inline w-4 h-4 mr-1" />
          Members
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align={align}   
        sideOffset={sideOffset}
        className="w-61 rounded-xl overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <MembersList members={members} count={count} loading={loading} />
        <div className="px-4 py-3 border-t border-neutral-200 text-right bg-white">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
