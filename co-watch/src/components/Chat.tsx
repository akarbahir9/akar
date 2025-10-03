"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

type ChatMessage = {
  userId: string;
  displayName: string;
  message: string;
  timestamp: number;
};

type Props = {
  socket: Socket;
  roomId: string;
  userId: string;
  displayName: string;
};

export default function Chat({ socket, roomId, userId, displayName }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onMessage(msg: ChatMessage) {
      setMessages((prev) => [...prev, msg]);
    }
    socket.on("chat-message", onMessage);
    return () => {
      socket.off("chat-message", onMessage);
    };
  }, [socket]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const msg: ChatMessage = {
      userId,
      displayName,
      message: text,
      timestamp: Date.now(),
    };
    socket.emit("chat-message", { ...msg, roomId });
    setDraft("");
  }

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white dark:bg-neutral-900">
        {messages.map((m, idx) => (
          <div key={idx} className="text-sm">
            <span className="font-semibold">{m.displayName}:</span> {m.message}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-2 flex gap-2 border-t bg-gray-50 dark:bg-neutral-800">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 rounded border bg-white dark:bg-neutral-900"
        />
        <button onClick={send} className="px-3 py-2 rounded bg-black text-white dark:bg-white dark:text-black">
          Send
        </button>
      </div>
    </div>
  );
}

