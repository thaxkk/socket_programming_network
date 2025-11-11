// frontend/src/components/AllChat.jsx
import ChatsList from "./ChatsList";
import MyGroupList from "./MyGroupList";

export default function AllChat() {
  return (
    <div className="flex flex-col gap-6">
      <section className="bg-white border rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-3">Groups</h2>
        <MyGroupList />
      </section>
      <section className="bg-white border rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-3">Private Messages</h2>
        <ChatsList />
      </section>
    </div>
  );
}
