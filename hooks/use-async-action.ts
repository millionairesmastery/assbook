"use client";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage, isAbortError } from "@/lib/api-client";

// Per-item pending state. Every mutation gets its own key (for example
// "like:<post id>") so one busy button never freezes the whole page.
export function useAsyncAction() {
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const running = useRef<Set<string>>(new Set());

  const run = useCallback(
    async (
      key: string,
      work: () => Promise<void>,
      onError?: (message: string) => void,
    ) => {
      if (running.current.has(key)) return;
      running.current.add(key);
      setPending(new Set(running.current));
      try {
        await work();
      } catch (error) {
        if (!isAbortError(error)) {
          const message = errorMessage(error);
          if (onError) onError(message);
          else toast.error(message);
        }
      } finally {
        running.current.delete(key);
        setPending(new Set(running.current));
      }
    },
    [],
  );

  const isPending = useCallback((key: string) => pending.has(key), [pending]);
  return { pending, isPending, run };
}
