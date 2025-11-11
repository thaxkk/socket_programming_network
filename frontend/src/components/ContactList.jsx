import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupStore } from "../store/useGroupStore";

function ContactList() {
  const { getAllContacts, allContacts, setSelectedUser, isUsersLoading } =
    useChatStore();
  const { onlineUsers } = useAuthStore();
  const { setSelectedGroup } = useGroupStore();

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  // แยกเป็น online / offline
  const onlineContacts = allContacts.filter((c) => onlineUsers.includes(c._id));
  const offlineContacts = allContacts.filter(
    (c) => !onlineUsers.includes(c._id)
  );

  // ฟังก์ชันเรนเดอร์แต่ละหมวด
  const renderContactList = (contacts) =>
    contacts.map((contact) => (
      <div
        key={contact._id}
        className="bg-[#8A522E]/20 p-4 rounded-lg cursor-pointer hover:bg-[#8A522E]/5 transition-colors"
        onClick={() => {
          setSelectedUser(contact);
          setSelectedGroup(null);
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`avatar ${
              onlineUsers.includes(contact._id) ? "online" : "offline"
            }`}
          >
            <div className="size-12 rounded-full">
              <img
                src={contact.profilePic || "/cocouser.png"}
                alt={contact.fullName}
              />
            </div>
          </div>
          <h4 className="text-black font-medium truncate">
            {contact.fullName}
          </h4>
        </div>
      </div>
    ));

  return (
    <div className="space-y-6">
      {/*Online Section */}
      {onlineContacts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-2">Online</h3>
          <div className="space-y-2">{renderContactList(onlineContacts)}</div>
        </div>
      )}

      {/*เส้นคั่น */}
      {onlineContacts.length > 0 && offlineContacts.length > 0 && (
        <div className="border-t border-slate-300 my-2" />
      )}

      {/*Offline Section */}
      {offlineContacts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-2">Offline</h3>
          <div className="space-y-2">{renderContactList(offlineContacts)}</div>
        </div>
      )}
    </div>
  );
}

export default ContactList;
