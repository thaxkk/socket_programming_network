// src/components/GroupMessageInput.jsx
import { useRef, useState, useEffect } from "react";
import toast from "react-hot-toast";
import { ImageIcon, SendIcon, XIcon } from "lucide-react";
import FallingEmojis from "./FallingEmojis";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";

/**
 * GroupMessageInput
 * - ใช้กับ group chat เท่านั้น
 * - ส่งข้อความผ่าน useGroupStore().sendGroupMessage
 * - ยิง typing ผ่าน useGroupStore().sendTypingInGroup
 *
 * Props:
 *   groupId: string (required)
 *   placeholder?: string
 */
export default function GroupMessageInput({
  groupId,
  placeholder = "Message this group...",
}) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [triggerWord, setTriggerWord] = useState("");

  const fileInputRef = useRef(null);

  // เสียงพิมพ์แบบเดียวกับ DM
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const { isSoundEnabled } = useChatStore();

  // ✅ ใช้ selector เพื่อดึงฟังก์ชันจาก Zustand ให้เสถียร
  const sendGroupMessage = useGroupStore((s) => s.sendGroupMessage);
  const sendTypingInGroup = useGroupStore((s) => s.sendTypingInGroup);

  // typing indicator
  useEffect(() => {
    if (!groupId || typeof sendTypingInGroup !== "function") return;

    const isTyping = !!text.trim();
    sendTypingInGroup({ groupId, username: undefined, isTyping });

    const t = setTimeout(() => {
      sendTypingInGroup({ groupId, username: undefined, isTyping: false });
    }, 1200);

    return () => clearTimeout(t);
  }, [text, groupId, sendTypingInGroup]);

  const handleSend = (e) => {
    e?.preventDefault?.();
    const trimmed = text.trim();
    if (!groupId) return toast.error("No group selected");
    if (!trimmed && !imagePreview) return;

    if (isSoundEnabled) playRandomKeyStrokeSound();

    sendGroupMessage({ groupId, text: trimmed, image: imagePreview });

    setText("");
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";

    // fun effects
    const word = trimmed.toLowerCase();
    if (word.includes("coconut")) setTriggerWord("coconut");
    else if (word.includes("flower")) setTriggerWord("flower");
    else if (word.includes("fire")) setTriggerWord("fire");
    else if (word.includes("love")) setTriggerWord("love");
    else return;

    setTimeout(() => setTriggerWord(""), 500);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t bg-[#8A522E]/40 border-slate-700/50">
      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-slate-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 hover:bg-slate-700"
              type="button"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSend} className="max-w-3xl mx-auto flex space-x-4">
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            isSoundEnabled && playRandomKeyStrokeSound();
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-white border border-slate-700/50 placeholder:text-[#8A522E] rounded-lg py-2 px-4 text-[#8A522E] focus:outline-none focus:ring-2 focus:ring-[#623A20] focus:border-transparent"
          placeholder={placeholder}
        />
        <FallingEmojis triggerWord={triggerWord} />

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`bg-[#FFF5DC] text-slate-500 hover:text-slate-400 rounded-lg px-4 transition-colors ${
            imagePreview ? "text-cyan-500" : ""
          }`}
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        <button
          type="submit"
          disabled={!text.trim() && !imagePreview}
          className="bg-gradient-to-r from-[#47A923] to-[#47A923] text-white rounded-lg px-4 py-2 font-medium hover:from-[#47A923] hover:to-[#47A923] hover:scale-105 transition-all transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
