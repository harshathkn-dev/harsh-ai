"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AudioWaveform } from "@/components/realtime/audio-waveform";
import {
  REALTIME_VOICES,
  type LiveTranscriptMessage,
  type RealtimeVoice,
  type VoiceConnectionState,
} from "@/lib/realtime/types";

type VoiceAiPanelProps = {
  sessionId: string;
  initialVoice: RealtimeVoice;
  sessionStatus: "draft" | "active";
};

type ClientSecretResponse = {
  clientSecret: string;
  connectionId: string;
  model: string;
  voice: RealtimeVoice;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function upsertMessage(
  messages: LiveTranscriptMessage[],
  message: LiveTranscriptMessage,
) {
  const index = messages.findIndex(
    (current) => current.providerItemId === message.providerItemId,
  );
  if (index === -1) return [...messages, message];
  return messages.map((current, currentIndex) =>
    currentIndex === index ? { ...current, ...message } : current,
  );
}

function microphoneError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone permission was denied. Allow microphone access in the browser and try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was detected.";
  }
  if (error instanceof DOMException && error.name === "NotReadableError") {
    return "The microphone is already in use or unavailable.";
  }
  return "The shared audio could not be started.";
}

export function VoiceAiPanel({
  sessionId,
  initialVoice,
  sessionStatus,
}: VoiceAiPanelProps) {
  const router = useRouter();
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const connectionIdRef = useRef<string | null>(null);
  const endingRef = useRef(false);
  const messagesRef = useRef<LiveTranscriptMessage[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] =
    useState<VoiceConnectionState>("disconnected");
  const [voice, setVoice] = useState<RealtimeVoice>(initialVoice);
  const [muted, setMuted] = useState(false);
  const [messages, setMessages] = useState<LiveTranscriptMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(
    null,
  );

  function applyMessages(
    updater: (current: LiveTranscriptMessage[]) => LiveTranscriptMessage[],
  ) {
    setMessages((current) => {
      const next = updater(current);
      messagesRef.current = next;
      return next;
    });
  }

  function closeMedia() {
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }

  async function reportEnded(errorCode?: string) {
    const connectionId = connectionIdRef.current;
    connectionIdRef.current = null;
    if (!connectionId) return;

    await fetch("/api/realtime/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, connectionId, errorCode }),
      keepalive: true,
    }).catch(() => null);
  }

  async function failConnection(message: string, code: string) {
    if (endingRef.current) return;
    endingRef.current = true;
    setError(message);
    setState("error");
    closeMedia();
    await reportEnded(code);
    endingRef.current = false;
  }

  async function persistEvent(event: Record<string, unknown>) {
    const connectionId = connectionIdRef.current;
    if (!connectionId) return;

    const response = await fetch("/api/realtime/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...event, sessionId, connectionId }),
    }).catch(() => null);

    if (!response?.ok) {
      setPersistenceWarning(
        "The conversation is live, but part of its history could not be saved.",
      );
    }
  }

  function updateLiveMessage(message: LiveTranscriptMessage) {
    applyMessages((current) => upsertMessage(current, message));
  }

  function handleServerEvent(rawEvent: unknown) {
    if (!isRecord(rawEvent)) return;
    const type = stringValue(rawEvent.type);
    const itemId = stringValue(rawEvent.item_id);
    const responseId = stringValue(rawEvent.response_id) ?? undefined;

    if (type === "input_audio_buffer.speech_started") {
      setState(muted ? "muted" : "listening");
      return;
    }

    if (type === "input_audio_buffer.speech_stopped") {
      setState("processing");
      return;
    }

    if (
      type === "conversation.item.input_audio_transcription.delta" &&
      itemId
    ) {
      const delta = stringValue(rawEvent.delta);
      if (delta) {
        applyMessages((current) => {
          const existing = current.find(
            (message) => message.providerItemId === itemId,
          );
          return upsertMessage(current, {
            providerItemId: itemId,
            role: "user",
            text: `${existing?.text ?? ""}${delta}`,
            status: "in_progress",
          });
        });
      }
      return;
    }

    if (
      type === "conversation.item.input_audio_transcription.completed" &&
      itemId
    ) {
      const transcript = stringValue(rawEvent.text)?.trim();
      if (transcript) {
        const message: LiveTranscriptMessage = {
          providerItemId: itemId,
          role: "user",
          text: transcript,
          status: "completed",
        };
        updateLiveMessage(message);
        void persistEvent({ type: "message", ...message });
      }
      const usage = rawEvent.usage;
      const hasTokenUsage =
        isRecord(usage) &&
        typeof usage.input_tokens === "number" &&
        typeof usage.output_tokens === "number";
      const hasDurationUsage =
        isRecord(usage) &&
        usage.type === "duration" &&
        typeof usage.seconds === "number";
      if (hasTokenUsage || hasDurationUsage) {
        void persistEvent({
          type: "usage",
          usageKind: "transcription",
          responseId: `transcription:${itemId}`,
          usage,
        });
      }
      setState("processing");
      return;
    }

    if (
      type === "response.output_text.delta" &&
      itemId
    ) {
      const delta = stringValue(rawEvent.delta);
      if (delta) {
        setState("speaking");
        applyMessages((current) => {
          const existing = current.find(
            (message) => message.providerItemId === itemId,
          );
          return upsertMessage(current, {
            providerItemId: itemId,
            responseId,
            role: "assistant",
            text: `${existing?.text ?? ""}${delta}`,
            status: "in_progress",
          });
        });
      }
      return;
    }

    if (
      type === "response.output_text.done" &&
      itemId
    ) {
      const transcript = stringValue(rawEvent.transcript)?.trim();
      if (transcript) {
        const message: LiveTranscriptMessage = {
          providerItemId: itemId,
          responseId,
          role: "assistant",
          text: transcript,
          status: "completed",
        };
        updateLiveMessage(message);
        void persistEvent({ type: "message", ...message });
      }
      return;
    }

    if (type === "response.created") {
      setState("processing");
      return;
    }

    if (type === "response.done" && isRecord(rawEvent.response)) {
      const response = rawEvent.response;
      const completedResponseId = stringValue(response.id);
      const status = stringValue(response.status);
      if (completedResponseId && isRecord(response.usage)) {
        void persistEvent({
          type: "usage",
          usageKind: "response",
          responseId: completedResponseId,
          usage: response.usage,
        });
      }
      const finalStatus =
        status === "cancelled" ||
        status === "incomplete" ||
        status === "failed"
          ? status
          : "completed";
      if (completedResponseId) {
        const affectedMessages = messagesRef.current.filter(
          (message) => message.responseId === completedResponseId,
        );
        for (const message of affectedMessages) {
          void persistEvent({
            type: "message",
            ...message,
            status: finalStatus,
          });
        }
        applyMessages((current) =>
          current.map((message) =>
            message.responseId === completedResponseId
              ? { ...message, status: finalStatus }
              : message,
          ),
        );
      }
      setState(muted ? "muted" : "listening");
      return;
    }

    if (type === "error") {
      const providerError = isRecord(rawEvent.error)
        ? stringValue(rawEvent.error.message)
        : null;
      void failConnection(
        providerError || "OpenAI Realtime reported a connection error.",
        "provider_event_error",
      );
    }
  }

  async function startVoice() {
    setError(null);
    setPersistenceWarning(null);
    setMessages([]);
    messagesRef.current = [];

    if (
      typeof RTCPeerConnection === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setState("error");
      setError(
        "This browser does not support the WebRTC microphone features required by Voice AI.",
      );
      return;
    }

    setState("connecting");
    endingRef.current = false;

    let capture: MediaStream;
    try {
      // The browser picker lets the user share a Chrome tab (including tab audio)
      // or the entire screen/system audio where the browser and OS support it.
      capture = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: true,
      });
    } catch (captureError) {
      setState("error");
      setError(
        captureError instanceof DOMException && captureError.name === "NotAllowedError"
          ? "Audio sharing was cancelled. Share the interview tab and enable Share tab audio."
          : "Could not capture tab/system audio. Use Chrome or Edge and select a tab with audio sharing enabled.",
      );
      return;
    }

    const audioTracks = capture.getAudioTracks();
    if (audioTracks.length === 0) {
      capture.getTracks().forEach((track) => track.stop());
      setState("error");
      setError("No shared audio was detected. In the browser picker, select the interview tab and enable Share tab audio, or share your screen with system audio.");
      return;
    }

    streamRef.current = capture;
    setStream(capture);
    audioTracks.forEach((track) => {
      track.enabled = true;
      track.onended = () => {
        if (!endingRef.current) {
          void failConnection("The shared audio source stopped. Start sharing the interview tab again.", "shared_audio_ended");
        }
      };
    });

    if (sessionStatus === "draft") {
      const startResponse = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      }).catch(() => null);

      if (!startResponse?.ok) {
        const startBody = await startResponse?.json().catch(() => null);

        // A prior attempt (or the main Start session control) may already
        // have moved this session to active. Verify current state before
        // treating the conflict as a hard failure.
        if (startResponse?.status === 409) {
          const currentResponse = await fetch(`/api/sessions/${sessionId}`).catch(() => null);
          const currentBody = await currentResponse?.json().catch(() => null);
          if (currentResponse?.ok && currentBody?.session?.status === "active") {
            // The session is already active; continue to create the Realtime connection.
          } else {
            closeMedia();
            setState("error");
            setError(
              typeof startBody?.error === "string"
                ? `Could not start session: ${startBody.error}`
                : "The session is not in a startable state. Refresh and try again.",
            );
            return;
          }
        } else {
          closeMedia();
          setState("error");
          setError(
            typeof startBody?.error === "string"
              ? `Could not start session: ${startBody.error}`
              : `Could not start session (HTTP ${startResponse?.status ?? "network error"}).`,
          );
          return;
        }
      }
    }

    const secretResponse = await fetch("/api/realtime/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, voice }),
    }).catch(() => null);

    if (!secretResponse) {
      closeMedia();
      setState("error");
      setError("The Voice AI server could not be reached.");
      return;
    }

    const secretBody = (await secretResponse.json().catch(() => null)) as
      | ClientSecretResponse
      | { error?: string; code?: string }
      | null;
    if (
      !secretResponse.ok ||
      !secretBody ||
      !("clientSecret" in secretBody)
    ) {
      closeMedia();
      setState("error");
      setError(
        secretBody && "error" in secretBody && secretBody.error
          ? secretBody.error
          : "Voice AI could not create a secure Realtime session.",
      );
      return;
    }

    connectionIdRef.current = secretBody.connectionId;

    try {
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      microphone
        .getAudioTracks()
        .forEach((track) => peer.addTrack(track, capture));


      peer.onconnectionstatechange = () => {
        if (
          !endingRef.current &&
          (peer.connectionState === "failed" ||
            peer.connectionState === "disconnected" ||
            peer.connectionState === "closed")
        ) {
          void failConnection(
            "The WebRTC connection ended unexpectedly.",
            `webrtc_${peer.connectionState}`,
          );
        }
      };

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onopen = () => {
        setState(muted ? "muted" : "listening");
      };
      channel.onmessage = (event) => {
        try {
          handleServerEvent(JSON.parse(String(event.data)));
        } catch {
          // Ignore malformed provider events; the connection remains usable.
        }
      };
      channel.onerror = () => {
        void failConnection(
          "The Realtime event channel failed.",
          "data_channel_error",
        );
      };
      channel.onclose = () => {
        if (!endingRef.current) {
          void failConnection(
            "The Realtime event channel closed unexpectedly.",
            "data_channel_closed",
          );
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretBody.clientSecret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        },
      );

      if (!sdpResponse.ok) {
        throw new Error(`OpenAI WebRTC negotiation failed (${sdpResponse.status}).`);
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: await sdpResponse.text(),
      });
    } catch (connectionError) {
      await failConnection(
        connectionError instanceof Error
          ? connectionError.message
          : "The WebRTC connection could not be established.",
        "webrtc_negotiation_failed",
      );
    }
  }

  async function endVoice() {
    if (endingRef.current) return;
    endingRef.current = true;
    closeMedia();
    await reportEnded();
    setState("disconnected");
    setMuted(false);
    endingRef.current = false;
    router.refresh();
  }

  function toggleMute() {
    const nextMuted = !muted;
    streamRef.current
      ?.getAudioTracks()
      .forEach((track) => (track.enabled = !nextMuted));
    setMuted(nextMuted);
    setState(nextMuted ? "muted" : "listening");
  }

  function interrupt() {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify({ type: "response.cancel" }));
    
    setState(muted ? "muted" : "listening");
  }

  useEffect(
    () => () => {
      endingRef.current = true;
      channelRef.current?.close();
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const connectionId = connectionIdRef.current;
      if (connectionId) {
        const payload = new Blob(
          [JSON.stringify({ sessionId, connectionId })],
          { type: "application/json" },
        );
        navigator.sendBeacon("/api/realtime/end", payload);
      }
    },
    [sessionId],
  );

  const connected = !["disconnected", "error"].includes(state);
  const stateLabel = muted
    ? "Shared audio muted"
    : {
        disconnected: "Disconnected",
        connecting: "Connecting",
        connected: "Connected",
        listening: "Listening",
        processing: "Processing",
        speaking: "AI preparing answer",
        muted: "Microphone muted",
        error: "Error",
      }[state];

  return (
    <section className="card mt-8 overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span
                className={`size-2.5 rounded-full ${
                  state === "error"
                    ? "bg-red-400"
                    : connected
                      ? "animate-pulse bg-emerald-300"
                      : "bg-slate-600"
                }`}
              />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                {stateLabel}
              </p>
            </div>
            <h2 className="mt-2 text-xl font-black">Live Interview Copilot</h2>
            <p className="mt-1 text-sm text-slate-500">
              Share the interview tab or system audio. AI suggestions appear silently as text; audio is not recorded.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {!connected ? (
              <button className="button" onClick={startVoice} type="button">
                Start listening
              </button>
            ) : (
              <>
                <button
                  className="button button-secondary"
                  onClick={toggleMute}
                  type="button"
                >
                  {muted ? "Unmute shared audio" : "Mute shared audio"}
                </button>
                <button
                  className="button button-secondary"
                  disabled={state !== "speaking" && state !== "processing"}
                  onClick={interrupt}
                  type="button"
                >
                  Clear current response
                </button>
                <button
                  className="rounded-xl bg-red-400 px-4 py-3 text-sm font-black text-red-950"
                  onClick={endVoice}
                  type="button"
                >
                  Stop listening
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/15 px-3">
          <AudioWaveform muted={muted} stream={stream} />
        </div>

        {error ? (
          <p
            className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {persistenceWarning ? (
          <p
            className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
            role="status"
          >
            {persistenceWarning}
          </p>
        ) : null}
      </div>

      <div className="max-h-[30rem] overflow-y-auto p-5 sm:p-6">
        {messages.length ? (
          <div className="space-y-4" aria-live="polite">
            {messages.map((message) => (
              <article
                className={`max-w-[90%] rounded-2xl p-4 ${
                  message.role === "user"
                    ? "ml-auto bg-emerald-300 text-slate-950"
                    : "border border-white/10 bg-white/5"
                }`}
                key={message.providerItemId}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wider opacity-60">
                    {message.role === "user" ? "You" : "AI"}
                  </p>
                  {message.status === "in_progress" ? (
                    <span className="text-xs opacity-60">Live</span>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                  {message.text}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="font-bold">Conversation transcript</p>
            <p className="mt-2 text-sm text-slate-500">
              Start Voice AI and speak naturally. Final user and AI transcripts
              will be saved to this session.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
