"use client";
import { useEffect, useState } from "react";
import { api, isAbortError } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

export type PersonSearch = {
  /** Up to eight people matching the term, best matches first. */
  people: Profile[];
  /** True once a search for the current term has come back. */
  searched: boolean;
};

/**
 * Typeahead for the search field. The endpoint is rate limited per IP, so the
 * term is debounced and every stale request is aborted. A failed search stays
 * quiet: the post results below are still on their way.
 */
export function usePersonSearch(term: string): PersonSearch {
  const query = term.trim();
  const [result, setResult] = useState<{ query: string; people: Profile[] }>({
    query: "",
    people: [],
  });

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<{ people: Profile[] }>(
        "search/people?q=" + encodeURIComponent(query),
        { signal: controller.signal },
      )
        .then((data) => setResult({ query, people: data.people }))
        .catch((cause: unknown) => {
          if (isAbortError(cause)) return;
          setResult({ query: "", people: [] });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const matched = !!query && result.query === query;
  return { people: matched ? result.people : [], searched: matched };
}
