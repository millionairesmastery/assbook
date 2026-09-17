"use client";
import { useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/assbook/avatar";
import { ConfirmDialog } from "@/components/assbook/confirm-dialog";
import { CharCounter, useCharCounter } from "@/components/assbook/char-counter";
import { PhotoUploadDialog } from "@/components/assbook/composer/photo-upload-dialog";
import { api, errorMessage } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

export function EditProfileDialog({
  user,
  onSaved,
  onClose,
}: {
  user: Profile;
  onSaved: (user: Profile) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [link, setLink] = useState(user.link ?? "");
  const [avatar, setAvatar] = useState<string | null>(user.avatar);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bioCounter = useCharCounter();

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // Partial body: the server leaves out what we do not send, and a null
      // avatar is how you take the photo back off.
      const patch: Record<string, unknown> = {};
      if (name !== user.name) patch.name = name;
      if (bio !== user.bio) patch.bio = bio;
      // An empty field is how you take the website back off again.
      if (link.trim() !== (user.link ?? "")) patch.link = link.trim();
      if (avatar !== user.avatar) patch.avatar = avatar;
      if (Object.keys(patch).length) await api("profile", { method: "PUT", body: patch });
      const fresh = await api<{ user: Profile }>("me");
      onSaved(fresh.user);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="assbook-dialog">
          <DialogHeader>
            <DialogTitle>Your best side.</DialogTitle>
            <DialogDescription>
              A little personality goes a long way.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="avatar-editor">
              <Avatar person={{ avatar, handle: user.handle }} large />
              <button
                type="button"
                className="follow-button"
                onClick={() => setUploading(true)}
              >
                <Camera size={16} aria-hidden="true" />
                Change photo
              </button>
              {avatar && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setRemoving(true)}
                >
                  Remove
                </button>
              )}
            </div>
            <label>
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={40}
                disabled={!!user.nameLockedUntil}
              />
              {user.nameLockedUntil ? (
                <span className="small muted">
                  Names change once every 14 days. Yours unlocks on{" "}
                  {new Date(user.nameLockedUntil).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                  })}
                  .
                </span>
              ) : (
                <span className="small muted">
                  You can change your name once every 14 days.
                </span>
              )}
            </label>
            <label>
              <span className="label-row">
                Bio
                <CharCounter value={bio} max={160} show={bioCounter.focused} />
              </span>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={160}
                placeholder="Tell us a little about the person in the pants."
                {...bioCounter.handlers}
              />
            </label>
            <label>
              Website
              <input
                type="url"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                maxLength={200}
                placeholder="https://"
              />
              <span className="small muted">
                Optional. One link, shown on your profile.
              </span>
            </label>
            <button className="primary" disabled={busy}>
              {busy && <Loader2 className="spin" size={15} aria-hidden="true" />}
              Save profile <Check size={17} aria-hidden="true" />
            </button>
          </form>
        </DialogContent>
      </Dialog>
      {uploading && (
        <PhotoUploadDialog
          target="avatar"
          onUse={(url) => {
            setAvatar(url);
            setUploading(false);
          }}
          onClose={() => setUploading(false)}
        />
      )}
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Take the photo down?"
        description="Your profile goes back to the trusty pair of jeans. You can upload a new photo whenever you like."
        confirmLabel="Remove photo"
        onConfirm={() => {
          setRemoving(false);
          setAvatar(null);
        }}
      />
    </>
  );
}
