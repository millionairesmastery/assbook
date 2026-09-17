"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import type { Peek, PeekPerson } from "@/lib/types";

// The peeks strip, in the order the server picked: the viewer first, then the
// people they follow with something new, then the rest. Signed-in members only,
// so nothing is asked for until there is somebody to ask for.
export function usePeeks(viewerId: string, ready: boolean) {
  const [people, setPeople] = useState<PeekPerson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  // Read by load() only, which runs outside render.
  const current = useRef<PeekPerson[]>([]);
  const settled = useRef(false);

  useEffect(() => {
    current.current = people;
  }, [people]);
  useEffect(() => {
    settled.current = loaded;
  }, [loaded]);

  useEffect(() => {
    if (!ready || !viewerId) return;
    const controller = new AbortController();
    api<{ people: PeekPerson[] }>("peeks", { signal: controller.signal })
      .then((data) => {
        setPeople(data.people);
        setError("");
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(errorMessage(cause));
        setLoaded(true);
      });
    return () => controller.abort();
  }, [viewerId, ready, attempt]);

  const revalidate = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  const retry = useCallback(() => {
    setError("");
    setAttempt((n) => n + 1);
  }, []);

  // Used by the profile header, where somebody may tap a ring before the strip
  // has ever been asked for.
  const load = useCallback(async (): Promise<PeekPerson[]> => {
    if (settled.current) return current.current;
    const data = await api<{ people: PeekPerson[] }>("peeks");
    setPeople(data.people);
    setLoaded(true);
    return data.people;
  }, []);

  // One clip can sit in two slots at once: the creator's and a re-peeker's. A
  // patch lands on every copy, and the person's ring is counted again after.
  const patchPeek = useCallback((id: string, patch: Partial<Peek>) => {
    setPeople((list) =>
      list.map((person) =>
        person.peeks.some((peek) => peek.id === id)
          ? recount({
              ...person,
              peeks: person.peeks.map((peek) =>
                peek.id === id ? { ...peek, ...patch } : peek,
              ),
            })
          : person,
      ),
    );
  }, []);

  const removePeek = useCallback((id: string) => {
    setPeople((list) =>
      list
        .map((person) =>
          recount({
            ...person,
            peeks: person.peeks.filter((peek) => peek.id !== id),
          }),
        )
        .filter((person) => person.peeks.length > 0),
    );
  }, []);

  // Who wears a ring elsewhere on the page. Post cards have no has_peek of
  // their own, so this is where they get it.
  const withPeeks = useMemo(
    () => new Set(people.map((person) => person.id)),
    [people],
  );

  return {
    people,
    loading: ready && !!viewerId && !loaded,
    error,
    retry,
    revalidate,
    load,
    patchPeek,
    removePeek,
    withPeeks,
  };
}

function recount(person: PeekPerson): PeekPerson {
  const unwatched = person.peeks.filter((peek) => !peek.watched).length;
  return { ...person, unwatched, watched: unwatched === 0 };
}
