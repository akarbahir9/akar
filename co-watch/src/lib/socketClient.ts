"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  // Ensure server initializes IO
  if (typeof window !== "undefined") {
    // Fire and forget
    void fetch("/api/socket");
  }

  socket = io({
    path: "/api/socket",
    autoConnect: true,
    transports: ["websocket"],
  });

  return socket;
}

