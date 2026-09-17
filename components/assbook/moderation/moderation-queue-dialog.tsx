"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, EyeOff, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/assbook/confirm-dialog";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import { age, plural } from "@/lib/format";
import type { FlaggedPhoto, ReportGroup } from "@/lib/types";

export function ModerationQueueDialog({
  now,
  onResolved,
  onClose,
}: {
  now: number;
  onResolved: () => void;
  onClose: () => void;
}) {
  const [reports, setReports] = useState<ReportGroup[]>([]);
  const [photos, setPhotos] = useState<FlaggedPhoto[]>([]);
  const [removingPhoto, setRemovingPhoto] = useState<FlaggedPhoto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState("");
  const [confirming, setConfirming] = useState<{
    action: "hide" | "dismiss";
    report: ReportGroup;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<{ reports: ReportGroup[]; photos: FlaggedPhoto[] }>("admin", {
      signal: controller.signal,
    })
      .then((data) => {
        setReports(data.reports);
        setPhotos(data.photos ?? []);
        setError("");
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(errorMessage(cause));
        setLoaded(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const resolve = useCallback(
    async (action: "hide" | "dismiss", report: ReportGroup) => {
      setPending(report.post_id);
      try {
        await api(
          action === "hide"
            ? "admin/" + report.post_id
            : "admin/" + report.post_id + "/dismiss",
          { method: action === "hide" ? "DELETE" : "POST" },
        );
        setReports((current) =>
          current.filter((item) => item.post_id !== report.post_id),
        );
        onResolved();
        toast.success(
          action === "hide"
            ? "Post hidden and reports resolved."
            : "Reports cleared. The post stays up.",
        );
      } catch (cause) {
        toast.error(errorMessage(cause));
      } finally {
        setPending("");
      }
    },
    [onResolved],
  );

  const reviewPhoto = useCallback(
    async (action: "approve" | "remove", photo: FlaggedPhoto) => {
      setPending(photo.id);
      try {
        await api(
          action === "approve"
            ? "admin/photo/" + photo.id + "/approve"
            : "admin/photo/" + photo.id,
          { method: action === "approve" ? "POST" : "DELETE" },
        );
        setPhotos((current) => current.filter((item) => item.id !== photo.id));
        if (action === "remove") onResolved();
        toast.success(
          action === "approve"
            ? "Photo approved."
            : "Photo removed everywhere it was used.",
        );
      } catch (cause) {
        toast.error(errorMessage(cause));
      } finally {
        setPending("");
      }
    },
    [onResolved],
  );

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="assbook-dialog">
          <DialogHeader>
            <DialogTitle>Moderation queue.</DialogTitle>
            <DialogDescription>
              Reported posts, and photos the automatic check was not sure about.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <div className="form-error" role="alert">
              <p>{error}</p>
              <button
                className="quiet"
                onClick={() => {
                  setError("");
                  setAttempt((n) => n + 1);
                }}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : !loaded ? (
            <p className="muted" role="status">
              <Loader2 className="spin" size={18} aria-hidden="true" /> Reading
              the queue…
            </p>
          ) : reports.length === 0 && photos.length === 0 ? (
            <p className="muted">Nothing to review. Enjoy the view.</p>
          ) : (
            <>
            {photos.length > 0 && (
              <section className="form-stack">
                <h3>Photos to review</h3>
                {photos.map((photo) => (
                  <div className="report-item" key={photo.id}>
                    <b>@{photo.handle}</b>
                    <p className="small muted">
                      {photo.target === "avatar" ? "Profile photo" : "Post photo"}
                      {photo.in_use ? ", in use" : ", not used yet"} · uploaded{" "}
                      {age(photo.created, now)}
                    </p>
                    <img
                      className="report-photo"
                      src={photo.url}
                      alt={"Photo to review from @" + photo.handle}
                      loading="lazy"
                      decoding="async"
                    />
                    {photo.reason && (
                      <p className="small report-reasons">
                        <span>{photo.reason}</span>
                      </p>
                    )}
                    <div className="report-actions">
                      <button
                        className="text-link"
                        disabled={pending === photo.id}
                        onClick={() => void reviewPhoto("approve", photo)}
                      >
                        <Check size={15} aria-hidden="true" />
                        Approve
                      </button>
                      <button
                        className="text-link"
                        disabled={pending === photo.id}
                        onClick={() => setRemovingPhoto(photo)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        Remove photo
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}
            {reports.length > 0 && photos.length > 0 && <h3>Reported posts</h3>}
            {reports.map((report) => (
              <div className="report-item" key={report.post_id}>
                <b>@{report.handle}</b>
                <p className="small muted">
                  {report.count} {plural(report.count, "report", "reports")} ·
                  latest {age(report.latest, now)}
                </p>
                <p>{report.body}</p>
                {report.image && (
                  <img
                    className="report-photo"
                    src={report.image}
                    alt={"Photo reported on the post by @" + report.handle}
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <p className="small report-reasons">
                  {report.reasons
                    .split("\n")
                    .filter(Boolean)
                    .map((reason, index) => (
                      <span key={index}>{reason}</span>
                    ))}
                </p>
                <div className="report-actions">
                  <button
                    className="text-link"
                    disabled={pending === report.post_id}
                    onClick={() => setConfirming({ action: "hide", report })}
                  >
                    <EyeOff size={15} aria-hidden="true" />
                    Hide post
                  </button>
                  <button
                    className="text-link"
                    disabled={pending === report.post_id}
                    onClick={() => setConfirming({ action: "dismiss", report })}
                  >
                    <ShieldCheck size={15} aria-hidden="true" />
                    Dismiss reports
                  </button>
                </div>
              </div>
            ))}
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={removingPhoto !== null}
        onOpenChange={(open) => !open && setRemovingPhoto(null)}
        title="Remove this photo?"
        description="It is deleted from storage, taken off the profile, and any post using it is hidden. There is no undo."
        confirmLabel="Remove it"
        onConfirm={() => {
          const target = removingPhoto;
          setRemovingPhoto(null);
          if (target) void reviewPhoto("remove", target);
        }}
      />
      <ConfirmDialog
        open={confirming?.action === "hide"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Hide this post?"
        description="It disappears from every feed and its reports are marked resolved."
        confirmLabel="Hide it"
        onConfirm={() => {
          const target = confirming?.report;
          setConfirming(null);
          if (target) void resolve("hide", target);
        }}
      />
      <ConfirmDialog
        open={confirming?.action === "dismiss"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Dismiss these reports?"
        description="The post stays exactly where it is and the reports are marked resolved."
        confirmLabel="Dismiss reports"
        destructive={false}
        onConfirm={() => {
          const target = confirming?.report;
          setConfirming(null);
          if (target) void resolve("dismiss", target);
        }}
      />
    </>
  );
}
