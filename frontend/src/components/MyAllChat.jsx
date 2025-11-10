// frontend/src/components/AllChat.jsx
import ChatsList from "./ChatsList";
import MyGroupList from "./MyGroupList";

export default function AllChat() {
  return (
    // เดิมใช้ grid 2 คอลัมน์ → เปลี่ยนเป็นคอลัมน์เดียวตลอด
    <div className="flex flex-col gap-6">
      {/* กลุ่มอยู่บนสุด กินเต็มความกว้าง */}
      <section className="bg-white border rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-3">Groups</h2>
        <MyGroupList />
      </section>

      {/* เลื่อนลงมาถึงค่อยเจอ Private Messages */}
      <section className="bg-white border rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-3">Private Messages</h2>
        <ChatsList />
      </section>
    </div>
  );
}
