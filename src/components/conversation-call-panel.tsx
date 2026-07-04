"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneCall, PhoneOff, Video, VideoOff } from "lucide-react";
import {
  Room,
  RoomEvent,
  Track,
  type LocalTrack,
  type LocalTrackPublication,
  type RemoteTrack,
} from "livekit-client";

type CallTokenResponse = {
  roomId: string;
  url: string;
  token: string;
};

export function ConversationCallPanel({
  conversationId,
  initialRoomId,
  blocked,
  otherName,
}: {
  conversationId: string;
  initialRoomId: string | null;
  blocked: boolean;
  otherName: string;
}) {
  const [localRoomId, setLocalRoomId] = useState<string | null>(null);
  const [dismissedRoomId, setDismissedRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<
    "idle" | "starting" | "connecting" | "connected" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteMediaRef = useRef<HTMLDivElement>(null);
  const roomId =
    localRoomId ?? (initialRoomId === dismissedRoomId ? null : initialRoomId);

  useEffect(() => {
    return () => {
      room?.disconnect();
    };
  }, [room]);

  async function startOrJoin() {
    setError(null);
    setStatus(roomId ? "connecting" : "starting");
    let nextRoom: Room | null = null;
    try {
      const activeRoomId = roomId ?? (await createRoom(conversationId));
      setDismissedRoomId(null);
      setLocalRoomId(activeRoomId);
      const token = await createToken(activeRoomId);
      nextRoom = new Room({ adaptiveStream: true, dynacast: true });
      bindRemoteTracks(nextRoom, remoteMediaRef.current);
      nextRoom.on(RoomEvent.Disconnected, () => {
        clearMedia(localVideoRef.current);
        clearMedia(remoteMediaRef.current);
        setCameraEnabled(false);
        setRoom(null);
        setStatus("idle");
      });
      await nextRoom.connect(token.url, token.token);
      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      setMicEnabled(true);
      setRoom(nextRoom);
      setStatus("connected");
    } catch (err) {
      void nextRoom?.disconnect();
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not start call");
    }
  }

  async function toggleMic() {
    if (!room) return;
    const next = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  }

  async function toggleCamera() {
    if (!room) return;
    const next = !cameraEnabled;
    const publication = await room.localParticipant.setCameraEnabled(next);
    renderLocalVideo(next ? publication : undefined, localVideoRef.current);
    setCameraEnabled(next);
  }

  function leave() {
    const activeRoomId = roomId;
    room?.disconnect();
    setRoom(null);
    setLocalRoomId(null);
    if (activeRoomId) setDismissedRoomId(activeRoomId);
    setStatus("idle");
    setCameraEnabled(false);
    clearMedia(localVideoRef.current);
    clearMedia(remoteMediaRef.current);
    if (activeRoomId) void endRoom(activeRoomId);
  }

  const connected = status === "connected";

  return (
    <section className="mt-5 rounded-lg border border-white/[0.08] bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
            Audio/video call
          </p>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            {connected
              ? `Connected with ${otherName}`
              : roomId
                ? `Join the active call with ${otherName}`
                : `Start a private call with ${otherName}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!connected ? (
            <button
              type="button"
              onClick={startOrJoin}
              disabled={blocked || status === "starting" || status === "connecting"}
              className="giq-liquid-purple-button min-h-10 px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              {status === "starting" || status === "connecting"
                ? "Connecting..."
                : roomId
                  ? "Join call"
                  : "Start call"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMic}
                className="giq-outline-action min-h-10 px-3"
                aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleCamera}
                className="giq-outline-action min-h-10 px-3"
                aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
              >
                {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={leave}
                className="giq-danger-action min-h-10 px-3"
                aria-label="Leave call"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
          {error}
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div
          ref={localVideoRef}
          className="min-h-28 overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.03]"
        />
        <div
          ref={remoteMediaRef}
          className="min-h-28 overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.03]"
        />
      </div>
    </section>
  );
}

async function createRoom(conversationId: string) {
  const response = await fetch("/api/calls/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "Could not create call");
  return payload.item.id as string;
}

async function createToken(roomId: string): Promise<CallTokenResponse> {
  const response = await fetch(`/api/calls/${roomId}/token`, { method: "POST" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "Could not join call");
  return payload as CallTokenResponse;
}

async function endRoom(roomId: string) {
  await fetch(`/api/calls/${roomId}/end`, { method: "POST" });
}

function bindRemoteTracks(room: Room, container: HTMLDivElement | null) {
  room
    .on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack) => {
        attachTrack(track, container);
      }
    )
    .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach().forEach((element) => element.remove());
    });
}

function renderLocalVideo(
  publication: LocalTrackPublication | undefined,
  container: HTMLDivElement | null
) {
  clearMedia(container);
  const track = publication?.track;
  if (!track || track.kind !== Track.Kind.Video) return;
  attachTrack(track, container);
}

function attachTrack(track: RemoteTrack | LocalTrack, container: HTMLDivElement | null) {
  if (!container) return;
  const element = track.attach();
  element.className = "h-full min-h-28 w-full object-cover";
  if (element instanceof HTMLMediaElement) {
    element.autoplay = true;
  }
  if (element instanceof HTMLVideoElement) {
    element.playsInline = true;
  }
  container.appendChild(element);
}

function clearMedia(container: HTMLDivElement | null) {
  if (!container) return;
  container.replaceChildren();
}
