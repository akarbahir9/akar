"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Peer, { SignalData } from "simple-peer";
import { getSocket } from "@/lib/socketClient";
const Chat = dynamic(() => import("@/components/Chat"), { ssr: false });
const VideoTile = dynamic(() => import("@/components/VideoTile"), { ssr: false });

type PeerInfo = {
  userId: string;
  displayName: string;
  peer: Peer;
  stream: MediaStream | null;
};

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = (params?.roomId as string) || "";
  const initialName = useMemo(() => {
    if (typeof window !== "undefined") {
      return (
        searchParams?.get("name") || localStorage.getItem("displayName") || "Guest"
      );
    }
    return "Guest";
  }, [searchParams]);

  const [displayName, setDisplayName] = useState(initialName);
  const [userId] = useState(() => uuidv4());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, PeerInfo>>({});
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const suppressRef = useRef(false);
  const socket = getSocket();

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("displayName", displayName);
    }
  }, [displayName]);

  // Get media and join room
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) return;
        setLocalStream(stream);

        socket.emit("join-room", { roomId, userId, displayName });
      } catch (err) {
        console.error("Media error", err);
        alert("Could not access camera/microphone. Please allow permissions.");
        router.push("/");
      }
    }
    init();
    return () => {
      cancelled = true;
      socket.emit("leave-room", { roomId, userId });
      Object.values(peers).forEach((p) => p.peer.destroy());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId]);

  // Socket listeners
  useEffect(() => {
    function onRoomState({ peers: peersInRoom, hostUserId: host }: { peers: Array<{ socketId: string; userId: string; displayName: string }>; hostUserId?: string }) {
      setHostUserId(host ?? null);
      // Initiate connections to existing peers
      for (const p of peersInRoom) {
        if (!p.userId || p.userId === userId) continue;
        upsertPeer(p.userId, p.displayName, true);
      }
    }

    function onPeerJoined({ hostUserId: host }: { userId: string; displayName: string; socketId: string; hostUserId?: string }) {
      setHostUserId((prev) => host ?? prev);
      // The new peer will initiate; we'll create on first signal if needed.
    }

    function onSignal({ fromUserId, data }: { fromUserId: string; data: SignalData }) {
      const existing = peers[fromUserId];
      if (!existing) {
        upsertPeer(fromUserId, "Peer", false);
      }
      const peerObj = peers[fromUserId]?.peer || pendingPeers.current.get(fromUserId)?.peer;
      if (peerObj) {
        peerObj.signal(data);
      }
    }

    function onPeerLeft({ userId: leftUserId }: { userId: string }) {
      const info = peers[leftUserId];
      if (info) {
        info.peer.destroy();
      }
      setPeers((prev) => {
        const copy = { ...prev };
        delete copy[leftUserId];
        return copy;
      });
    }

    function onHostChanged({ userId: newHost }: { userId: string }) {
      setHostUserId(newHost);
    }

    function onPlaybackUpdate({ currentTime, isPlaying: playing, url }: { currentTime: number; isPlaying: boolean; url?: string }) {
      if (url && url !== videoUrl) {
        setVideoUrl(url);
      }
      const video = videoRef.current;
      if (!video) return;
      suppressRef.current = true;
      const timeDiff = Math.abs(video.currentTime - currentTime);
      if (timeDiff > 0.5) {
        video.currentTime = currentTime;
      }
      if (playing) {
        void video.play();
      } else {
        video.pause();
      }
      setIsPlaying(playing);
      setTimeout(() => {
        suppressRef.current = false;
      }, 100);
    }

    socket.on("room-state", onRoomState);
    socket.on("peer-joined", onPeerJoined);
    socket.on("signal", onSignal);
    socket.on("peer-left", onPeerLeft);
    socket.on("host-changed", onHostChanged);
    socket.on("playback-update", onPlaybackUpdate);
    return () => {
      socket.off("room-state", onRoomState);
      socket.off("peer-joined", onPeerJoined);
      socket.off("signal", onSignal);
      socket.off("peer-left", onPeerLeft);
      socket.off("host-changed", onHostChanged);
      socket.off("playback-update", onPlaybackUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, peers, videoUrl]);

  const pendingPeers = useRef<Map<string, PeerInfo>>(new Map());

  function upsertPeer(remoteUserId: string, remoteName: string, initiator: boolean) {
    if (!localStream) return;
    if (peers[remoteUserId] || pendingPeers.current.has(remoteUserId)) return;

    const peer = new Peer({ initiator, trickle: true, stream: localStream });
    const info: PeerInfo = { userId: remoteUserId, displayName: remoteName, peer, stream: null };
    pendingPeers.current.set(remoteUserId, info);

    peer.on("signal", (data: SignalData) => {
      socket.emit("signal", { roomId, targetUserId: remoteUserId, fromUserId: userId, data });
    });

    peer.on("stream", (stream: MediaStream) => {
      setPeers((prev) => {
        const stable = { ...prev, [remoteUserId]: { ...info, stream } };
        pendingPeers.current.delete(remoteUserId);
        return stable;
      });
    });

    peer.on("close", () => {
      setPeers((prev) => {
        const copy = { ...prev };
        delete copy[remoteUserId];
        return copy;
      });
      pendingPeers.current.delete(remoteUserId);
    });

    peer.on("error", () => {
      peer.destroy();
    });
  }

  function togglePlay() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (isHost) {
      if (video.paused) {
        void video.play();
      } else {
        video.pause();
      }
    }
  }

  const isHost = hostUserId === userId;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    function onPlay() {
      const v = videoRef.current;
      if (!v) return;
      if (suppressRef.current) return;
      if (!isHost) return;
      socket.emit("playback-update", { roomId, currentTime: v.currentTime, isPlaying: true, url: videoUrl });
      setIsPlaying(true);
    }
    function onPause() {
      const v = videoRef.current;
      if (!v) return;
      if (suppressRef.current) return;
      if (!isHost) return;
      socket.emit("playback-update", { roomId, currentTime: v.currentTime, isPlaying: false, url: videoUrl });
      setIsPlaying(false);
    }
    function onSeeked() {
      const v = videoRef.current;
      if (!v) return;
      if (suppressRef.current) return;
      if (!isHost) return;
      socket.emit("playback-update", { roomId, currentTime: v.currentTime, isPlaying: !v.paused, url: videoUrl });
    }
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [socket, isHost, roomId, videoUrl]);

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-screen">
      <div className="lg:col-span-2 space-y-4">
        <div className="grid grid-cols-2 gap-3 min-h-[320px]">
          <VideoTile stream={localStream} label={`${displayName} (You)`} muted />
          {Object.values(peers).map((p) => (
            <VideoTile key={p.userId} stream={p.stream} label={p.displayName || "Peer"} />
          ))}
        </div>

        <div className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 px-3 py-2 rounded border"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Paste video URL (mp4, etc.)"
              disabled={!isHost}
            />
            <button
              className="px-3 py-2 rounded bg-black text-white disabled:opacity-50 dark:bg-white dark:text-black"
              disabled={!isHost}
              onClick={() => {
                socket.emit("playback-update", { roomId, currentTime: 0, isPlaying: false, url: videoUrl });
              }}
            >
              Load
            </button>
            <button
              className="px-3 py-2 rounded bg-black text-white disabled:opacity-50 dark:bg-white dark:text-black"
              disabled={!isHost}
              onClick={togglePlay}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
          <video ref={videoRef} src={videoUrl} controls className="w-full rounded" />
          <div className="text-xs text-gray-600 dark:text-gray-300">
            Host: {hostUserId ? (hostUserId === userId ? "You" : hostUserId) : "assigning..."}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1 space-y-4">
        <div className="border rounded-lg p-3">
          <div className="text-sm font-semibold mb-2">Room: {roomId}</div>
          <div className="flex items-center gap-2 mb-2">
            <input
              className="flex-1 px-3 py-2 rounded border"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            {isHost ? (
              <button
                className="px-3 py-2 rounded bg-black text-white dark:bg-white dark:text-black"
                onClick={() => socket.emit("set-host", { roomId, userId })}
              >
                You are host
              </button>
            ) : (
              <button
                className="px-3 py-2 rounded border"
                onClick={() => socket.emit("set-host", { roomId, userId })}
              >
                Request host
              </button>
            )}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300">
            Share this URL for friends to join.
          </div>
        </div>
        <Chat socket={socket} roomId={roomId} userId={userId} displayName={displayName} />
      </div>
    </div>
  );
}

