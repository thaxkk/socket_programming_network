import { useEffect, useState } from "react";
import "../index.css";

export default function FallingEmojis({ triggerWord }) {
  const [emojis, setEmojis] = useState([]);

  const emojiMap = {
    coconut: ["🥥", "🌴", "🍹"],
    flower: ["🌸", "🌼", "💐"],
    fire: ["🔥", "💥", "⚡"],
    love: ["💖", "💞", "💕"],
  };

  useEffect(() => {
    if (triggerWord) {
      // เลือก emoji ที่ตรง keyword ถ้าไม่มีใช้ default
      const emojiList = emojiMap[triggerWord.toLowerCase()] || ["✨"];

      // สร้างชุด emoji แบบสุ่ม
      const newEmojis = Array.from({ length: 12 }).map((_, i) => ({
        id: Date.now() + i,
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        size: Math.random() * 0.6 + 0.7,
        rotate: Math.random() * 360,
        startY: Math.random() * -20 - 10,
        symbol: emojiList[Math.floor(Math.random() * emojiList.length)],
      }));

      setEmojis(newEmojis);
      setTimeout(() => setEmojis([]), 4000);
    }
  }, [triggerWord]);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      {emojis.map((emoji) => (
        <div
          key={emoji.id}
          className="emoji-fall absolute"
          style={{
            left: `${emoji.left}%`,
            top: `${emoji.startY}vh`,
            animationDelay: `${emoji.delay}s`,
            transform: `scale(${emoji.size}) rotate(${emoji.rotate}deg)`,
          }}
        >
          {emoji.symbol}
        </div>
      ))}
    </div>
  );
}
