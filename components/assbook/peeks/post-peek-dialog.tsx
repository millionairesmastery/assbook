"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Film,
  Loader2,
  RefreshCw,
  SwitchCamera,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CharCounter, useCharCounter } from "@/components/assbook/char-counter";
import {
  ApiError,
  FriendlyError,
  api,
  errorMessage,
  uploadPhoto,
} from "@/lib/api-client";

const CLIP_MS = 5000;
const MAX_SECONDS = 5.5;
const MAX_BYTES = 8 * 1024 * 1024;
// The frame goes through the photo check, which stops at 2 MB.
const FRAME_EDGE = 1080;

type Clip = { blob: Blob; url: string; type: string };

// The clip travels as raw bytes, so it cannot go through the JSON helper. The
// error copy follows the same rules: only friendly words reach the screen.
async function uploadClip(blob: Blob, type: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/peek-upload", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": type, "X-Photo-Rules": "accepted" },
      body: blob,
    });
  } catch {
    throw new ApiError("Assbook is having a moment. Please try again.", 0);
  }
  let data: Record<string, unknown> | null = null;
  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === "object")
        data = parsed as Record<string, unknown>;
    } catch {
      data = null;
    }
  }
  if (res.ok && typeof data?.id === "string") return data.id;
  const raw = typeof data?.error === "string" ? data.error.trim() : "";
  if (res.status === 401) throw new ApiError("Join or sign in to do that.", 401);
  if (res.status === 429)
    throw new ApiError(raw || "A little breather. Please try again shortly.", 429);
  throw new ApiError(
    raw || "Assbook is having a moment. Please try again.",
    res.status,
  );
}

function headerType(type: string): string {
  return type.includes("webm") ? "video/webm" : "video/mp4";
}

function once(target: HTMLVideoElement, event: string, ms: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      target.removeEventListener(event, done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, ms);
    target.addEventListener(event, done);
  });
}

// A still from the clip, which is what the dress-code check actually reads.
async function drawFrame(video: HTMLVideoElement): Promise<Blob | null> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;
  const scale = Math.min(1, FRAME_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85),
  );
}

async function frameAtSecond(video: HTMLVideoElement): Promise<Blob | null> {
  if (video.readyState < 2) await once(video, "loadeddata", 4000);
  const length = video.duration;
  const at = Number.isFinite(length) && length > 0 ? Math.min(1, length / 2) : 1;
  if (Math.abs(video.currentTime - at) > 0.05) {
    try {
      video.currentTime = at;
      await once(video, "seeked", 4000);
    } catch {
      // Some clips refuse to seek. The first frame will have to do.
    }
  }
  return drawFrame(video);
}

// Clips written by a recorder often arrive without a duration until the
// browser has been walked to the end of them.
function readDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    const finish = (value: number) => {
      probe.onloadedmetadata = null;
      probe.ontimeupdate = null;
      probe.onerror = null;
      probe.removeAttribute("src");
      resolve(value);
    };
    probe.onloadedmetadata = () => {
      if (probe.duration === Infinity) {
        probe.ontimeupdate = () => finish(probe.duration);
        probe.currentTime = 1e101;
      } else finish(probe.duration);
    };
    probe.onerror = () => finish(Number.NaN);
    probe.src = url;
    setTimeout(() => finish(Number.NaN), 6000);
  });
}

/**
 * Five seconds, two ways in: the camera or a file. Whichever it is, a still
 * from the clip goes through the dress-code check first, and a refusal there
 * is a refusal for the whole thing.
 */
export function PostPeekDialog({
  onPosted,
  onClose,
}: {
  onPosted: () => void;
  onClose: () => void;
}) {
  const [clip, setClip] = useState<Clip | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [recording, setRecording] = useState(false);
  const [left, setLeft] = useState(CLIP_MS / 1000);
  const [caption, setCaption] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const [step, setStep] = useState<"" | "frame" | "clip" | "post">("");
  const preview = useRef<HTMLVideoElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const frame = useRef<Blob | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const counter = useCharCounter();

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  // The live preview, and the camera light going off with it.
  useEffect(() => {
    const video = preview.current;
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
    return () => {
      if (stream) for (const track of stream.getTracks()) track.stop();
    };
  }, [stream]);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!clip) return;
    return () => URL.revokeObjectURL(clip.url);
  }, [clip]);

  const openCamera = async (mode: "environment" | "user") => {
    if (opening) return;
    setError("");
    setOpening(true);
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
        audio: true,
      });
      setFacing(mode);
      setStream(next);
    } catch {
      setError(
        "Assbook could not reach your camera. Check the permission and try again, or choose a clip instead.",
      );
    } finally {
      setOpening(false);
    }
  };

  const stopRecording = useCallback(() => {
    clearTimers();
    const active = recorder.current;
    if (active && active.state !== "inactive") active.stop();
  }, [clearTimers]);

  const record = () => {
    if (!stream || recording) return;
    if (typeof MediaRecorder === "undefined") {
      setError("This browser will not record here. Choose a clip instead.");
      return;
    }
    const type = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : "video/webm";
    let made: MediaRecorder;
    try {
      made = new MediaRecorder(stream, { mimeType: type });
    } catch {
      setError("This browser will not record here. Choose a clip instead.");
      return;
    }
    const parts: Blob[] = [];
    frame.current = null;
    made.ondataavailable = (event) => {
      if (event.data.size) parts.push(event.data);
    };
    made.onstop = () => {
      clearTimers();
      setRecording(false);
      const blob = new Blob(parts, { type });
      setStream(null);
      if (blob.size > MAX_BYTES) {
        setError("That clip came out over 8 MB. Try again with less going on.");
        return;
      }
      if (blob.size < 1024) {
        setError("Nothing came out of that recording. Give it another go.");
        return;
      }
      setClip({ blob, url: URL.createObjectURL(blob), type });
    };
    recorder.current = made;
    made.start();
    setRecording(true);
    setLeft(CLIP_MS / 1000);
    const started = Date.now();
    const tick = () => {
      const over = (Date.now() - started) / 1000;
      setLeft(Math.max(0, CLIP_MS / 1000 - over));
      if (over < CLIP_MS / 1000)
        timers.current.push(setTimeout(tick, 100));
    };
    timers.current.push(setTimeout(tick, 100));
    // The still is taken from the live picture: a fresh recording is not
    // always seekable, and this frame is the one the check will read.
    timers.current.push(
      setTimeout(() => {
        const video = preview.current;
        if (video)
          void drawFrame(video).then((still) => (frame.current = still));
      }, 1000),
    );
    timers.current.push(setTimeout(stopRecording, CLIP_MS));
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (file.size > MAX_BYTES) {
      setError("That clip is over 8 MB. Save it smaller and try again.");
      return;
    }
    const url = URL.createObjectURL(file);
    const seconds = await readDuration(url);
    if (Number.isFinite(seconds) && seconds > MAX_SECONDS) {
      URL.revokeObjectURL(url);
      setError("Peeks are five seconds. Trim it and try again.");
      return;
    }
    frame.current = null;
    setClip({ blob: file, url, type: file.type || "video/mp4" });
  };

  const startOver = () => {
    setError("");
    frame.current = null;
    setClip(null);
  };

  const post = async () => {
    if (!clip || !agreed || step) return;
    setError("");
    try {
      setStep("frame");
      const still =
        frame.current ??
        (player.current ? await frameAtSecond(player.current) : null);
      if (!still)
        throw new FriendlyError(
          "We could not take a still from that clip. Try another one.",
        );
      const checked = await uploadPhoto(
        new File([still], "peek-frame.jpg", { type: "image/jpeg" }),
        "post",
      );
      setStep("clip");
      const video = await uploadClip(clip.blob, headerType(clip.type));
      setStep("post");
      await api("peeks", {
        method: "POST",
        body: { video, frame: checked.url, caption },
      });
      if (checked.flagged)
        toast(
          "Posted. The automatic check was not sure about the frame, so a moderator will take a look.",
          { duration: 8000 },
        );
      onPosted();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setStep("");
    }
  };

  const busyText =
    step === "frame"
      ? "Checking the frame…"
      : step === "clip"
        ? "Uploading the clip…"
        : step === "post"
          ? "Posting…"
          : "";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open) return;
        stopRecording();
        onClose();
      }}
    >
      <DialogContent className="assbook-dialog peek-post">
        <DialogHeader>
          <DialogTitle>Post a Peek</DialogTitle>
          <DialogDescription>What is behind you today?</DialogDescription>
        </DialogHeader>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-stack">
          {!clip && !stream && (
            <div className="peek-ways">
              <button
                className="upload-box"
                disabled={opening}
                onClick={() => void openCamera(facing)}
              >
                {opening ? (
                  <Loader2 className="spin" size={28} aria-hidden="true" />
                ) : (
                  <Camera size={28} aria-hidden="true" />
                )}
                <b>Record 5 seconds</b>
                <span>Your camera, five seconds, no retakes needed</span>
              </button>
              <label className="upload-box">
                <Film size={28} aria-hidden="true" />
                <b>Choose a clip</b>
                <span>MP4, WebM or MOV · up to 8 MB · five seconds</span>
                <input
                  type="file"
                  aria-label="Choose a clip"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(event) => void choose(event.target.files?.[0])}
                />
              </label>
            </div>
          )}
          {stream && (
            <div className="peek-camera">
              <video
                ref={preview}
                className="peek-camera-view"
                muted
                playsInline
                autoPlay
                aria-label="Camera preview"
              />
              {recording && (
                <span className="peek-countdown" aria-hidden="true">
                  <svg viewBox="0 0 48 48">
                    <circle className="peek-countdown-track" cx="24" cy="24" r="21" />
                    <circle
                      className="peek-countdown-fill"
                      cx="24"
                      cy="24"
                      r="21"
                      style={{
                        strokeDasharray: 132,
                        strokeDashoffset:
                          132 * (1 - left / (CLIP_MS / 1000)),
                      }}
                    />
                  </svg>
                  <b>{Math.ceil(left)}</b>
                </span>
              )}
              <div className="peek-camera-row">
                <button
                  className="primary"
                  onClick={recording ? stopRecording : record}
                >
                  {recording ? "Stop" : "Record 5 seconds"}
                </button>
                <button
                  className="quiet"
                  disabled={recording || opening}
                  onClick={() =>
                    void openCamera(facing === "environment" ? "user" : "environment")
                  }
                  aria-label="Switch camera"
                >
                  <SwitchCamera size={18} aria-hidden="true" />
                  Flip
                </button>
                <button
                  className="quiet"
                  onClick={() => {
                    stopRecording();
                    setStream(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {clip && (
            <>
              <video
                ref={player}
                className="peek-preview"
                src={clip.url}
                controls
                playsInline
                muted
                preload="auto"
                aria-label="Your clip"
              />
              <button className="quiet peek-again" onClick={startOver}>
                <RefreshCw size={15} aria-hidden="true" />
                Pick another clip
              </button>
            </>
          )}
          <label>
            <span className="label-row">
              A caption, if you like
              <CharCounter value={caption} max={140} show={counter.focused} />
            </span>
            <input
              value={caption}
              maxLength={140}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Five seconds of what, exactly?"
              {...counter.handlers}
            />
          </label>
          <label className="checkbox-line" htmlFor="peek-rules">
            <Checkbox
              id="peek-rules"
              checked={agreed}
              onCheckedChange={(value) => setAgreed(value === true)}
              aria-labelledby="peek-rules-text"
            />
            <span id="peek-rules-text">
              This is my clip (or I have permission to share it), and it shows
              no nudity or sexual content.
            </span>
          </label>
          <button
            className="primary"
            disabled={!clip || !agreed || !!step}
            onClick={() => void post()}
          >
            {step ? (
              <>
                <Loader2 className="spin" size={15} aria-hidden="true" />
                {busyText}
              </>
            ) : (
              <>
                Post it <ArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </button>
          <p className="muted small">
            A peek is up for 24 hours. The clip goes after that; the likes,
            replies and views stay.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
