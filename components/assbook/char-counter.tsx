"use client";
import { useState } from "react";

/**
 * A character counter that appears as soon as a field is focused and stays
 * visible while there is anything to count.
 */
export function useCharCounter() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    handlers: {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}

export function CharCounter({
  value,
  max,
  show,
}: {
  value: string;
  max: number;
  show: boolean;
}) {
  if (!show && !value.length) return null;
  return (
    <span className={"char-counter " + (value.length >= max ? "at-limit" : "")}>
      {value.length}/{max}
    </span>
  );
}
