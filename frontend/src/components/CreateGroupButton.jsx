// src/components/CreateGroupButton.jsx
import { useEffect, useRef, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupStore } from "../store/useGroupStore";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreateGroupButton() {
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const socket = useAuthStore((s) => s.socket);
  const getAllGroups = useGroupStore((s) => s.getAllGroups);
  const setSelectedGroup = useGroupStore((s) => s.setSelectedGroup);

  const createdHandlerRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const onCreated = (payload) => {
      if (payload?.error) {
        toast.error(payload.error);
        setCreating(false);
        return;
      }
      // payload: { group }
      const group = payload?.group;
      toast.success("Group created");
      setCreating(false);
      setOpen(false);
      setGroupName("");
      // refresh + select
      getAllGroups?.();
      if (group) setSelectedGroup?.(group);
    };

    // เก็บ handler ไว้เพื่อล้าง
    createdHandlerRef.current = onCreated;

    socket.on("groupChatCreated", onCreated);
    return () => {
      if (createdHandlerRef.current) {
        socket.off("groupChatCreated", createdHandlerRef.current);
      }
    };
  }, [socket, getAllGroups, setSelectedGroup]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!socket) {
      toast.error("Socket not connected");
      return;
    }
    const name = groupName.trim();
    if (!name) {
      toast.error("Please enter group name");
      return;
    }

    setCreating(true);
    socket.emit("createGroupChat", { name });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="rounded-full w-12 h-12 shadow-lg bg-[#8A522E] text-white flex items-center justify-center"
          title="Create group"
          variant="default"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="groupName">Group name</Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Dev Team"
              autoFocus
              required
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={creating}>
              {creating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                </span>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          * You’ll be added as the first member.
        </p>
      </PopoverContent>
    </Popover>
  );
}
