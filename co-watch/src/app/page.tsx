"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [roomId, setRoomId] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("displayName");
      if (saved) setDisplayName(saved);
    }
  }, []);

  function createRoom() {
    const id = uuidv4();
    if (displayName) localStorage.setItem("displayName", displayName);
    router.push(`/room/${id}?name=${encodeURIComponent(displayName || "Guest")}`);
  }

  function joinRoom() {
    if (!roomId) return;
    if (displayName) localStorage.setItem("displayName", displayName);
    router.push(`/room/${roomId}?name=${encodeURIComponent(displayName || "Guest")}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold">Co‑Watch</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">Watch videos together with live voice/video chat.</p>
        <div className="space-y-3">
          <label className="block text-sm">Display name</label>
          <input
            className="w-full px-3 py-2 rounded border"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <label className="block text-sm">Join a room</label>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded border"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button onClick={joinRoom} className="px-3 py-2 rounded bg-black text-white dark:bg-white dark:text-black">Join</button>
          </div>
        </div>
        <div className="pt-2">
          <button onClick={createRoom} className="w-full px-3 py-2 rounded border">Create new room</button>
        </div>
      </div>
    </div>
  );
}
