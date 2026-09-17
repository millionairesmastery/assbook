"use client";
import { useEffect, useState } from "react";
import { ArrowRight, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { errorMessage, uploadPhoto } from "@/lib/api-client";

const MAX_BYTES = 2 * 1024 * 1024;

export function PhotoUploadDialog({
  target,
  onUse,
  onClose,
}: {
  target: "post" | "avatar";
  onUse: (url: string) => void;
  onClose: () => void;
}) {
  // The preview URL is created in the change handler, never during render, and
  // released when it is replaced or when the dialog goes away.
  const avatar = target === "avatar";
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!picked) return;
    return () => URL.revokeObjectURL(picked.url);
  }, [picked]);

  const choose = (file: File | undefined) => {
    if (!file) {
      setPicked(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Please choose a photo under 2 MB.");
      return;
    }
    setError("");
    setPicked({ file, url: URL.createObjectURL(file) });
  };

  const upload = async () => {
    if (!picked || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await uploadPhoto(picked.file, target);
      if (result.flagged)
        toast("Photo added. The automatic check was not sure, so a moderator will take a look.", {
          duration: 8000,
        });
      onUse(result.url);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>{avatar ? "Pants on. Camera behind you." : "Add a photo."}</DialogTitle>
          <DialogDescription>
            {avatar
              ? "Your own fully clothed behind. No underwear, no swimwear, no exceptions."
              : "Your own photo, or one you have permission to share. Beach days welcome; nudity is not."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-stack">
          <label className="upload-box">
            <ImagePlus size={30} aria-hidden="true" />
            <b>{avatar ? "Choose your profile photo" : "Choose a photo"}</b>
            <span>JPEG, PNG, or WebP · up to 2 MB</span>
            <input
              type="file"
              aria-label="Choose photo"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => choose(event.target.files?.[0])}
            />
          </label>
          {picked && (
            <img
              className="upload-preview"
              src={picked.url}
              alt="Your selected photo preview"
              decoding="async"
            />
          )}
          <label className="checkbox-line" htmlFor="photo-rules">
            <Checkbox
              id="photo-rules"
              checked={agreed}
              onCheckedChange={(value) => setAgreed(value === true)}
              aria-labelledby="photo-rules-text"
            />
            <span id="photo-rules-text">
              {avatar
                ? "This is my own behind, fully clothed, and I am happy to share it."
                : "This is my photo (or I have permission to share it), and it shows no nudity or sexual content."}
            </span>
          </label>
          <button
            disabled={!picked || !agreed || busy}
            className="primary"
            onClick={() => void upload()}
          >
            {busy ? "Checking the dress code…" : "Use this photo"}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
