"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonRow } from "@/components/assbook/people/person-row";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

export function BlockedDialog({
  onClose,
  onUnblocked,
}: {
  onClose: () => void;
  onUnblocked: () => void;
}) {
  const [blocked, setBlocked] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();
    api<{ people: Profile[] }>("blocks", { signal: controller.signal })
      .then((data) => {
        setBlocked(data.people);
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

  const unblock = useCallback(
    async (person: Profile) => {
      setPending(person.id);
      try {
        await api("block/" + person.id, { method: "DELETE" });
        setBlocked((current) => current.filter((p) => p.id !== person.id));
        onUnblocked();
        toast.success("Account unblocked.");
      } catch (cause) {
        toast.error(errorMessage(cause));
      } finally {
        setPending("");
      }
    },
    [onUnblocked],
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>People you’ve left behind.</DialogTitle>
          <DialogDescription>
            You can change your mind any time.
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
            <Loader2 className="spin" size={18} aria-hidden="true" /> Checking
            your list…
          </p>
        ) : blocked.length === 0 ? (
          <p className="muted">Nobody left behind. Nice.</p>
        ) : (
          blocked.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              action={
                <button
                  className="follow-button"
                  disabled={pending === person.id}
                  onClick={() => void unblock(person)}
                  aria-label={"Unblock " + person.name}
                >
                  Unblock
                </button>
              }
            />
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}
