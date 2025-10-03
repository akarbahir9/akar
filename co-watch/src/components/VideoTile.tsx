"use client";

import { useEffect, useRef } from "react";

type Props = {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
};

export default function VideoTile({ stream, label, muted }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      <video ref={videoRef} playsInline autoPlay muted={muted} className="w-full h-full object-cover" />
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1">
        {label}
      </div>
    </div>
  );
}

