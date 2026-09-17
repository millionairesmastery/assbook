"use client";
import { useEffect, useState } from "react";
import { MINUTE } from "@/lib/format";

// A clock that ticks on an interval so relative timestamps stay honest without
// every card reading Date.now() during render.
export function useNow(interval = MINUTE): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}
