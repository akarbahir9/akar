import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { Server as IOServer, Socket } from 'socket.io';

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NetSocket & {
    server: HTTPServer & {
      io?: IOServer;
    };
  };
};

type JoinPayload = {
  roomId: string;
  userId: string;
  displayName: string;
};

type SignalPayload = {
  roomId: string;
  targetUserId: string;
  fromUserId: string;
  data: unknown;
};

type PlaybackEvent = {
  roomId: string;
  currentTime: number;
  isPlaying: boolean;
};

// In-memory room -> host tracking (best-effort, not persisted)
const roomHostById: Map<string, string> = new Map();

function ensureIo(res: NextApiResponseWithSocket): IOServer {
  if (!res.socket.server.io) {
    // Lazy-create IO server and attach to Next's HTTP server
    const io: IOServer = new SocketIOServer(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    io.on('connection', (socket: Socket) => {
      socket.on('join-room', (payload: JoinPayload) => {
        const { roomId, userId, displayName } = payload;
        socket.data.userId = userId;
        socket.data.displayName = displayName;
        socket.join(roomId);

        // Assign a host if not present
        if (!roomHostById.has(roomId)) {
          roomHostById.set(roomId, userId);
        }

        const socketsInRoom = io.sockets.adapter.rooms.get(roomId) ?? new Set();
        const peers = Array.from(socketsInRoom)
          .filter((id) => id !== socket.id)
          .map((id) => {
            const s = io.sockets.sockets.get(id);
            return { socketId: id, userId: s?.data.userId, displayName: s?.data.displayName };
          });

        io.to(roomId).emit('peer-joined', {
          userId,
          displayName,
          socketId: socket.id,
          hostUserId: roomHostById.get(roomId),
        });

        socket.emit('room-state', {
          peers,
          hostUserId: roomHostById.get(roomId),
        });
      });

      socket.on('signal', (payload: SignalPayload) => {
        const { targetUserId, fromUserId, data, roomId } = payload;
        // Find target socket by userId in the room
        const socketsInRoom = io.sockets.adapter.rooms.get(roomId) ?? new Set();
        for (const socketId of socketsInRoom) {
          const s = io.sockets.sockets.get(socketId);
          if (s?.data.userId === targetUserId) {
            s.emit('signal', { fromUserId, data });
            break;
          }
        }
      });

      socket.on('chat-message', (payload: { roomId: string; userId: string; displayName: string; message: string }) => {
        const { roomId, userId, displayName, message } = payload;
        io.to(roomId).emit('chat-message', {
          userId,
          displayName,
          message,
          timestamp: Date.now(),
        });
      });

      socket.on('playback-update', (payload: PlaybackEvent & { url?: string }) => {
        const { roomId, currentTime, isPlaying, url } = payload;
        socket.to(roomId).emit('playback-update', { currentTime, isPlaying, url });
      });

      socket.on('set-host', ({ roomId, userId }: { roomId: string; userId: string }) => {
        if (roomHostById.get(roomId) !== userId) {
          roomHostById.set(roomId, userId);
          io.to(roomId).emit('host-changed', { userId });
        }
      });

      socket.on('leave-room', ({ roomId, userId }: { roomId: string; userId: string }) => {
        socket.leave(roomId);
        io.to(roomId).emit('peer-left', { userId });
        if (roomHostById.get(roomId) === userId) {
          // Reassign host if needed
          const socketsInRoom = io.sockets.adapter.rooms.get(roomId) ?? new Set();
          let newHost: string | undefined;
          for (const socketId of socketsInRoom) {
            const s = io.sockets.sockets.get(socketId);
            if (s?.data.userId) {
              newHost = s.data.userId as string;
              break;
            }
          }
          if (newHost) {
            roomHostById.set(roomId, newHost);
            io.to(roomId).emit('host-changed', { userId: newHost });
          } else {
            roomHostById.delete(roomId);
          }
        }
      });

      socket.on('disconnect', () => {
        // Best-effort cleanup: notify rooms this socket was in
        const rooms = socket.rooms;
        for (const roomId of rooms) {
          if (roomId === socket.id) continue;
          io.to(roomId).emit('peer-left', { userId: socket.data.userId });
          if (roomHostById.get(roomId) === socket.data.userId) {
            const socketsInRoom = io.sockets.adapter.rooms.get(roomId) ?? new Set();
            let newHost: string | undefined;
            for (const socketId of socketsInRoom) {
              const s = io.sockets.sockets.get(socketId);
              if (s?.data.userId) {
                newHost = s.data.userId as string;
                break;
              }
            }
            if (newHost) {
              roomHostById.set(roomId, newHost);
              io.to(roomId).emit('host-changed', { userId: newHost });
            } else {
              roomHostById.delete(roomId);
            }
          }
        }
      });
    });

    res.socket.server.io = io;
  }
  return res.socket.server.io as IOServer;
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  ensureIo(res);
  res.end();
}

