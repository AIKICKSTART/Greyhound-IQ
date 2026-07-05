"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Settings2,
  Video,
  VideoOff,
} from "lucide-react";
import {
  Room,
  RoomEvent,
  Track,
  type LocalTrack,
  type LocalTrackPublication,
  type RemoteTrack,
} from "livekit-client";
import { callMediaErrorMessage } from "@/lib/call-client-errors";

type CallTokenResponse = {
  roomId: string;
  url: string;
  token: string;
};

export type CallType = "voice" | "video";

export type ActiveCallRoom = {
  id: string;
  callType: CallType;
};

export type PendingCallInvite = {
  id: string;
  roomId: string;
  callType: CallType;
  fromName: string;
  expiresAt: string;
  forMe: boolean;
};

type CallStatus =
  | "idle"
  | "starting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

type MediaErrors = {
  microphone?: string;
  camera?: string;
  screen?: string;
};

type DeviceLists = {
  microphone: MediaDeviceInfo[];
  camera: MediaDeviceInfo[];
  speaker: MediaDeviceInfo[];
};

type RetryTarget =
  | { kind: "start"; callType: CallType }
  | { kind: "connect"; roomId: string; callType: CallType };

const VIDEO_CELL_CLASS =
  "aspect-video overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.03]";

export function ConversationCallPanel({
  conversationId,
  activeRoom,
  pendingInvite,
  blocked,
  otherName,
}: {
  conversationId: string;
  activeRoom: ActiveCallRoom | null;
  pendingInvite: PendingCallInvite | null;
  blocked: boolean;
  otherName: string;
}) {
  const [localRoom, setLocalRoom] = useState<ActiveCallRoom | null>(null);
  const [dismissedRoomId, setDismissedRoomId] = useState<string | null>(null);
  const [dismissedInviteId, setDismissedInviteId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [mode, setMode] = useState<CallType>("video");
  const [error, setError] = useState<string | null>(null);
  const [mediaErrors, setMediaErrors] = useState<MediaErrors>({});
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [devices, setDevices] = useState<DeviceLists>({
    microphone: [],
    camera: [],
    speaker: [],
  });
  const [selectedDevices, setSelectedDevices] = useState<
    Partial<Record<MediaDeviceKind, string>>
  >({});
  const [inviteBusy, setInviteBusy] = useState<"accept" | "decline" | null>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteMediaRef = useRef<HTMLDivElement>(null);
  const screenShareRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const retryRef = useRef<RetryTarget | null>(null);

  const currentRoom =
    localRoom ?? (activeRoom && activeRoom.id !== dismissedRoomId ? activeRoom : null);
  const incomingInvite =
    pendingInvite && pendingInvite.forMe && pendingInvite.id !== dismissedInviteId
      ? pendingInvite
      : null;
  const inviteExpired =
    incomingInvite !== null && Date.parse(incomingInvite.expiresAt) <= Date.now();

  const connected = status === "connected" || status === "reconnecting";
  const joining = status === "starting" || status === "connecting";
  const showVideoGrid = mode === "video" && (connected || status === "connecting");
  const supportsSpeakerSelect =
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (status !== "connected" && status !== "reconnecting") return;
    const tick = () => {
      const startedAt = connectedAtRef.current;
      if (startedAt !== null) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (!devicesOpen || !room) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const [microphones, cameras, speakers] = await Promise.all([
          Room.getLocalDevices("audioinput", false),
          mode === "video"
            ? Room.getLocalDevices("videoinput", false)
            : Promise.resolve<MediaDeviceInfo[]>([]),
          Room.getLocalDevices("audiooutput", false),
        ]);
        if (!cancelled) {
          setDevices({ microphone: microphones, camera: cameras, speaker: speakers });
        }
      } catch {
        // Enumeration unavailable; leave the lists empty.
      }
    };
    void refresh();
    const media = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    const onDeviceChange = () => void refresh();
    media?.addEventListener?.("devicechange", onDeviceChange);
    return () => {
      cancelled = true;
      media?.removeEventListener?.("devicechange", onDeviceChange);
    };
  }, [devicesOpen, room, mode]);

  function resetCallState() {
    roomRef.current = null;
    connectedAtRef.current = null;
    clearMedia(localVideoRef.current);
    clearMedia(remoteMediaRef.current);
    clearMedia(screenShareRef.current);
    setRoom(null);
    setStatus("idle");
    setMicEnabled(false);
    setCameraEnabled(false);
    setScreenShareEnabled(false);
    setElapsedSeconds(0);
    setMediaErrors({});
    setDeviceError(null);
    setDevicesOpen(false);
    setSelectedDevices({});
    setLocalRoom(null);
  }

  async function connectToRoom(roomId: string, callType: CallType) {
    setError(null);
    setMediaErrors({});
    setMicEnabled(false);
    setMode(callType);
    setStatus("connecting");
    retryRef.current = { kind: "connect", roomId, callType };

    let lastError: unknown = null;
    // ponytail: one automatic retry with a fresh token, then surface the error.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = nextRoom;
      bindRemoteTracks(nextRoom, remoteMediaRef);
      nextRoom.on(RoomEvent.Disconnected, () => {
        if (roomRef.current !== nextRoom) return;
        resetCallState();
      });
      nextRoom.on(RoomEvent.Reconnecting, () => {
        if (roomRef.current !== nextRoom) return;
        setStatus("reconnecting");
      });
      nextRoom.on(RoomEvent.Reconnected, () => {
        if (roomRef.current !== nextRoom) return;
        setStatus("connected");
      });
      nextRoom.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (roomRef.current !== nextRoom) return;
        if (publication.source === Track.Source.Camera) {
          clearMedia(localVideoRef.current);
          setCameraEnabled(false);
        }
        if (publication.source === Track.Source.ScreenShare) {
          clearMedia(screenShareRef.current);
          setScreenShareEnabled(false);
        }
      });
      try {
        const token = await createToken(roomId);
        await nextRoom.connect(token.url, token.token);
        connectedAtRef.current = Date.now();
        setElapsedSeconds(0);
        setRoom(nextRoom);
        setStatus("connected");
        if (callType === "voice") {
          // The voice-call tap is the user gesture; go live unmuted.
          try {
            await nextRoom.localParticipant.setMicrophoneEnabled(true);
            setMicEnabled(true);
          } catch (err) {
            setMediaErrors((prev) => ({
              ...prev,
              microphone: callMediaErrorMessage(err, "microphone"),
            }));
          }
        }
        return;
      } catch (err) {
        lastError = err;
        roomRef.current = null;
        void nextRoom.disconnect();
      }
    }
    setStatus("error");
    setError(lastError instanceof Error ? lastError.message : "Could not join call");
  }

  async function startCall(callType: CallType) {
    retryRef.current = { kind: "start", callType };
    setError(null);
    setStatus("starting");
    try {
      const created = await createRoom(conversationId, callType);
      setDismissedRoomId(null);
      setLocalRoom(created);
      await connectToRoom(created.id, created.callType);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not start call");
    }
  }

  function joinCall(target: ActiveCallRoom) {
    setLocalRoom(target);
    void connectToRoom(target.id, target.callType);
  }

  function tryAgain() {
    const retry = retryRef.current;
    if (!retry) return;
    if (retry.kind === "start") {
      void startCall(retry.callType);
    } else {
      void connectToRoom(retry.roomId, retry.callType);
    }
  }

  async function acceptInvite(invite: PendingCallInvite) {
    setInviteBusy("accept");
    setError(null);
    try {
      await respondToInvite(invite.roomId, "accept");
      setDismissedInviteId(invite.id);
      setDismissedRoomId(null);
      setLocalRoom({ id: invite.roomId, callType: invite.callType });
      await connectToRoom(invite.roomId, invite.callType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept call");
    } finally {
      setInviteBusy(null);
    }
  }

  async function declineInvite(invite: PendingCallInvite) {
    setInviteBusy("decline");
    setError(null);
    try {
      await respondToInvite(invite.roomId, "decline");
      setDismissedInviteId(invite.id);
      setDismissedRoomId(invite.roomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decline call");
    } finally {
      setInviteBusy(null);
    }
  }

  async function toggleMic() {
    if (!room) return;
    setMediaErrors((prev) => ({ ...prev, microphone: undefined }));
    try {
      const next = !micEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicEnabled(next);
    } catch (err) {
      setMediaErrors((prev) => ({
        ...prev,
        microphone: callMediaErrorMessage(err, "microphone"),
      }));
    }
  }

  async function toggleCamera() {
    if (!room) return;
    setMediaErrors((prev) => ({ ...prev, camera: undefined }));
    try {
      const next = !cameraEnabled;
      const publication = await room.localParticipant.setCameraEnabled(next);
      renderLocalVideo(next ? publication : undefined, localVideoRef.current);
      setCameraEnabled(next);
    } catch (err) {
      setMediaErrors((prev) => ({
        ...prev,
        camera: callMediaErrorMessage(err, "camera"),
      }));
    }
  }

  async function toggleScreenShare() {
    if (!room) return;
    setMediaErrors((prev) => ({ ...prev, screen: undefined }));
    try {
      const next = !screenShareEnabled;
      const publication = await room.localParticipant.setScreenShareEnabled(next);
      renderLocalVideo(next ? publication : undefined, screenShareRef.current);
      setScreenShareEnabled(next);
    } catch (err) {
      setMediaErrors((prev) => ({
        ...prev,
        screen: callMediaErrorMessage(err, "screen"),
      }));
    }
  }

  async function switchDevice(kind: MediaDeviceKind, deviceId: string) {
    if (!room || !deviceId) return;
    setDeviceError(null);
    try {
      await room.switchActiveDevice(kind, deviceId);
      setSelectedDevices((prev) => ({ ...prev, [kind]: deviceId }));
    } catch (err) {
      if (kind === "audioinput") {
        setDeviceError(callMediaErrorMessage(err, "microphone"));
      } else if (kind === "videoinput") {
        setDeviceError(callMediaErrorMessage(err, "camera"));
      } else {
        setDeviceError(
          err instanceof Error ? err.message : "Could not switch speaker"
        );
      }
    }
  }

  function leave() {
    const target = currentRoom;
    const activeConnection = room;
    roomRef.current = null;
    resetCallState();
    activeConnection?.disconnect();
    if (target) {
      setDismissedRoomId(target.id);
      void endRoom(target.id);
    }
  }

  function deviceSelectValue(kind: MediaDeviceKind) {
    return selectedDevices[kind] ?? room?.getActiveDevice(kind) ?? "";
  }

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
              : joining
                ? `Connecting to ${otherName}...`
                : currentRoom
                  ? `Join the active ${currentRoom.callType} call with ${otherName}`
                  : `Start a private call with ${otherName}`}
          </p>
        </div>
        {status === "idle" && !incomingInvite && (
          <div className="flex flex-wrap gap-2">
            {currentRoom ? (
              <button
                type="button"
                onClick={() => joinCall(currentRoom)}
                disabled={blocked}
                className="giq-liquid-purple-button min-h-11 px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                Join {currentRoom.callType} call
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void startCall("voice")}
                  disabled={blocked}
                  className="giq-outline-action min-h-11 px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Voice call
                </button>
                <button
                  type="button"
                  onClick={() => void startCall("video")}
                  disabled={blocked}
                  className="giq-liquid-purple-button min-h-11 px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Video className="h-3.5 w-3.5" />
                  Video call
                </button>
              </>
            )}
          </div>
        )}
        {joining && (
          <button
            type="button"
            disabled
            className="giq-liquid-purple-button min-h-11 px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Connecting...
          </button>
        )}
      </div>

      {incomingInvite &&
        status === "idle" &&
        (inviteExpired ? (
          <p className="mt-3 text-[12px] text-[hsl(var(--subtle-foreground))]">
            Missed {incomingInvite.callType} call
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.1)] p-3">
            <div className="flex items-center gap-3">
              <PhoneIncoming
                className="h-4 w-4 shrink-0 animate-pulse text-[hsl(var(--primary-bright))]"
                aria-hidden
              />
              <p className="text-[13px] text-[hsl(var(--foreground))]">
                <span className="font-semibold">{incomingInvite.fromName}</span>{" "}
                is inviting you to a {incomingInvite.callType} call
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void acceptInvite(incomingInvite)}
                disabled={blocked || inviteBusy !== null}
                aria-label={`Accept ${incomingInvite.callType} call from ${incomingInvite.fromName}`}
                className="giq-liquid-purple-button min-h-11 min-w-11 px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                {inviteBusy === "accept" ? "Joining..." : "Accept"}
              </button>
              <button
                type="button"
                onClick={() => void declineInvite(incomingInvite)}
                disabled={inviteBusy !== null}
                aria-label={`Decline ${incomingInvite.callType} call from ${incomingInvite.fromName}`}
                className="giq-danger-action min-h-11 min-w-11 px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                {inviteBusy === "decline" ? "Declining..." : "Decline"}
              </button>
            </div>
          </div>
        ))}

      {status === "reconnecting" && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-100"
        >
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-amber-300"
            aria-hidden
          />
          Reconnecting...
        </div>
      )}

      {error && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2">
          <p className="text-[12px] text-red-100">{error}</p>
          {status === "error" && retryRef.current && (
            <button
              type="button"
              onClick={tryAgain}
              className="giq-outline-action min-h-11 px-3 text-[12px] font-semibold"
            >
              Try again
            </button>
          )}
        </div>
      )}

      <div
        className={
          showVideoGrid ? "mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" : undefined
        }
      >
        <div
          ref={localVideoRef}
          className={showVideoGrid ? VIDEO_CELL_CLASS : "hidden"}
        />
        <div
          ref={remoteMediaRef}
          className={showVideoGrid ? VIDEO_CELL_CLASS : "hidden"}
        />
        <div
          ref={screenShareRef}
          className={showVideoGrid && screenShareEnabled ? VIDEO_CELL_CLASS : "hidden"}
        />
      </div>

      {connected && devicesOpen && (
        <div className="mt-4 rounded-md border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
              Microphone
              <select
                value={deviceSelectValue("audioinput")}
                onChange={(event) => void switchDevice("audioinput", event.target.value)}
                className="giq-form-control mt-1 min-h-11 w-full px-2 text-[12px]"
              >
                <option value="">System default</option>
                {devices.microphone.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || "Microphone"}
                  </option>
                ))}
              </select>
            </label>
            {mode === "video" && (
              <label className="block text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
                Camera
                <select
                  value={deviceSelectValue("videoinput")}
                  onChange={(event) =>
                    void switchDevice("videoinput", event.target.value)
                  }
                  className="giq-form-control mt-1 min-h-11 w-full px-2 text-[12px]"
                >
                  <option value="">System default</option>
                  {devices.camera.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || "Camera"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {supportsSpeakerSelect && (
              <label className="block text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
                Speaker
                <select
                  value={deviceSelectValue("audiooutput")}
                  onChange={(event) =>
                    void switchDevice("audiooutput", event.target.value)
                  }
                  className="giq-form-control mt-1 min-h-11 w-full px-2 text-[12px]"
                >
                  <option value="">System default</option>
                  {devices.speaker.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || "Speaker"}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {deviceError && (
            <p className="mt-2 text-[12px] text-red-200">{deviceError}</p>
          )}
        </div>
      )}

      {connected && (
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-4 flex flex-wrap items-center gap-2 rounded-b-lg border-t border-white/[0.08] bg-black/60 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md sm:pb-3">
          <button
            type="button"
            onClick={() => void toggleMic()}
            aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
            aria-pressed={micEnabled}
            className="giq-outline-action min-h-11 min-w-11 px-3"
          >
            {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>
          {mode === "video" && (
            <>
              <button
                type="button"
                onClick={() => void toggleCamera()}
                aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
                aria-pressed={cameraEnabled}
                className="giq-outline-action min-h-11 min-w-11 px-3"
              >
                {cameraEnabled ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <VideoOff className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void toggleScreenShare()}
                aria-label={
                  screenShareEnabled ? "Stop screen sharing" : "Share screen"
                }
                aria-pressed={screenShareEnabled}
                className="giq-outline-action min-h-11 min-w-11 px-3"
              >
                {screenShareEnabled ? (
                  <ScreenShareOff className="h-4 w-4" />
                ) : (
                  <ScreenShare className="h-4 w-4" />
                )}
              </button>
            </>
          )}
          <span
            aria-live="off"
            className="inline-flex min-h-11 items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] font-semibold tabular-nums text-[hsl(var(--foreground))]"
          >
            {formatCallDuration(elapsedSeconds)}
          </span>
          <button
            type="button"
            onClick={() => setDevicesOpen((open) => !open)}
            aria-expanded={devicesOpen}
            aria-label="Call device settings"
            className="giq-outline-action min-h-11 min-w-11 px-3"
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Devices</span>
          </button>
          <button
            type="button"
            onClick={leave}
            aria-label="Leave call"
            className="giq-danger-action ml-auto min-h-11 min-w-11 px-3"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
          {(mediaErrors.microphone || mediaErrors.camera || mediaErrors.screen) && (
            <div className="w-full space-y-1">
              {mediaErrors.microphone && (
                <p className="text-[12px] text-red-200">
                  Microphone: {mediaErrors.microphone}
                </p>
              )}
              {mediaErrors.camera && (
                <p className="text-[12px] text-red-200">
                  Camera: {mediaErrors.camera}
                </p>
              )}
              {mediaErrors.screen && (
                <p className="text-[12px] text-red-200">
                  Screen share: {mediaErrors.screen}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function formatCallDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function createRoom(
  conversationId: string,
  callType: CallType
): Promise<ActiveCallRoom> {
  const response = await fetch("/api/calls/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ conversationId, callType }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "Could not create call");
  return {
    id: payload.item.id as string,
    // Server may return an existing active room whose type wins.
    callType: payload.item.callType === "voice" ? "voice" : "video",
  };
}

async function createToken(roomId: string): Promise<CallTokenResponse> {
  const response = await fetch(`/api/calls/${roomId}/token`, { method: "POST" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "Could not join call");
  return payload as CallTokenResponse;
}

async function respondToInvite(roomId: string, action: "accept" | "decline") {
  const response = await fetch(`/api/calls/${roomId}/invite`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Could not respond to call invite");
  }
  return payload.item as { id: string; status: string };
}

async function endRoom(roomId: string) {
  await fetch(`/api/calls/${roomId}/end`, { method: "POST" });
}

function bindRemoteTracks(room: Room, container: RefObject<HTMLDivElement | null>) {
  room
    .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      attachTrack(track, container.current);
    })
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
  element.className = "h-full w-full object-cover";
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
